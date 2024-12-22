// routes/budgetManagement.js
const express = require('express');
const mongoose = require('mongoose');
const Budget = require('../../model/v2/Budget');
const Account = require('../../model/v2/Account');
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


// Create new budget
router.post('/budgets', checkPermission('Create_Budget'), async (req, res) => {
  try {
    const { year, month, department, category, plannedAmount, notes } = req.body;
    const entityId = req.entity._id;

    const budget = new Budget({
      year,
      month,
      department,
      category,
      plannedAmount,
      notes,
      createdBy: req.adminId,
      entity: entityId
    });

    await budget.save();

    res.status(201).json({
      message: 'Budget created successfully',
      budget
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating budget', error: error.message });
  }
});

// Update budget actuals
router.post('/budgets/update-actuals', checkPermission('Update_Budget'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { year, month } = req.body;
    const entityId = req.entity._id; // Extract the entity ID from the request

    // Get all budgets for the specified period and entity
    const budgets = await Budget.find({ year, month, entity: entityId }).session(session);

    // Get all transactions for the period and entity
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const ledgerEntries = await GeneralLedger.find({
      date: { $gte: startDate, $lte: endDate },
      entity: entityId // Filter by entity
    }).session(session);

    // Update each budget with actual amounts
    for (const budget of budgets) {
      const relevantEntries = ledgerEntries.filter(entry => {
        // Match entries based on category/department
        return entry.category === budget.category &&
               (!budget.department || entry.department === budget.department);
      });

      const actualAmount = relevantEntries.reduce((sum, entry) => {
        return sum + entry.amountInBaseCurrency;
      }, 0);

      budget.actualAmount = actualAmount;
      budget.variance = budget.plannedAmount - actualAmount;
      await budget.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'Budget actuals updated successfully',
      budgets
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error updating budget actuals', error: error.message });
  } finally {
    session.endSession();
  }
});

// Get budget reports with comparisons
router.get('/budgets/report', checkPermission('View_Budget'), async (req, res) => {
  try {
    const { year, month, department } = req.query;
    const entityId = req.entity._id; // Extract the entity ID from the request

    const query = { year, month, entity: entityId }; // Add entity filter
    if (department) query.department = department;

    const budgets = await Budget.find(query)
      .populate('createdBy', 'name')
      .sort({ category: 1 });

    const summary = budgets.reduce((acc, budget) => {
      acc.totalPlanned += budget.plannedAmount;
      acc.totalActual += budget.actualAmount;
      acc.totalVariance += budget.variance;
      return acc;
    }, { totalPlanned: 0, totalActual: 0, totalVariance: 0 });

    // Calculate performance metrics
    const performance = {
      overallPerformance: (summary.totalActual / summary.totalPlanned) * 100,
      categoriesOverBudget: budgets.filter(b => b.variance < 0).length,
      categoriesUnderBudget: budgets.filter(b => b.variance > 0).length
    };

    res.status(200).json({
      budgets,
      summary,
      performance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching budget report', error: error.message });
  }
});

module.exports = router;

