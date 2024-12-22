// routes/taxManagement.js
const express = require('express');
const mongoose = require('mongoose');
const { TaxPeriod, TaxRule, TaxTransaction } = require('../../model/v2/Tax');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const jwt = require('jsonwebtoken');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);


const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate('roles');

      if (admin.type === 'System') {
        // System user has all permissions
        req.adminId = decoded.id;
        return next();
      }

      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id;
      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};


// Create tax rule
router.post('/rules', checkPermission('Manage_Tax_Rules'), async (req, res) => {
  try {
    const {
      name,
      rate,
      category,
      applicableAccounts,
      isCompound,
      exemptionThreshold,
      effectiveFrom,
      effectiveTo,
      notes
    } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const taxRule = new TaxRule({
      name,
      rate,
      category,
      applicableAccounts,
      isCompound,
      exemptionThreshold,
      effectiveFrom,
      effectiveTo,
      notes,
      entity: entityId
    });

    await taxRule.save();

    res.status(201).json({
      message: 'Tax rule created successfully',
      taxRule
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating tax rule', error: error.message });
  }
});

// Create tax period
router.post('/periods', checkPermission('Manage_Tax_Periods'), async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const taxPeriod = new TaxPeriod({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      entity: entityId
    });

    await taxPeriod.save();

    res.status(201).json({
      message: 'Tax period created successfully',
      taxPeriod
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating tax period', error: error.message });
  }
});

// Calculate taxes for a transaction
router.post('/calculate', checkPermission('Calculate_Taxes'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      baseAmount, 
      transactionDate, 
      transactionType, 
      referenceId,
      referenceModel 
    } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    // Find applicable tax rules
    const taxRules = await TaxRule.find({
      effectiveFrom: { $lte: new Date(transactionDate) },
      $or: [
        { effectiveTo: { $gte: new Date(transactionDate) } },
        { effectiveTo: null }
      ],
      category: transactionType,
      isActive: true
    }).session(session);

    // Find active tax period
    const taxPeriod = await TaxPeriod.findOne({
      startDate: { $lte: new Date(transactionDate) },
      endDate: { $gte: new Date(transactionDate) },
      status: 'Open'
    }).session(session);

    if (!taxPeriod) {
      throw new Error('No active tax period found for the transaction date');
    }

    const taxTransactions = [];
    let totalTaxAmount = 0;

    for (const rule of taxRules) {
      let taxableAmount = baseAmount;
      
      // Apply exemption threshold if exists
      if (rule.exemptionThreshold && baseAmount <= rule.exemptionThreshold) {
        continue;
      }

      const taxAmount = (taxableAmount * rule.rate) / 100;
      totalTaxAmount += taxAmount;

      const taxTransaction = new TaxTransaction({
        date: transactionDate,
        taxRule: rule._id,
        baseAmount: taxableAmount,
        taxAmount,
        reference: referenceId,
        referenceModel,
        period: taxPeriod._id,
        entity: entityId
      });

      await taxTransaction.save({ session });
      taxTransactions.push(taxTransaction);
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'Tax calculation completed',
      taxTransactions,
      totalTaxAmount
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error calculating taxes', error: error.message });
  } finally {
    session.endSession();
  }
});

// Generate tax report
router.get('/report', checkPermission('View_Tax_Reports'), async (req, res) => {
  try {
    const { periodId } = req.query;
    const entityId = req.entity._id; // Extract the entity ID from the request

    // Fetch the tax period, ensuring it belongs to the entity
    const taxPeriod = await TaxPeriod.findOne({ _id: periodId, entity: entityId });
    if (!taxPeriod) {
      return res.status(404).json({ message: 'Tax period not found or does not belong to this entity' });
    }

    // Fetch transactions related to the tax period and entity
    const transactions = await TaxTransaction.find({ period: periodId, entity: entityId })
      .populate('taxRule')
      .populate('reference')
      .sort({ date: 1 });

    // Generate summary grouped by tax rule category
    const summary = transactions.reduce((acc, trans) => {
      const category = trans.taxRule.category;
      if (!acc[category]) {
        acc[category] = {
          baseAmount: 0,
          taxAmount: 0,
          transactionCount: 0
        };
      }
      acc[category].baseAmount += trans.baseAmount;
      acc[category].taxAmount += trans.taxAmount;
      acc[category].transactionCount += 1;
      return acc;
    }, {});

    // Calculate total tax amount
    const totalTax = transactions.reduce((sum, trans) => sum + trans.taxAmount, 0);

    res.status(200).json({
      period: taxPeriod,
      transactions,
      summary,
      totalTax
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating tax report', error: error.message });
  }
});

module.exports = router;
