const express = require('express');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const { Admin } = require('../model/Users');
const { RoleGroup, Role } = require('../model/Role');
const { sendOtpViaSms } = require('../utils/otpService');
const mongoose = require('mongoose');
const Entity = require('../model/v2/Entity');


const router = express.Router();

// Hardcoded credentials for assigning roles
const HARD_CODED_USER = 'admin';
const HARD_CODED_PASS = 'admin123';

// Middleware to check permissions
const checkPermission = (permission) => {
  return async (req, res, next) => {
    console.log(req.headers.authorization, "by func");
    try {
      const token = req.headers.authorization.split(' ')[1];
      console.log(token);

      const decoded = jwt.verify(token, 'your_jwt_secret');
      console.log(decoded);

      // Find the admin user
      const admin = await Admin.findById(decoded.id).populate('roles');

      if (!admin) {
        return res.status(401).json({ message: 'Unauthorized: User not found' });
      }

      // If the user is a System user, bypass permission checks
      if (admin.type === 'System') {
        console.log('System user detected. Bypassing permission checks.');
        req.adminId = decoded.id; // Store the admin ID in the request object
        return next();
      }

      // Check permissions in directly assigned roles
      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      console.log(permission, token, decoded, admin, hasPermission);

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
      }

      req.adminId = decoded.id; // Store the admin ID in the request object
      next();
    } catch (error) {
      console.log("JWT Verification Error:", error.message);
      console.log(error.stack);
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};


// Middleware to authenticate and extract user ID from JWT token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, "your_jwt_secret");
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

// Create a new role
router.post('/add-role', checkPermission('add_role_group'), async (req, res) => {
  const { name } = req.body;
  try {
    const role = new Role({ name });
    await role.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'add_role',
      performedBy: req.adminId,
      targetUser: role._id,
      userType: 'System',
      itemType: 'Admin-Activitys'
    });
    await activityLog.save();

    res.status(201).json({ message: 'Role added successfully', role });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error });
  }
});

// Add a new role group
router.put('/update-role/:id/permissions', checkPermission('add_roles'), async (req, res) => {
  const { permissions } = req.body;
  const { id } = req.params;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Permissions must be an array' });
  }
  try {
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    role.permissions = permissions;
    await role.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'update_role_permissions',
      performedBy: 'system', // Hardcoded since it's system level
      targetUser: role._id,
      userType: 'System',
      itemType: 'Admin-Activitys'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role updated successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// List all roles
router.get('/roles', checkPermission('view_roles'), async (req, res) => {
  try {
    console.log(req.headers.authorization)
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
      userType: 'System',
      itemType: 'Admin-Activitys'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Assign role group to admin
router.post('/assign-role', checkPermission('assign_roles'), async (req, res) => {
  const { adminId, roleId, entityId } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = await Admin.findById(adminId).session(session);
    if (!admin) {
      throw new Error('Admin not found');
    }

    // Check if admin has access to this entity
    // if (!admin.entities.includes(entityId)) {
    //   throw new Error('Admin does not have access to this entity');
    // }

    // Find or create entity roles entry
    let entityRoleEntry = admin.entityRoles.find(
      entry => entry.entity.toString() === entityId
    );

    if (!entityRoleEntry) {
      entityRoleEntry = {
        entity: entityId,
        roles: [roleId]
      };
      admin.entityRoles.push(entityRoleEntry);
    } else if (!entityRoleEntry.roles.includes(roleId)) {
      entityRoleEntry.roles.push(roleId);
    }

    await admin.save({ session });

    await new ActivityLog({
      action: 'assign_role',
      performedBy: req.adminId,
      targetUser: admin._id,
      targetItem: roleId,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId
    }).save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: 'Role assigned successfully',
      entityRoles: entityRoleEntry 
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error)
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

// Remove role group from admin
router.post('/remove-role', checkPermission('remove_roles'), async (req, res) => {
  const { adminId, roleId } = req.body;
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    admin.roles = admin.roles.filter(role => role.toString() !== roleId);
    await admin.save();

    // Log the role removal
    const activityLog = new ActivityLog({
      action: 'remove_role',
      performedBy: req.adminId,
      targetUser: admin._id,
      userType: 'System',
      itemType: 'Admin-Activitys'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role removed successfully' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error });
  }
});

// API to get permissions by role ID
router.get('/api/roles/:id/permissions', checkPermission('view_roles'), async (req, res) => {
  try {
    console.log(req.params.id)
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json({ permissions: role.permissions });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get the users that have this role 
router.get('/users-by-role/:roleId', checkPermission('view_roles'), async (req, res) => {
  try {
    const roleId = req.params.roleId;
    const entityId = req.query.entityId; // Get entityId from query params

    if (!entityId) {
      return res.status(400).json({ message: 'Entity ID is required.' });
    }

    // Check if the role exists
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found.' });
    }

    // Find Admins assigned to the role within the specific entity
    const admins = await Admin.find(
      {
        entityRoles: {
          $elemMatch: {
            entity: entityId,
            roles: roleId,
          },
        },
      },
      'name phone' // Select only the required fields
    ).exec();

    res.json({ admins });
  } catch (error) {
    console.error('Error fetching users by role and entity:', error);
    res.status(500).json({ message: 'An error occurred while fetching users.' });
  }
});

router.post('/send-sms', async (req, res) => {
  const { phone, otp } = req.body;



  const result = await sendOtpViaSms(phone, otp);


    res.status(200).json(result);

});

// Route to get roles for the authenticated admin
router.get('/admin/roles', authenticate, async (req, res) => {
  try {
    // Fetch the Entity object with code 'C1'
    const entityC1 = await Entity.findOne({ code: 'C1' });
    if (!entityC1) {
      return res.status(404).json({ message: 'Entity with code C1 not found.' });
    }

    // Fetch the admin and populate roles for entity C1
    const admin = await Admin.findById(req.userId)
      .populate('currentEntity')
      .populate({
        path: 'entityRoles',
        match: { entity: entityC1._id }, // Always match to C1's ID
        populate: {
          path: 'roles',
          model: 'Role'
        }
      });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    // Get roles for entity C1
    const entityRoles = admin.entityRoles.find(
      er => er.entity.toString() === entityC1._id.toString()
    );

    let rolesData = [];
    if (entityRoles) {
      rolesData = await Role.find({ _id: { $in: entityRoles.roles } });
    }

    res.json({
      roles: rolesData,
      entity: entityC1, // Return C1's details
      type: admin.type, // Include admin type
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.', error });
  }
});



module.exports = router;
