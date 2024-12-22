// routes/approvals.js
const express = require('express');
const mongoose = require('mongoose');
const ApprovalWorkflow = require('../../model/v2/ApprovalWorkflow');
const Purchase = require('../../model/v2/Purchase');
const Sale = require('../../model/v2/sale');
const Product = require('../../model/v2/Product');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const logActivity = require('../../utils/activityLogger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
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


// الموافقة على المعاملة
router.post('/approvals/:workflowId/approve', checkPermission('Approve_Transaction'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments } = req.body;
    const adminId = req.adminId;
    const entityId = req.entity._id;

    const workflow = await ApprovalWorkflow.findById(workflowId).populate('steps.approvers', 'name role').session(session);
    if (!workflow) {
      return res.status(404).json({ message: 'سير عمل الموافقة غير موجود.' });
    }

    if (workflow.status !== 'Pending') {
      return res.status(400).json({ message: 'المعاملة تم إنهاؤها بالفعل.' });
    }

    // الحصول على الخطوة الحالية
    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) {
      return res.status(400).json({ message: 'لا توجد خطوة موافقة حالية.' });
    }

    // التحقق من أن المستخدم يمكنه الموافقة في هذه الخطوة
    if (!currentStep.approvers.map(id => id.toString()).includes(adminId)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية الموافقة في هذه المرحلة.' });
    }

    // تحديث حالة الخطوة الحالية
    currentStep.status = 'Approved';
    currentStep.approvedBy = adminId;
    currentStep.approvedAt = new Date();

    // التحقق مما إذا كانت هناك خطوات أخرى
    const nextStep = workflow.steps.find(step => step.level === workflow.currentLevel + 1);

    if (nextStep) {
      // تحديث المستوى الحالي
      workflow.currentLevel += 1;
    } else {
      // لا توجد خطوات أخرى، يتم اعتبار المعاملة موافق عليها بالكامل
      workflow.status = 'Approved';

      // تنفيذ العملية المالية هنا
      switch (workflow.transactionType) {
        case 'Purchase':
          {
            const purchase = await Purchase.findById(workflow.transactionId).session(session);
            if (purchase) {
              purchase.status = 'Approved';
              purchase.approvedBy = adminId;
              await purchase.save({ session });

              // العثور على حسابات دفتر الأستاذ أو إنشائها
              const expenseAccount = await findOrCreateAccount('Purchases', 'Expense', entityId).session(session);
              const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId).session(session);

              // إنشاء قيود دفتر الأستاذ
              const ledgerEntry1 = new GeneralLedger({
                description: `Purchase from supplier ${purchase.supplier}`,
                debitAccount: expenseAccount._id,
                creditAccount: cashAccount._id,
                amount: purchase.grandTotal,
                currency: purchase.currency, // إضافة العملة
                exchangeRate: purchase.exchangeRate, // إضافة سعر الصرف
                amountInBaseCurrency: purchase.amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
                reference: purchase._id,
                refModel: 'Purchase',
                entity: entityId
              });

              await ledgerEntry1.save({ session });

              purchase.relatedLedgerEntries.push(ledgerEntry1._id);
              await purchase.save({ session });
            }
          }
          break;

        case 'Sale':
          {
            const sale = await Sale.findById(workflow.transactionId).session(session);
            if (sale) {
              sale.status = 'Approved';
              sale.approvedBy = adminId;
              await sale.save({ session });

              // العثور على حسابات دفتر الأستاذ أو إنشائها
              const revenueAccount = await findOrCreateAccount('Sales Revenue', 'Revenue', entityId).session(session);
              const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId).session(session);

              // إنشاء قيود دفتر الأستاذ
              const ledgerEntry1 = new GeneralLedger({
                description: `Sale to customer ${sale.customer}`,
                debitAccount: cashAccount._id,
                creditAccount: revenueAccount._id,
                amount: sale.grandTotal,
                currency: sale.currency, // إضافة العملة
                exchangeRate: sale.exchangeRate, // إضافة سعر الصرف
                amountInBaseCurrency: sale.amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
                reference: sale._id,
                refModel: 'Sale',
                entity: entityId
              });

              await ledgerEntry1.save({ session });

              sale.relatedLedgerEntries.push(ledgerEntry1._id);
              await sale.save({ session });
            }
          }
          break;

        case 'CancelPurchase':
          {
            const purchase = await Purchase.findById(workflow.transactionId).session(session);
            if (purchase && !purchase.isCanceled) {
              // استرجاع المخزون
              for (const item of purchase.items) {
                const product = await Product.findById(item.product).session(session);
                if (product) {
                  product.stock += item.quantity;
                  await product.save({ session });
                }
              }

              // إنشاء قيود دفتر الأستاذ لعكس المعاملة
              const expenseAccount = await findOrCreateAccount('Purchases', 'Expense', entityId).session(session);
              const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId).session(session);

              const ledgerEntry1 = new GeneralLedger({
                description: `Purchase cancellation for supplier ${purchase.supplier}`,
                debitAccount: cashAccount._id,
                creditAccount: expenseAccount._id,
                amount: purchase.grandTotal,
                currency: purchase.currency, // إضافة العملة
                exchangeRate: purchase.exchangeRate, // إضافة سعر الصرف
                amountInBaseCurrency: purchase.amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
                reference: purchase._id,
                refModel: 'Purchase',
                entity: entityId
              });

              await ledgerEntry1.save({ session });

              purchase.isCanceled = true;
              purchase.canceledAt = new Date();
              purchase.description += ' (Canceled)';
              purchase.relatedLedgerEntries.push(ledgerEntry1._id);
              await purchase.save({ session });
            }
          }
          break;

        case 'CancelSale':
          {
            const sale = await Sale.findById(workflow.transactionId).session(session);
            if (sale && !sale.isCanceled) {
              // استرجاع المخزون
              for (const item of sale.items) {
                const product = await Product.findById(item.product).session(session);
                if (product) {
                  product.stock += item.quantity;
                  await product.save({ session });
                }
              }

              // إنشاء قيود دفتر الأستاذ لعكس المعاملة
              const revenueAccount = await findOrCreateAccount('Sales Revenue', 'Revenue', entityId).session(session);
              const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId).session(session);

              const ledgerEntry1 = new GeneralLedger({
                description: `Sale cancellation for customer ${sale.customer}`,
                debitAccount: revenueAccount._id,
                creditAccount: cashAccount._id,
                amount: sale.grandTotal,
                currency: sale.currency, // إضافة العملة
                exchangeRate: sale.exchangeRate, // إضافة سعر الصرف
                amountInBaseCurrency: sale.amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
                reference: sale._id,
                refModel: 'Sale',
                entity: entityId
              });

              await ledgerEntry1.save({ session });

              sale.isCanceled = true;
              sale.canceledAt = new Date();
              sale.description += ' (Canceled)';
              sale.relatedLedgerEntries.push(ledgerEntry1._id);
              await sale.save({ session });
            }
          }
          break;

        default:
          throw new Error(`Unhandled transaction type: ${workflow.transactionType}`);
      }

    }

    await workflow.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Approve_Transaction',
      performedBy: adminId,
      targetItem: workflow.transactionId,
      itemType: workflow.transactionType,
      userType: 'Admin',
      description: `تمت الموافقة على المعاملة في المستوى ${currentStep.level} من قبل المستخدم ${adminId}`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تمت الموافقة على المعاملة بنجاح.', workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// رفض المعاملة
