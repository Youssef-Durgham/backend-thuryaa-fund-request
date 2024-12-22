// routes/accounts.js
const express = require('express');
const Account = require('../v2/accounts');
const { Admin } = require('../../model/Users');
const jwt = require('jsonwebtoken');

const checkEntityAccess = require('../../utils/entityAccess');

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


// إنشاء حساب جديد
router.post('/accounts', checkPermission('Create_Account'), async (req, res) => {
  try {
    const { name, type, description } = req.body;
    const entityId = req.entity._id;
    const newAccount = new Account({ name, type, description, entity: entityId });
    await newAccount.save();
    res.status(201).json({ message: 'Account created successfully', account: newAccount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// الحصول على جميع الحسابات
router.get('/accounts', checkPermission('View_Accounts'), async (req, res) => {
  const entityId = req.entity._id; // Extract the entity ID from the request
  try {
    // Filter accounts by the entity field matching the entityId
    const accounts = await Account.find({ entity: entityId });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
