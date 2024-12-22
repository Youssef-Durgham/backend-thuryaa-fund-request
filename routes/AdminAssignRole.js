const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const { RoleGroup, Role } = require('../model/Role');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const mongoose = require('mongoose');

const router = express.Router();

// Middleware to check permissions
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


// Assign role group to admin
router.post('/assign-role-group', checkPermission('assign_roles'), async (req, res) => {
  const { adminId, groupId, entityId } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [admin, roleGroup] = await Promise.all([
      Admin.findById(adminId).session(session),
      RoleGroup.findById(groupId).populate('roles').session(session)
    ]);

    if (!admin || !roleGroup) {
      throw new Error('Admin or Role group not found');
    }

    // Check if admin has access to this entity
    if (!admin.entities.includes(entityId)) {
      throw new Error('Admin does not have access to this entity');
    }

    // Find or create entity roles entry
    let entityRoleEntry = admin.entityRoles.find(
      entry => entry.entity.toString() === entityId
    );

    if (!entityRoleEntry) {
      entityRoleEntry = {
        entity: entityId,
        roles: []
      };
      admin.entityRoles.push(entityRoleEntry);
    }

    // Add roles from the group if not already present
    roleGroup.roles.forEach(role => {
      if (!entityRoleEntry.roles.includes(role._id)) {
        entityRoleEntry.roles.push(role._id);
      }
    });

    await admin.save({ session });

    await new ActivityLog({
      action: 'assign_role_group',
      performedBy: req.adminId,
      targetUser: admin._id,
      targetItem: roleGroup._id,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId
    }).save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Role group assigned successfully',
      entityRoles: entityRoleEntry 
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
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
      userType: 'System',
      itemType: 'Admin-Activitys',
      roleGroup: groupId
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role group removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

router.get('/users-by-role/:id', async (req, res) => {
  const { id } = req.params;
  const { entityId } = req.query;

  try {
    const role = await Role.findById(id).populate('users');
    if (!role) return res.status(404).json({ message: 'Role not found' });

    let users = role.users;
    if (entityId) {
      users = users.filter(user => user.entities.includes(entityId));
    }

    res.status(200).json({ admins: users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
