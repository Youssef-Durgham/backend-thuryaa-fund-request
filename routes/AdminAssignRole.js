const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const { RoleGroup, Role } = require('../model/Role');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();

// Middleware to check permissions
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate({
        path: 'roleGroups',
        populate: { path: 'roles' }
      }).populate('roles');

      // Check permissions in role groups
      const hasGroupPermission = admin.roleGroups.some(group =>
        group.roles.some(role => role.permissions.includes(permission))
      );

      // Check permissions in directly assigned roles
      const hasDirectPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      if (!hasGroupPermission && !hasDirectPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id; // Store the admin ID in the request object
      next();
    } catch (error) {
      res.status(401).json({ message: 'Unauthorized', error });
    }
  };
};

// Assign role group to admin
router.post('/assign-role-group', checkPermission('assign_roles'), async (req, res) => {
  const { adminId, groupId } = req.body;
  try {
    const admin = await Admin.findById(adminId);
    const roleGroup = await RoleGroup.findById(groupId).populate('roles');
    if (!admin || !roleGroup) {
      return res.status(404).json({ message: 'Admin or Role group not found' });
    }
    admin.roleGroups.push(groupId);
    await admin.save();

    // Log the role group assignment
    const activityLog = new ActivityLog({
      action: 'assign_role_group',
      performedBy: req.adminId,
      targetUser: admin._id,
      userType: 'Admin',
      roleGroup: roleGroup._id
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role group assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Remove role group from admin
router.post('/remove-role-group', checkPermission('delete_roles'), async (req, res) => {
  const { adminId, groupId } = req.body;
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    admin.roleGroups = admin.roleGroups.filter(group => group.toString() !== groupId);
    await admin.save();

    // Log the role group removal
    const activityLog = new ActivityLog({
      action: 'remove_role_group',
      performedBy: req.adminId,
      targetUser: admin._id,
      userType: 'Admin',
      roleGroup: groupId
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role group removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
