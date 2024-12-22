// routes/approvalWorkflows.js
const express = require('express');
const ApprovalWorkflow = require('../../model/v2/ApprovalWorkflow');
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


// إنشاء ApprovalWorkflow جديدة
router.post('/approval-workflows', checkPermission('Create_ApprovalWorkflow'), async (req, res) => {
  try {
    const { transactionType, steps } = req.body;
    const entityId = req.entity._id;

    // التحقق من أن نوع المعاملة غير موجود مسبقًا
    const existingWorkflow = await ApprovalWorkflow.findOne({ transactionType });
    if (existingWorkflow) {
      return res.status(400).json({ message: `سير عمل الموافقة لنوع المعاملة ${transactionType} موجود بالفعل.` });
    }

    // التحقق من صحة معرفات المستخدمين في الموافقات
    for (const step of steps) {
      for (const approverId of step.approvers) {
        const admin = await Admin.findById(approverId);
        if (!admin) {
          return res.status(400).json({ message: `المستخدم بمعرف ${approverId} غير موجود.` });
        }
      }
    }

    const approvalWorkflow = new ApprovalWorkflow({
      transactionType,
      steps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflow.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_ApprovalWorkflow',
      performedBy: req.adminId,
      targetItem: approvalWorkflow._id,
      itemType: 'ApprovalWorkflow',
      userType: 'Admin',
      description: `تم إنشاء سير عمل الموافقة لنوع المعاملة ${transactionType}`,
      entity: entityId
    });

    res.status(201).json({ message: 'تم إنشاء سير عمل الموافقة بنجاح.', approvalWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// تعديل ApprovalWorkflow قائم
router.put('/approval-workflows/:id', checkPermission('Update_ApprovalWorkflow'), async (req, res) => {
  try {
    const { id } = req.params;
    const { steps } = req.body;
    const entityId = req.entity._id;

    const approvalWorkflow = await ApprovalWorkflow.findById(id);
    if (!approvalWorkflow) {
      return res.status(404).json({ message: 'سير عمل الموافقة غير موجود.' });
    }

    // التحقق من صحة معرفات المستخدمين في الموافقات
    for (const step of steps) {
      for (const approverId of step.approvers) {
        const admin = await Admin.findById(approverId);
        if (!admin) {
          return res.status(400).json({ message: `المستخدم بمعرف ${approverId} غير موجود.` });
        }
      }
    }

    approvalWorkflow.steps = steps;
    await approvalWorkflow.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Update_ApprovalWorkflow',
      performedBy: req.adminId,
      targetItem: approvalWorkflow._id,
      itemType: 'ApprovalWorkflow',
      userType: 'Admin',
      description: `تم تحديث سير عمل الموافقة لنوع المعاملة ${approvalWorkflow.transactionType}`,
      entity: entityId
    });

    res.status(200).json({ message: 'تم تحديث سير عمل الموافقة بنجاح.', approvalWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// الحصول على ApprovalWorkflow حسب نوع المعاملة
router.get('/approval-workflows/:transactionType', checkPermission('View_ApprovalWorkflow'), async (req, res) => {
  try {
    const { transactionType } = req.params;

    const approvalWorkflow = await ApprovalWorkflow.findOne({ transactionType })
      .populate('steps.approvers', 'name role'); // استبدل 'name role' بالحقول التي تريد عرضها من نموذج Admin

    if (!approvalWorkflow) {
      return res.status(404).json({ message: `سير عمل الموافقة لنوع المعاملة ${transactionType} غير موجود.` });
    }

    res.status(200).json(approvalWorkflow);
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// حذف ApprovalWorkflow
router.delete('/approval-workflows/:id', checkPermission('Delete_ApprovalWorkflow'), async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = req.entity._id;

    const approvalWorkflow = await ApprovalWorkflow.findById(id);
    if (!approvalWorkflow) {
      return res.status(404).json({ message: 'سير عمل الموافقة غير موجود.' });
    }

    await ApprovalWorkflow.findByIdAndDelete(id);

    // تسجيل النشاط
    await logActivity({
      action: 'Delete_ApprovalWorkflow',
      performedBy: req.adminId,
      targetItem: id,
      itemType: 'ApprovalWorkflow',
      userType: 'Admin',
      description: `تم حذف سير عمل الموافقة لنوع المعاملة ${approvalWorkflow.transactionType}`,
      entity: entityId
    });

    res.status(200).json({ message: 'تم حذف سير عمل الموافقة بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// تعيين/تعديل المستخدمين في ApprovalWorkflow
router.put('/approval-workflows/:id/assign-approvers', checkPermission('Assign_Approvers'), async (req, res) => {
  try {
    const { id } = req.params;
    const { steps } = req.body; // مصفوفة خطوات الموافقة مع معرفات المستخدمين
    const entityId = req.entity._id;

    const approvalWorkflow = await ApprovalWorkflow.findById(id);
    if (!approvalWorkflow) {
      return res.status(404).json({ message: 'سير عمل الموافقة غير موجود.' });
    }

    // تحديث خطوات الموافقة
    approvalWorkflow.steps = steps;

    // التحقق من صحة معرفات المستخدمين
    for (const step of steps) {
      for (const approverId of step.approvers) {
        const admin = await Admin.findById(approverId);
        if (!admin) {
          return res.status(400).json({ message: `المستخدم بمعرف ${approverId} غير موجود.` });
        }
      }
    }

    await approvalWorkflow.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Assign_Approvers',
      performedBy: req.adminId,
      targetItem: approvalWorkflow._id,
      itemType: 'ApprovalWorkflow',
      userType: 'Admin',
      description: `تم تعيين/تعديل الموافقين في سير عمل الموافقة لنوع المعاملة ${approvalWorkflow.transactionType}`,
      entity: entityId
    });

    res.status(200).json({ message: 'تم تعيين الموافقين بنجاح.', approvalWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

module.exports = router;
