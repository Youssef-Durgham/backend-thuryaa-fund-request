// routes/journalTemplates.js
const express = require('express');
const JournalTemplate = require('../../model/v2/JournalTemplate');
const logActivity = require('../../utils/activityLogger');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const Account = require('../../model/v2/Account');
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



router.post('/journal-templates', checkPermission('Create_JournalTemplate'), async (req, res) => {
  try {
    const { name, description, entries, frequency, nextRunDate } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const newTemplate = new JournalTemplate({
      name,
      description,
      entries,
      frequency,
      nextRunDate,
      createdBy: req.adminId,
      entity: entityId
    });

    await newTemplate.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_JournalTemplate',
      performedBy: req.adminId,
      targetItem: newTemplate._id,
      itemType: 'JournalTemplate',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Journal template created successfully', template: newTemplate });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/journal-templates', checkPermission('View_JournalTemplates'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const templates = await JournalTemplate.find({ entity: entityId }) // Filter by entity
      .populate('createdBy', 'name');

    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/journal-templates/:id', checkPermission('Edit_JournalTemplate'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, entries, frequency, nextRunDate } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const updatedTemplate = await JournalTemplate.findByIdAndUpdate(
      id,
      { name, description, entries, frequency, nextRunDate },
      { new: true, runValidators: true }
    );

    if (!updatedTemplate) {
      return res.status(404).json({ message: 'Journal template not found' });
    }

    // تسجيل النشاط
    await logActivity({
      action: 'Edit_JournalTemplate',
      performedBy: req.adminId,
      targetItem: updatedTemplate._id,
      itemType: 'JournalTemplate',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Journal template updated successfully', template: updatedTemplate });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/journal-templates/:id', checkPermission('Delete_JournalTemplate'), async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = req.entity._id; // Extract entity ID from request
    const template = await JournalTemplate.findById(id);
    if (!template) {
      return res.status(404).json({ message: 'Journal template not found' });
    }

    template.isActive = false;
    await template.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Delete_JournalTemplate',
      performedBy: req.adminId,
      targetItem: template._id,
      itemType: 'JournalTemplate',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Journal template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// إنشاء قالب دفتر يومية مع إدخالات معقدة
router.post('/journal-templates/complex', checkPermission('Create_ComplexJournalTemplate'), async (req, res) => {
    try {
      const { name, description, frequency, complexEntries, nextRunDate } = req.body;
      const entityId = req.entity._id; // Extract entity ID from request
  
      // التحقق من وجود الحسابات
      for (const entry of complexEntries) {
        for (const acc of entry.accounts) {
          const account = await Account.findById(acc.account);
          if (!account) {
            return res.status(400).json({ message: `Account with ID ${acc.account} not found.` });
          }
        }
      }
  
      const journalTemplate = new JournalTemplate({
        name,
        description,
        frequency,
        complexEntries,
        nextRunDate,
        createdBy: req.adminId,
        entity: entityId
      });
  
      await journalTemplate.save();
  
      // تسجيل النشاط
      await logActivity({
        action: 'Create_ComplexJournalTemplate',
        performedBy: req.adminId,
        targetItem: journalTemplate._id,
        itemType: 'JournalTemplate',
        userType: 'Admin',
        description: `Created Complex Journal Template ${name}`,
        entity: entityId
      });
  
      res.status(201).json({ message: 'Complex Journal Template created successfully', journalTemplate });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // الحصول على قائمة القوالب المعقدة
  router.get('/journal-templates/complex', checkPermission('View_ComplexJournalTemplates'), async (req, res) => {
    try {
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const journalTemplates = await JournalTemplate.find({
        entity: entityId, // Filter by entity
        'complexEntries.0': { $exists: true } // Ensure complex entries exist
      })
        .populate('complexEntries.accounts.account', 'name type')
        .populate('createdBy', 'name');
  
      res.status(200).json(journalTemplates);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

module.exports = router;
