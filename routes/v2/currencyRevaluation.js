// routes/currencyRevaluation.js
const express = require('express');
const CurrencyRevaluation = require('../../model/v2/CurrencyRevaluation');
const ExchangeRate = require('../../model/v2/ExchangeRate');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const logActivity = require('../../utils/activityLogger');
const mongoose = require('mongoose');
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



router.post('/currency-revaluation', checkPermission('Create_CurrencyRevaluation'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { currency, newRate, revaluationDate } = req.body;
    const entityId = req.entity._id;

    const exchangeRate = await ExchangeRate.findOne({ currency }).session(session);
    if (!exchangeRate) throw new Error(`Exchange rate for currency ${currency} not found`);

    const oldRate = exchangeRate.rate;
    const difference = newRate - oldRate;

    // تحديث سعر الصرف
    exchangeRate.rate = newRate;
    await exchangeRate.save({ session });

    // إنشاء عملية إعادة تقييم
    const revaluation = new CurrencyRevaluation({
      revaluationDate: revaluationDate || new Date(),
      currency,
      oldRate,
      newRate,
      difference,
      createdBy: req.adminId,
      entity: entityId
    });
    await revaluation.save({ session });

    // إنشاء قيود دفتر الأستاذ لتعكس الفرق
    const revaluationAccount = await findOrCreateAccount('Currency Revaluation', 'Equity', entityId); // حساب حقوق الملكية
    const lossAccount = await findOrCreateAccount('Currency Losses', 'Expense', entityId); // حساب خسائر العملات
    const gainAccount = await findOrCreateAccount('Currency Gains', 'Revenue', entityId); // حساب أرباح العملات

    let ledgerEntry;
    if (difference < 0) { // خسارة
      ledgerEntry = new GeneralLedger({
        description: `Currency Revaluation Loss for ${currency}`,
        debitAccount: lossAccount._id,
        creditAccount: revaluationAccount._id,
        amount: Math.abs(difference),
        currency: 'IQD', // أو العملة المناسبة
        exchangeRate: 1320,
        amountInBaseCurrency: Math.abs(difference),
        reference: revaluation._id,
        refModel: 'CurrencyRevaluation',
        entity: entityId
      });
    } else { // ربح
      ledgerEntry = new GeneralLedger({
        description: `Currency Revaluation Gain for ${currency}`,
        debitAccount: revaluationAccount._id,
        creditAccount: gainAccount._id,
        amount: difference,
        currency: 'IQD', // أو العملة المناسبة
        exchangeRate: 1320,
        amountInBaseCurrency: difference,
        reference: revaluation._id,
        refModel: 'CurrencyRevaluation',
        entity: entityId
      });
    }

    await ledgerEntry.save({ session });

    revaluation.relatedLedgerEntries.push(ledgerEntry._id);
    await revaluation.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_CurrencyRevaluation',
      performedBy: req.adminId,
      targetItem: revaluation._id,
      itemType: 'CurrencyRevaluation',
      userType: 'Admin',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Currency revaluation created successfully', revaluation });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/currency-revaluation', checkPermission('View_CurrencyRevaluation'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const revaluations = await CurrencyRevaluation.find({ entity: entityId }) // Filter by entity
      .populate('createdBy', 'name')
      .populate('relatedLedgerEntries');

    res.status(200).json(revaluations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
