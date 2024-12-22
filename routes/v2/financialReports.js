// routes/financialReports.js
const express = require('express');
const IncomeStatement = require('../../model/v2/IncomeStatement');
const BalanceSheet = require('../../model/v2/BalanceSheet');
const CashFlowStatement = require('../../model/v2/CashFlowStatement');
const TrialBalance = require('../../model/v2/TrialBalance');
const logActivity = require('../../model/v2/activityLogger');
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


// مثال على إنشاء قائمة الدخل
router.post('/income-statement', checkPermission('Create_IncomeStatement'), async (req, res) => {
  try {
    const { periodStart, periodEnd, revenues, expenses } = req.body;

    // حساب صافي الدخل
    const totalRevenues = revenues.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const netIncome = totalRevenues - totalExpenses;

    const incomeStatement = new IncomeStatement({
      periodStart,
      periodEnd,
      revenues,
      expenses,
      netIncome,
      createdBy: req.adminId
    });

    await incomeStatement.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_IncomeStatement',
      performedBy: req.adminId,
      targetItem: incomeStatement._id,
      itemType: 'IncomeStatement',
      userType: 'Admin'
    });

    res.status(201).json({ message: 'Income Statement created successfully', incomeStatement });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/income-statement', checkPermission('View_IncomeStatement'), async (req, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      const filter = {};
      if (periodStart) filter.periodStart = { $gte: new Date(periodStart) };
      if (periodEnd) filter.periodEnd = { $lte: new Date(periodEnd) };
  
      const incomeStatements = await IncomeStatement.find(filter)
        .populate('revenues.account', 'name')
        .populate('expenses.account', 'name')
        .populate('createdBy', 'name');
  
      res.status(200).json(incomeStatements);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

module.exports = router;
