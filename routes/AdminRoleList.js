const express = require('express');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Role = require('../model/Role');
const { Admin } = require('../model/Users');

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
    req.adminId = decoded.id; // Store the admin ID in the request object
    next();
  };
};

// Add a new role
router.post('/add-role', checkPermission('add_roles'), async (req, res) => {
  const { name, permissions } = req.body;
  try {
    const role = new Role({ name, permissions });
    await role.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'add_role',
      performedBy: req.adminId,
      targetUser: role._id,
      userType: 'Admin'
    });
    await activityLog.save();

    res.status(201).json({ message: 'Role added successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// List all roles
router.get('/roles', checkPermission('view_roles'), async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Delete a role
router.delete('/delete-role/:roleId', checkPermission('delete_roles'), async (req, res) => {
  const { roleId } = req.params;
  try {
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    await role.remove();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'delete_role',
      performedBy: req.adminId,
      targetUser: role._id,
      userType: 'Admin'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
