// routes/reports.js
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


// تقرير الميزانية العمومية
router.get('/reports/balance-sheet', checkPermission('View_BalanceSheet'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // جمع الأصول
    const assets = await GeneralLedger.aggregate([
      { $match: { debitAccount: { $ne: null }, creditAccount: { $ne: null } } },
      {
        $lookup: {
          from: 'accounts',
          localField: 'debitAccount',
          foreignField: '_id',
          as: 'debitAccount'
        }
      },
      { $unwind: '$debitAccount' },
      { $match: { 'debitAccount.type': 'Asset' } },
      { $group: { _id: null, totalAssets: { $sum: '$amount' } } }
    ]);

    // جمع الخصوم
    const liabilities = await GeneralLedger.aggregate([
      { $match: { debitAccount: { $ne: null }, creditAccount: { $ne: null } } },
      {
        $lookup: {
          from: 'accounts',
          localField: 'creditAccount',
          foreignField: '_id',
          as: 'creditAccount'
        }
      },
      { $unwind: '$creditAccount' },
      { $match: { 'creditAccount.type': 'Liability' } },
      { $group: { _id: null, totalLiabilities: { $sum: '$amount' } } }
    ]);

    // جمع حقوق الملكية
    const equity = await GeneralLedger.aggregate([
      { $match: { debitAccount: { $ne: null }, creditAccount: { $ne: null } } },
      {
        $lookup: {
          from: 'accounts',
          localField: 'creditAccount',
          foreignField: '_id',
          as: 'creditAccount'
        }
      },
      { $unwind: '$creditAccount' },
      { $match: { 'creditAccount.type': 'Equity' } },
      { $group: { _id: null, totalEquity: { $sum: '$amount' } } }
    ]);

    const totalAssets = assets[0]?.totalAssets || 0;
    const totalLiabilities = liabilities[0]?.totalLiabilities || 0;
    const totalEquity = equity[0]?.totalEquity || 0;

    // تسجيل النشاط
    await logActivity({
      action: 'Generate_BalanceSheet_Report',
      performedBy: req.adminId,
      userType: 'Admin',
      itemType: 'Report',
      description: 'Generated Balance Sheet report'
    });

    res.status(200).json({
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
