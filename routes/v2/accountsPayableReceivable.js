// routes/accountsPayableReceivable.js
const express = require('express');
const mongoose = require('mongoose');
const AccountsPayable = require('../../model/v2/AccountsPayable');
const AccountsReceivable = require('../../model/v2/AccountsReceivable');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const logActivity = require('../../utils/activityLogger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const ExchangeRate = require('../../model/v2/ExchangeRate')
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


// إنشاء حساب مستحق جديد
router.post('/accounts-payable', checkPermission('Create_AccountsPayable'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { supplierId, amount, dueDate, description, currency } = req.body; // إضافة حقل العملة
    const entityId = req.entity._id;

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'USD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency }).session(session);
      if (!rateDoc) throw new Error(`Exchange rate for currency ${currency} not found`);
      exchangeRate = rateDoc.rate;
    }

    const amountInBaseCurrency = amount * exchangeRate;

    // العثور على حساب المورد أو إنشائه
    const accountsPayableAccount = await findOrCreateAccount('Accounts Payable', 'Liability', entityId);

    // إنشاء حساب مستحق جديد
    const payable = new AccountsPayable({
      supplier: supplierId,
      amount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      dueDate,
      description,
      createdBy: req.adminId,
      entity: entityId
    });
    await payable.save({ session });

    // العثور على حساب النقدية أو الإنفاق
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Accounts Payable for supplier ${supplierId}`,
      debitAccount: accountsPayableAccount._id,
      creditAccount: cashAccount._id,
      amount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      reference: payable._id,
      refModel: 'AccountsPayable',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    payable.relatedLedgerEntries.push(ledgerEntry._id);
    await payable.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_AccountsPayable',
      performedBy: req.adminId,
      targetItem: payable._id,
      itemType: 'AccountsPayable',
      userType: 'Supplier',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Accounts Payable created successfully', payable });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// إنشاء حساب ذمم مدينة جديد
router.post('/accounts-receivable', checkPermission('Create_AccountsReceivable'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customerId, amount, dueDate, description } = req.body;
    const entityId = req.entity._id;

    // العثور على حساب الذمم المدينة أو إنشائه
    const accountsReceivableAccount = await findOrCreateAccount('Accounts Receivable', 'Asset', entityId);

    // إنشاء حساب ذمم مدينة جديد
    const receivable = new AccountsReceivable({
      customer: customerId,
      amount,
      dueDate,
      description,
      createdBy: req.adminId,
      entity: entityId
    });
    await receivable.save({ session });

    // العثور على حساب الإيرادات أو الإنفاق
    const revenueAccount = await findOrCreateAccount('Revenue', 'Revenue', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Accounts Receivable from customer ${customerId}`,
      debitAccount: accountsReceivableAccount._id,
      creditAccount: revenueAccount._id,
      amount,
      reference: receivable._id,
      refModel: 'AccountsReceivable',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    receivable.relatedLedgerEntries.push(ledgerEntry._id);
    await receivable.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_AccountsReceivable',
      performedBy: req.adminId,
      targetItem: receivable._id,
      itemType: 'AccountsReceivable',
      userType: 'Customer',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Accounts Receivable created successfully', receivable });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// دفع حساب مستحق
router.post('/accounts-payable/:id/pay', checkPermission('Pay_AccountsPayable'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { paymentAmount, description, currency } = req.body; // إضافة حقل العملة
    const entityId = req.entity._id;

    const payable = await AccountsPayable.findById(id).session(session);
    if (!payable) throw new Error('Accounts Payable not found');
    if (payable.status === 'Paid') throw new Error('Accounts Payable already paid');
    if (paymentAmount > payable.amount) throw new Error('Payment amount exceeds payable amount');

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'USD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency }).session(session);
      if (!rateDoc) throw new Error(`Exchange rate for currency ${currency} not found`);
      exchangeRate = rateDoc.rate;
    }

    const amountInBaseCurrency = paymentAmount * exchangeRate;

    // تحديث الحساب المستحق
    payable.amount -= paymentAmount;
    payable.exchangeRate = exchangeRate; // تحديث سعر الصرف
    payable.currency = currency; // تحديث العملة
    payable.amountInBaseCurrency = payable.amountInBaseCurrency - amountInBaseCurrency;

    if (payable.amount === 0) {
      payable.status = 'Paid';
    }
    await payable.save({ session });

    // العثور على حساب النقدية أو الإنفاق
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    const accountsPayableAccount = await findOrCreateAccount('Accounts Payable', 'Liability', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Payment for Accounts Payable ${id}`,
      debitAccount: cashAccount._id,
      creditAccount: payable.status === 'Paid' ? accountsPayableAccount._id : 'Partial Accounts Payable', // تأكد من وجود حساب 'Partial Accounts Payable' أو تعديل المنطق
      amount: paymentAmount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      reference: payable._id,
      refModel: 'AccountsPayable',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    payable.relatedLedgerEntries.push(ledgerEntry._id);
    await payable.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Pay_AccountsPayable',
      performedBy: req.adminId,
      targetItem: payable._id,
      itemType: 'AccountsPayable',
      userType: 'Supplier',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Accounts Payable payment successful', payable });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// استلام دفعة من حساب ذمم مدينة
router.post('/accounts-receivable/:id/receive', checkPermission('Receive_AccountsReceivable'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { receiveAmount, description, currency } = req.body; // إضافة حقل العملة
    const entityId = req.entity._id;

    const receivable = await AccountsReceivable.findById(id).session(session);
    if (!receivable) throw new Error('Accounts Receivable not found');
    if (receivable.status === 'Received') throw new Error('Accounts Receivable already received');
    if (receiveAmount > receivable.amount) throw new Error('Receive amount exceeds receivable amount');

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'USD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency }).session(session);
      if (!rateDoc) throw new Error(`Exchange rate for currency ${currency} not found`);
      exchangeRate = rateDoc.rate;
    }

    const amountInBaseCurrency = receiveAmount * exchangeRate;

    // تحديث حساب الذمم المدينة
    receivable.amount -= receiveAmount;
    receivable.exchangeRate = exchangeRate; // تحديث سعر الصرف
    receivable.currency = currency; // تحديث العملة
    receivable.amountInBaseCurrency = receivable.amountInBaseCurrency - amountInBaseCurrency;

    if (receivable.amount === 0) {
      receivable.status = 'Received';
    }
    await receivable.save({ session });

    // العثور على حساب الإيرادات أو الإنفاق
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Received payment for Accounts Receivable ${id}`,
      debitAccount: cashAccount._id,
      creditAccount: receivable.status === 'Received' ? 'Accounts Receivable' : 'Partial Accounts Receivable', // تأكد من وجود حساب 'Partial Accounts Receivable' أو تعديل المنطق
      amount: receiveAmount,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      reference: receivable._id,
      refModel: 'AccountsReceivable',
      entity: entityId
    });
    await ledgerEntry.save({ session });

    receivable.relatedLedgerEntries.push(ledgerEntry._id);
    await receivable.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Receive_AccountsReceivable',
      performedBy: req.adminId,
      targetItem: receivable._id,
      itemType: 'AccountsReceivable',
      userType: 'Customer',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Accounts Receivable payment received successfully', receivable });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
