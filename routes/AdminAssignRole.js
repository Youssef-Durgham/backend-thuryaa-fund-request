const express = require('express');
const { Admin, Role } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
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

// Assign role to admin
router.post('/assign-role', checkPermission('assign_roles'), async (req, res) => {
    const { adminId, roleId } = req.body;
    try {
      const admin = await Admin.findById(adminId);
      const role = await Role.findById(roleId);
      if (!admin || !role) {
        return res.status(404).json({ message: 'Admin or Role not found' });
      }
      admin.roles.push(roleId);
      await admin.save();
  
      // Log the role assignment
      const activityLog = new ActivityLog({
        action: 'assign_role',
        performedBy: req.adminId,
        targetUser: admin._id,
        userType: 'Admin',
        role: role._id
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Role assigned successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });
  
  // Delete role from admin
  router.post('/delete-role', checkPermission('delete_roles'), async (req, res) => {
    const { adminId, roleId } = req.body;
    try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      admin.roles = admin.roles.filter(role => role.toString() !== roleId);
      await admin.save();
  
      // Log the role deletion
      const activityLog = new ActivityLog({
        action: 'delete_role',
        performedBy: req.adminId,
        targetUser: admin._id,
        userType: 'Admin',
        role: roleId
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Role deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });

module.exports = router;
