// routes/journalVouchers.js
const express = require('express');
const JournalVoucher = require('../../model/v2/JournalVoucher');
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


// إنشاء قسيمة يومية جديدة
router.post('/journal-vouchers', checkPermission('Create_JournalVoucher'), async (req, res) => {
  try {
    const { voucherNumber, date, description, entries } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    // حساب إجماليات المدين والدائن
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);

    // التحقق من توازن المدين والدائن
    if (totalDebit !== totalCredit) {
      return res.status(400).json({ message: 'يجب أن يكون مجموع المدين والدائن متساويًا.' });
    }

    // التحقق من وجود الحسابات
    for (const entry of entries) {
      const account = await Account.findById(entry.account);
      if (!account) {
        return res.status(400).json({ message: `الحساب بمعرف ${entry.account} غير موجود.` });
      }
    }

    const journalVoucher = new JournalVoucher({
      voucherNumber,
      date,
      description,
      entries,
      totalDebit,
      totalCredit,
      createdBy: req.adminId,
      entity: entityId
    });

    await journalVoucher.save();

    // العثور على ApprovalWorkflow المناسب
    const approvalWorkflowTemplate = await ApprovalWorkflow.findOne({ transactionType: 'JournalVoucher' });
    if (!approvalWorkflowTemplate) {
      return res.status(500).json({ message: 'لم يتم العثور على سير عمل الموافقة لنوع المعاملة JournalVoucher.' });
    }

    // إنشاء ApprovalWorkflow جديد مرتبط بالمعاملة
    const workflowSteps = approvalWorkflowTemplate.steps.map(step => ({
      level: step.level,
      approvers: step.approvers
    }));

    const approvalWorkflowInstance = new ApprovalWorkflow({
      transactionType: 'JournalVoucher',
      transactionId: journalVoucher._id,
      steps: workflowSteps,
      createdBy: req.adminId,
      entity: entityId
    });

    await approvalWorkflowInstance.save();

    // ربط ApprovalWorkflow بالمعاملة
    journalVoucher.approvalWorkflow = approvalWorkflowInstance._id;
    await journalVoucher.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_JournalVoucher',
      performedBy: req.adminId,
      targetItem: journalVoucher._id,
      itemType: 'JournalVoucher',
      userType: 'Admin',
      description: `تم إنشاء قسيمة دفتر يومية رقم ${voucherNumber} مع سير عمل الموافقة`,
      entity: entityId
    });

    res.status(201).json({ message: 'تم إنشاء قسيمة دفتر يومية بنجاح.', journalVoucher });
  } catch (error) {
    res.status(500).json({ message: 'حدث خطأ في الخادم.', error: error.message });
  }
});

// الحصول على قائمة قسائم اليومية
router.get('/journal-vouchers', checkPermission('View_JournalVouchers'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const journalVouchers = await JournalVoucher.find({ entity: entityId }) // Filter by entity
      .populate('entries.account', 'name type')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    res.status(200).json(journalVouchers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/journal-vouchers/manual', checkPermission('Create_ManualJournalVoucher'), async (req, res) => {
    try {
      const { voucherNumber, date, description, entries, type } = req.body;
      const entityId = req.entity._id; // Extract entity ID from request

      // التحقق من توازن المدين والدائن
      const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  
      if (totalDebit !== totalCredit) {
        return res.status(400).json({ message: 'Total Debit and Credit must be equal.' });
      }
  
      // التحقق من وجود الحسابات
      for (const entry of entries) {
        const account = await Account.findById(entry.account);
        if (!account) {
          return res.status(400).json({ message: `Account with ID ${entry.account} not found.` });
        }
      }
  
      const journalVoucher = new JournalVoucher({
        voucherNumber,
        date,
        description,
        entries,
        totalDebit,
        totalCredit,
        type, // 'Adjustment' أو 'Correction'
        createdBy: req.adminId,
        entity: entityId
      });
  
      await journalVoucher.save();
  
      // تسجيل النشاط
      await logActivity({
        action: `Create_${type}_JournalVoucher`,
        performedBy: req.adminId,
        targetItem: journalVoucher._id,
        itemType: 'JournalVoucher',
        userType: 'Admin',
        description: `Created ${type} Journal Voucher ${voucherNumber}`,
        entity: entityId
      });
  
      res.status(201).json({ message: 'Manual Journal Voucher created successfully', journalVoucher });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // routes/journalVouchers.js (متابعة)
router.post('/journal-vouchers/reversing', checkPermission('Create_ReversingJournalVoucher'), async (req, res) => {
    try {
      const { originalVoucherId, voucherNumber, date, description } = req.body;
      const entityId = req.entity._id; // Extract entity ID from request
  
      const originalVoucher = await JournalVoucher.findById(originalVoucherId);
      if (!originalVoucher) {
        return res.status(404).json({ message: 'Original Journal Voucher not found.' });
      }
  
      if (originalVoucher.status !== 'Approved') {
        return res.status(400).json({ message: 'Original Journal Voucher must be approved before reversing.' });
      }
  
      // إنشاء الإدخال العكسي
      const reversingEntries = originalVoucher.entries.map(entry => ({
        account: entry.account,
        debit: entry.credit,
        credit: entry.debit
      }));
  
      const totalDebit = reversingEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = reversingEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  
      const reversingVoucher = new JournalVoucher({
        voucherNumber,
        date,
        description: description || `Reversing Entry for ${originalVoucher.voucherNumber}`,
        entries: reversingEntries,
        totalDebit,
        totalCredit,
        type: 'Reversal',
        reversingEntry: originalVoucher._id,
        createdBy: req.adminId,
        entity: entityId
      });
  
      await reversingVoucher.save();
  
      // تسجيل النشاط
      await logActivity({
        action: 'Create_ReversingJournalVoucher',
        performedBy: req.adminId,
        targetItem: reversingVoucher._id,
        itemType: 'JournalVoucher',
        userType: 'Admin',
        description: `Created Reversing Journal Voucher ${voucherNumber} for Original Voucher ${originalVoucher.voucherNumber}`,
        entity: entityId
      });
  
      res.status(201).json({ message: 'Reversing Journal Voucher created successfully', reversingVoucher });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // routes/journalVouchers.js (متابعة)
router.post('/journal-vouchers/compound', checkPermission('Create_CompoundJournalVoucher'), async (req, res) => {
    try {
      const { voucherNumber, date, description, entries } = req.body;
      const entityId = req.entity._id; // Extract entity ID from request
  
      // التحقق من توازن المدين والدائن
      const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
      const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  
      if (totalDebit !== totalCredit) {
        return res.status(400).json({ message: 'Total Debit and Credit must be equal.' });
      }
  
      // التحقق من وجود الحسابات
      for (const entry of entries) {
        const account = await Account.findById(entry.account);
        if (!account) {
          return res.status(400).json({ message: `Account with ID ${entry.account} not found.` });
        }
      }
  
      const journalVoucher = new JournalVoucher({
        voucherNumber,
        date,
        description,
        entries,
        totalDebit,
        totalCredit,
        type: 'Compound',
        createdBy: req.adminId,
        entity: entityId
      });
  
      await journalVoucher.save();
  
      // تسجيل النشاط
      await logActivity({
        action: 'Create_CompoundJournalVoucher',
        performedBy: req.adminId,
        targetItem: journalVoucher._id,
        itemType: 'JournalVoucher',
        userType: 'Admin',
        description: `Created Compound Journal Voucher ${voucherNumber}`,
        entity: entityId
      });
  
      res.status(201).json({ message: 'Compound Journal Voucher created successfully', journalVoucher });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

module.exports = router;
