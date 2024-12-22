// routes/taxes.js
const express = require('express');
const Tax = require('../../model/v2/Tax');
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


// إنشاء ضريبة جديدة
router.post('/taxes', checkPermission('Create_Tax'), async (req, res) => {
  try {
    const { name, rate, description } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const newTax = new Tax({ name, rate, description, entity: entityId });
    await newTax.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Tax',
      performedBy: req.adminId,
      targetItem: newTax._id,
      itemType: 'Tax',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Tax created successfully', tax: newTax });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// الحصول على جميع الضرائب
router.get('/taxes', checkPermission('View_Taxes'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract entity ID from request

    const taxes = await Tax.find({ entity: entityId }); // Filter by entity
    res.status(200).json(taxes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// تحديث ضريبة
router.put('/taxes/:id', checkPermission('Edit_Tax'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rate, description, isActive } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    // Find the tax by ID and ensure it belongs to the current entity
    const tax = await Tax.findOne({ _id: id, entity: entityId });
    if (!tax) {
      return res.status(404).json({ message: 'Tax not found or does not belong to this entity' });
    }

    // Update the tax
    tax.name = name;
    tax.rate = rate;
    tax.description = description;
    tax.isActive = isActive;

    await tax.save();

    // Log activity
    await logActivity({
      action: 'Edit_Tax',
      performedBy: req.adminId,
      targetItem: tax._id,
      itemType: 'Tax',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Tax updated successfully', tax });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// حذف ضريبة (تغيير الحالة إلى غير نشط بدلاً من الحذف الفعلي)
router.delete('/taxes/:id', checkPermission('Delete_Tax'), async (req, res) => {
  try {
    const { id } = req.params;
    const entityId = req.entity._id; // Extract entity ID from request
    const tax = await Tax.findById(id);
    if (!tax) {
      return res.status(404).json({ message: 'Tax not found' });
    }

    tax.isActive = false;
    await tax.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Delete_Tax',
      performedBy: req.adminId,
      targetItem: tax._id,
      itemType: 'Tax',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Tax deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
