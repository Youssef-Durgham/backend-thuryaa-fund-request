// routes/expenses.js
const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../../model/v2/Expense');
const Product = require('../../model/v2/Product'); // إذا كان المصاريف مرتبطة بمنتجات
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const logActivity = require('../../utils/activityLogger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const ExchangeRate = require('../../model/v2/ExchangeRate');
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


// إنشاء مصروف جديد
router.post('/expenses', checkPermission('Create_Expense'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { categoryId, amount, description, currency } = req.body; // إضافة حقل العملة
    const entityId = req.entity._id;

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'USD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency }).session(session);
      if (!rateDoc) throw new Error(`Exchange rate for currency ${currency} not found`);
      exchangeRate = rateDoc.rate;
    }

    const amountInBaseCurrency = amount * exchangeRate;

    // العثور على حساب المصاريف أو إنشائه
    const expenseAccount = await findOrCreateAccount('General Expenses', 'Expense', entityId);

    // إنشاء مصروف جديد
    const expense = new Expense({
      category: categoryId,
      amount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      description,
      createdBy: req.adminId,
      entity: entityId
    });
    await expense.save({ session });

    // العثور على حساب النقدية أو الإنفاق
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Expense: ${description}`,
      debitAccount: expenseAccount._id,
      creditAccount: cashAccount._id,
      amount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      reference: expense._id,
      refModel: 'Expense',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    expense.relatedLedgerEntries.push(ledgerEntry._id);
    await expense.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Expense',
      performedBy: req.adminId,
      targetItem: expense._id,
      itemType: 'Expense',
      userType: 'Admin',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Expense created successfully', expense });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// الحصول على جميع المصاريف
router.get('/expenses', checkPermission('View_Expenses'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const expenses = await Expense.find({ entity: entityId }) // Filter by entity
      .populate('category', 'name')
      .populate('createdBy', 'name');

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// إلغاء مصروف
router.post('/expenses/:id/cancel', checkPermission('Cancel_Expense'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const entityId = req.entity._id;
    const expense = await Expense.findById(req.params.id).session(session);
    if (!expense) throw new Error('Expense not found');
    if (expense.isCanceled) throw new Error('Expense already canceled');

    // إنشاء قيود دفتر الأستاذ لعكس المصروف
    const expenseAccount = await findOrCreateAccount('General Expenses', 'Expense', entityId);
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    const ledgerEntry = new GeneralLedger({
      description: `Expense cancellation: ${expense.description}`,
      debitAccount: cashAccount._id,
      creditAccount: expenseAccount._id,
      amount: expense.amount,
      currency: expense.currency, // إضافة العملة
      exchangeRate: expense.exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency: expense.amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      reference: expense._id,
      refModel: 'Expense',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    expense.isCanceled = true;
    expense.canceledAt = new Date();
    expense.description += ' (Canceled)';
    expense.relatedLedgerEntries.push(ledgerEntry._id);
    await expense.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Cancel_Expense',
      performedBy: req.adminId,
      targetItem: expense._id,
      itemType: 'Expense',
      userType: 'Admin',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Expense canceled successfully', expense });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
