// routes/recurringEntries.js
const express = require('express');
const RecurringEntry = require('../../model/v2/RecurringEntry');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const logActivity = require('../utils/activityLogger');
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



router.post('/recurring-entries', checkPermission('Create_RecurringEntry'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { templateId } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const template = await JournalTemplate.findById(templateId).session(session);
    if (!template || !template.isActive) {
      throw new Error('Journal template not found or inactive');
    }

    const newRecurringEntry = new RecurringEntry({
      template: template._id,
      entries: template.entries,
      runDate: new Date(),
      createdBy: template.createdBy,
      entity: entityId
    });
    await newRecurringEntry.save({ session });

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntries = [];
    for (const entry of template.entries) {
      const ledgerEntry = new GeneralLedger({
        description: `Recurring Entry from template ${template.name}`,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount,
        currency: 'USD', // أو العملة المناسبة
        exchangeRate: 1, // أو سعر الصرف المناسب
        amountInBaseCurrency: entry.amount,
        reference: newRecurringEntry._id,
        refModel: 'RecurringEntry',
        entity: entityId
      });
      await ledgerEntry.save({ session });
      ledgerEntries.push(ledgerEntry._id);
    }

    newRecurringEntry.relatedLedgerEntries = ledgerEntries;
    await newRecurringEntry.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_RecurringEntry',
      performedBy: req.adminId,
      targetItem: newRecurringEntry._id,
      itemType: 'RecurringEntry',
      userType: 'Admin',
      description: `Manually created recurring entry from template ${template.name}`,
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Recurring journal entry created successfully', recurringEntry: newRecurringEntry });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
