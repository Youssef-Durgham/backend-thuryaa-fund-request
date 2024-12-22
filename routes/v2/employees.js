// routes/employees.js
const express = require('express');
const Employee = require('../../model/v2/Employee');
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


router.post('/employees', checkPermission('Create_Employee'), async (req, res) => {
  try {
    const { name, position, salary, bankAccountId } = req.body;
    const entityId = req.entity._id;

    const newEmployee = new Employee({
      name,
      position,
      salary,
      bankAccount: bankAccountId,
      createdBy: req.adminId,
      entity: entityId
    });

    await newEmployee.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Employee',
      performedBy: req.adminId,
      targetItem: newEmployee._id,
      itemType: 'Employee',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Employee created successfully', employee: newEmployee });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/employees', checkPermission('View_Employees'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const employees = await Employee.find({ entity: entityId }) // Filter by entity
      .populate('bankAccount', 'name');

    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
