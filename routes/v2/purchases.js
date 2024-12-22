// routes/purchases.js
const express = require('express');
const mongoose = require('mongoose');
const Purchase = require('../../model/v2/Purchase');
const Product = require('../../model/v2/Product');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const logActivity = require('../../utils/activityLogger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const ExchangeRate = require('../../model/v2/ExchangeRate'); // تأكد من مسار النموذج الصحيح
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


// إنشاء عملية شراء جديدة
router.post('/purchases', checkPermission('Create_Purchase'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { supplierId, items, tax, description, currency } = req.body; // إضافة حقل العملة
    const entityId = req.entity._id; // Extract entity ID from request

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'IQD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency }).session(session);
      if (!rateDoc) throw new Error(`Exchange rate for currency ${currency} not found`);
      exchangeRate = rateDoc.rate;
    }

    // حساب الإجمالي
    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw new Error(`Product not found: ${item.product}`);
      item.total = item.quantity * item.cost;
      totalAmount += item.total;

      // تحديث المخزون
      product.stock += item.quantity;
      await product.save({ session });
    }

    const grandTotal = totalAmount + (tax || 0);
    const amountInBaseCurrency = grandTotal * exchangeRate;

    // إنشاء عملية الشراء بحالة "معلق للموافقة"
    const purchase = new Purchase({
      supplier: supplierId,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      items,
      totalAmount,
      tax,
      grandTotal,
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      createdBy: req.adminId,
      description,
      status: 'Pending', // إضافة حالة المشتريات
      entity: entityId
    });
    await purchase.save({ session });

    // العثور على ApprovalWorkflow المناسب
    const approvalWorkflowTemplate = await ApprovalWorkflow.findOne({ transactionType: 'Purchase' }).session(session);
    if (!approvalWorkflowTemplate) {
      throw new Error('Approval workflow for Purchase not found.');
    }

    // إنشاء ApprovalWorkflow جديد مرتبط بالمعاملة
    const workflowSteps = approvalWorkflowTemplate.steps.map(step => ({
      level: step.level,
      approvers: step.approvers
    }));

    const approvalWorkflowInstance = new ApprovalWorkflow({
      transactionType: 'Purchase',
      transactionId: purchase._id,
      steps: workflowSteps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflowInstance.save({ session });

    // ربط ApprovalWorkflow بالمعاملة
    purchase.approvalWorkflow = approvalWorkflowInstance._id;
    await purchase.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Purchase',
      performedBy: req.adminId,
      targetUser: supplierId,
      targetItem: purchase._id,
      userType: 'Supplier', // تأكد من إضافة 'Supplier' في enum `userType` إذا لزم الأمر
      itemType: 'Purchase',
      description: `تم إنشاء عملية شراء رقم ${purchase._id} مع سير عمل الموافقة`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'تم إنشاء عملية شراء بنجاح مع سير عمل الموافقة.', purchase });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});


// الحصول على جميع عمليات الشراء
router.get('/purchases', checkPermission('View_Purchases'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const purchases = await Purchase.find({ entity: entityId }) // Filter by entity
      .populate('supplier', 'name phone')
      .populate('createdBy', 'name')
      .populate({
        path: 'approvalWorkflow',
        populate: {
          path: 'steps.approvers',
          select: 'name role'
        }
      });

    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// إلغاء عملية شراء مع سير عمل الموافقة (اختياري)
router.post('/purchases/:id/cancel', checkPermission('Cancel_Purchase'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const entityId = req.entity._id; // Extract entity ID from request
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) throw new Error('Purchase not found');
    if (purchase.isCanceled) throw new Error('Purchase already canceled');
    if (purchase.status !== 'Approved') throw new Error('Only approved purchases can be canceled.');

    // إنشاء سير عمل موافقة لإلغاء الشراء
    const approvalWorkflowTemplate = await ApprovalWorkflow.findOne({ transactionType: 'CancelPurchase' }).session(session);
    if (!approvalWorkflowTemplate) {
      throw new Error('Approval workflow for CancelPurchase not found.');
    }

    // إنشاء ApprovalWorkflow جديد لإلغاء الشراء
    const workflowSteps = approvalWorkflowTemplate.steps.map(step => ({
      level: step.level,
      approvers: step.approvers
    }));

    const approvalWorkflowInstance = new ApprovalWorkflow({
      transactionType: 'CancelPurchase',
      transactionId: purchase._id,
      steps: workflowSteps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflowInstance.save({ session });

    // ربط ApprovalWorkflow بالمعاملة
    purchase.approvalWorkflow = approvalWorkflowInstance._id;
    await purchase.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Request_Cancel_Purchase',
      performedBy: req.adminId,
      targetUser: purchase.supplier,
      targetItem: purchase._id,
      userType: 'Supplier', // تأكد من إضافة 'Supplier' في enum `userType` إذا لزم الأمر
      itemType: 'Purchase',
      description: `تم طلب إلغاء عملية شراء رقم ${purchase._id} مع سير عمل الموافقة`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تم طلب إلغاء عملية الشراء بنجاح مع سير عمل الموافقة.', purchase });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});


module.exports = router;
