// routes/generalLedger.js
const express = require('express');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const logActivity = require('../../utils/activityLogger');
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


// الحصول على جميع قيود دفتر الأستاذ مع إمكانية التصفية
router.get('/ledger', checkPermission('View_Ledger'), async (req, res) => {
  try {
    const { startDate, endDate, accountId, refModel } = req.query;
    const entityId = req.entity._id; // Extract entity ID from request
    const filter = { entity: entityId }; // Add entity filter

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (accountId) {
      filter.$or = [
        { debitAccount: accountId },
        { creditAccount: accountId }
      ];
    }

    if (refModel) {
      filter.refModel = refModel;
    }

    const ledgerEntries = await GeneralLedger.find(filter)
      .populate('debitAccount', 'name type')
      .populate('creditAccount', 'name type')
      .populate('reference')
      .sort({ date: -1 });

    res.status(200).json(ledgerEntries);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// تقارير دفتر الأستاذ (مثل قائمة الدخل)
router.get('/ledger/reports', checkPermission('View_Ledger'), async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;
    const entityId = req.entity._id; // Extract entity ID from request

    if (!reportType) {
      return res.status(400).json({ message: 'Report type is required' });
    }

    // Example: Profit and Loss Report
    if (reportType === 'profit_and_loss') {
      const revenueAccount = await Account.findOne({ type: 'Revenue', entity: entityId });
      const expenseAccount = await Account.findOne({ type: 'Expense', entity: entityId });

      if (!revenueAccount || !expenseAccount) {
        return res.status(400).json({ message: 'Required accounts not found' });
      }

      const matchRevenue = {
        $match: {
          entity: entityId,
          debitAccount: { $ne: null },
          creditAccount: revenueAccount._id
        }
      };

      const matchExpenses = {
        $match: {
          entity: entityId,
          debitAccount: expenseAccount._id,
          creditAccount: { $ne: null }
        }
      };

      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        matchRevenue.$match.date = dateFilter;
        matchExpenses.$match.date = dateFilter;
      }

      const revenues = await GeneralLedger.aggregate([
        matchRevenue,
        { $group: { _id: null, total: { $sum: "$amountInBaseCurrency" } } }
      ]);

      const expenses = await GeneralLedger.aggregate([
        matchExpenses,
        { $group: { _id: null, total: { $sum: "$amountInBaseCurrency" } } }
      ]);

      const profit = (revenues[0]?.total || 0) - (expenses[0]?.total || 0);

      // Log activity for generating the report
      await logActivity({
        action: 'Generate_Report',
        performedBy: req.adminId,
        userType: 'Admin',
        itemType: 'Report',
        description: `Generated ${reportType} report for entity ${entityId}`
      });

      return res.status(200).json({
        revenue: revenues[0]?.total || 0,
        expenses: expenses[0]?.total || 0,
        profit
      });
    }

    // Add support for other report types like balance sheet, cash flows, etc.

    res.status(400).json({ message: 'Unsupported report type' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
