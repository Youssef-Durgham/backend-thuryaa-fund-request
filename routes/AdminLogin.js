const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();

// Middleware to check permissions
const checkPermission = (permission) => {
    return async (req, res, next) => {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate('roles');
      const hasPermission = admin.roles.some(role => role.permissions.includes(permission));
      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      next();
    };
  };

// Admin registration
router.post('/register/admin', async (req, res) => {
  const { phone, name, password, roles } = req.body;
  try {
    let admin = await Admin.findOne({ phone });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    admin = new Admin({ phone, name, password, roles });
    await admin.save();
    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Admin login
router.post('/login/admin', async (req, res) => {
    const { phone, password, newPassword } = req.body;
    try {
      const admin = await Admin.findOne({ phone });
      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(400).json({ message: 'Invalid phone or password' });
      }
      if (admin.forcePasswordChange && newPassword) {
        if (await bcrypt.compare(newPassword, admin.oldPassword)) {
          return res.status(400).json({ message: 'New password cannot be the same as the old password' });
        }
        admin.oldPassword = admin.password;
        admin.password = await bcrypt.hash(newPassword, 10);
        admin.forcePasswordChange = false;
        await admin.save();
      } else if (admin.forcePasswordChange) {
        return res.status(403).json({ message: 'Password change required' });
      }
  
      const token = jwt.sign({ id: admin._id, userType: 'admin' }, 'your_jwt_secret', { expiresIn: '1h' });
  
      // Log the login
      const loginHistory = new LoginHistory({
        userId: admin._id,
        ipAddress: req.ip
      });
      await loginHistory.save();
  
      // Log the activity
      const activityLog = new ActivityLog({
        action: 'login',
        performedBy: admin._id,
        targetUser: admin._id,
        userType: 'Admin'
      });
      await activityLog.save();
  
      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });

// Reset admin password
router.post('/reset-password', checkPermission('reset_passwords'), async (req, res) => {
    const { adminId, initialPassword } = req.body;
    try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      admin.oldPassword = admin.password; // Store the old password
      admin.password = await bcrypt.hash(initialPassword, 10);
      admin.forcePasswordChange = true; // Add a flag to enforce password change
      await admin.save();
  
      // Log the activity
      const activityLog = new ActivityLog({
        action: 'reset_password',
        performedBy: req.adminId,
        targetUser: admin._id,
        userType: 'Admin'
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });

module.exports = router;
