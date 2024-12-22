// routes/sales.js
const express = require('express');
const mongoose = require('mongoose');
const Sale = require('../../model/v2/sale');
const Product = require('../../model/v2/Product');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const ApprovalWorkflow = require('../../model/v2/ApprovalWorkflow'); // استيراد نموذج ApprovalWorkflow
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


// إنشاء عملية بيع جديدة مع سير عمل الموافقة
router.post('/sales', checkPermission('Create_Sale'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customerId, items, tax, description, currency } = req.body; // إضافة حقل العملة
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
      if (product.stock < item.quantity) throw new Error(`Insufficient stock for product: ${product.name}`);
      item.total = item.quantity * product.price;
      totalAmount += item.total;

      // تحديث المخزون
      product.stock -= item.quantity;
      await product.save({ session });
    }

    const grandTotal = totalAmount + (tax || 0);
    const amountInBaseCurrency = grandTotal * exchangeRate;

    // إنشاء عملية البيع بحالة "معلق للموافقة"
    const sale = new Sale({
      customer: customerId,
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      items,
      totalAmount,
      tax,
      grandTotal,
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      createdBy: req.adminId,
      description,
      status: 'Pending', // حالة البيع "معلقة"
      entity: entityId
    });
    await sale.save({ session });

    // العثور على ApprovalWorkflow المناسب
    const approvalWorkflowTemplate = await ApprovalWorkflow.findOne({ transactionType: 'Sale' }).session(session);
    if (!approvalWorkflowTemplate) {
      throw new Error('Approval workflow for Sale not found.');
    }

    // إنشاء ApprovalWorkflow جديد مرتبط بالمعاملة
    const workflowSteps = approvalWorkflowTemplate.steps.map(step => ({
      level: step.level,
      approvers: step.approvers
    }));

    const approvalWorkflowInstance = new ApprovalWorkflow({
      transactionType: 'Sale',
      transactionId: sale._id,
      steps: workflowSteps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflowInstance.save({ session });

    // ربط ApprovalWorkflow بالمعاملة
    sale.approvalWorkflow = approvalWorkflowInstance._id;
    await sale.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Sale',
      performedBy: req.adminId,
      targetUser: customerId,
      targetItem: sale._id,
      userType: 'Customer',
      itemType: 'Sale',
      description: `تم إنشاء عملية بيع رقم ${sale._id} مع سير عمل الموافقة`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'تم إنشاء عملية بيع بنجاح مع سير عمل الموافقة.', sale });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// الحصول على جميع عمليات البيع مع تفاصيل سير عمل الموافقة
router.get('/sales', checkPermission('View_Sales'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const sales = await Sale.find({ entity: entityId }) // Filter by entity
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .populate({
        path: 'approvalWorkflow',
        populate: {
          path: 'steps.approvers',
          select: 'name role'
        }
      });

    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// إلغاء عملية بيع مع سير عمل الموافقة
router.post('/sales/:id/cancel', checkPermission('Cancel_Sale'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const entityId = req.entity._id; // Extract entity ID from request
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) throw new Error('Sale not found');
    if (sale.isCanceled) throw new Error('Sale already canceled');
    if (sale.status !== 'Approved') throw new Error('Only approved sales can be canceled.');

    // إنشاء سير عمل موافقة لإلغاء البيع
    const approvalWorkflowTemplate = await ApprovalWorkflow.findOne({ transactionType: 'CancelSale' }).session(session);
    if (!approvalWorkflowTemplate) {
      throw new Error('Approval workflow for CancelSale not found.');
    }

    // إنشاء ApprovalWorkflow جديد لإلغاء البيع
    const workflowSteps = approvalWorkflowTemplate.steps.map(step => ({
      level: step.level,
      approvers: step.approvers
    }));

    const approvalWorkflowInstance = new ApprovalWorkflow({
      transactionType: 'CancelSale',
      transactionId: sale._id,
      steps: workflowSteps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflowInstance.save({ session });

    // ربط ApprovalWorkflow بالمعاملة
    sale.approvalWorkflow = approvalWorkflowInstance._id;
    await sale.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Request_Cancel_Sale',
      performedBy: req.adminId,
      targetUser: sale.customer,
      targetItem: sale._id,
      userType: 'Customer',
      itemType: 'Sale',
      description: `تم طلب إلغاء عملية بيع رقم ${sale._id} مع سير عمل الموافقة`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تم طلب إلغاء عملية البيع بنجاح مع سير عمل الموافقة.', sale });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

module.exports = router;
