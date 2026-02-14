const express = require('express');
const Department = require('../../model/v2/Department');
const { Admin } = require('../../model/Users');
const logActivity = require('../../utils/activityLogger');
const jwt = require('jsonwebtoken');
const Entity = require('../../model/v2/Entity');

const router = express.Router();

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate({
        path: 'entityRoles.roles',
      });

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      if (admin.type === 'System') {
        req.adminId = decoded.id;
        return next();
      }

      const entityC1 = await Entity.findOne({ code: 'C1' });
      if (!entityC1) {
        return res.status(404).json({ message: 'Entity with code C1 not found' });
      }

      const hasPermission = admin.entityRoles.some(entityRole => {
        if (entityRole.entity.toString() !== entityC1._id.toString()) return false;
        return entityRole.roles.some(role => role.permissions.includes(permission));
      });

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};

// Create department
router.post('/', checkPermission('Create_Department'), async (req, res) => {
  try {
    const { name } = req.body;

    const existing = await Department.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: 'القسم موجود بالفعل.' });
    }

    const department = new Department({
      name,
      createdBy: req.adminId
    });

    await department.save();

    await logActivity({
      action: 'Create_Department',
      performedBy: req.adminId,
      targetItem: department._id,
      itemType: 'Department',
      userType: 'Admin',
      description: `Created department: ${name}`
    });

    res.status(201).json({ message: 'تم إنشاء القسم بنجاح.', department });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all departments
router.get('/', checkPermission('View_Departments'), async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('createdBy', 'name')
      .sort({ name: 1 });

    res.status(200).json({ departments });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update department
router.put('/:id', checkPermission('Create_Department'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const department = await Department.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    if (!department) {
      return res.status(404).json({ message: 'القسم غير موجود.' });
    }

    res.status(200).json({ message: 'تم تحديث القسم بنجاح.', department });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete department
router.delete('/:id', checkPermission('Create_Department'), async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'القسم غير موجود.' });
    }

    res.status(200).json({ message: 'تم حذف القسم بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