router.post('/approvals/:workflowId/reject', checkPermission('Reject_Transaction'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments } = req.body;
    const adminId = req.adminId;
    const entityId = req.entity._id;

    const workflow = await ApprovalWorkflow.findById(workflowId).session(session);
    if (!workflow) {
      return res.status(404).json({ message: 'سير عمل الموافقة غير موجود.' });
    }

    if (workflow.status !== 'Pending') {
      return res.status(400).json({ message: 'المعاملة تم إنهاؤها بالفعل.' });
    }

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) {
      return res.status(400).json({ message: 'لا توجد خطوة موافقة حالية.' });
    }

    if (!currentStep.approvers.map(id => id.toString()).includes(adminId)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية الرفض في هذه المرحلة.' });
    }

    // تحديث حالة الخطوة الحالية
    currentStep.status = 'Rejected';
    currentStep.approvedBy = adminId;
    currentStep.approvedAt = new Date();

    // تحديث حالة سير العمل
    workflow.status = 'Rejected';

    // تحديث حالة المعاملة
    switch (workflow.transactionType) {
      case 'Purchase':
        {
          const purchase = await Purchase.findById(workflow.transactionId).session(session);
          if (purchase) {
            purchase.status = 'Rejected';
            await purchase.save({ session });
          }
        }
        break;

      case 'Sale':
        {
          const sale = await Sale.findById(workflow.transactionId).session(session);
          if (sale) {
            sale.status = 'Rejected';
            await sale.save({ session });
          }
        }
        break;

      case 'CancelPurchase':
        {
          const purchase = await Purchase.findById(workflow.transactionId).session(session);
          if (purchase) {
            // لا يتم تنفيذ إلغاء البيع، فقط تحديث حالة العملية الأصلية إذا لزم الأمر
            // يمكن إضافة أي إجراءات إضافية هنا إذا كانت مطلوبة
          }
        }
        break;

      case 'CancelSale':
        {
          const sale = await Sale.findById(workflow.transactionId).session(session);
          if (sale) {
            // لا يتم تنفيذ إلغاء البيع، فقط تحديث حالة العملية الأصلية إذا لزم الأمر
            // يمكن إضافة أي إجراءات إضافية هنا إذا كانت مطلوبة
          }
        }
        break;

      default:
        throw new Error(`Unhandled transaction type: ${workflow.transactionType}`);
    }

    await workflow.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Reject_Transaction',
      performedBy: adminId,
      targetItem: workflow.transactionId,
      itemType: workflow.transactionType,
      userType: 'Admin',
      description: `تم رفض المعاملة في المستوى ${currentStep.level} من قبل المستخدم ${adminId}`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تم رفض المعاملة بنجاح.', workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

module.exports = router;
