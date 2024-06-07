const express = require('express');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const { Admin } = require('../model/Users');
const { RoleGroup, Role } = require('../model/Role');
const { sendOtpViaSms } = require('../utils/otpService');


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
      console.log(permission, token, decoded);

      const admin = await Admin.findById(decoded.id).populate('roles');

      // Check permissions in directly assigned roles
      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      console.log(permission, token, decoded, admin, hasPermission);

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
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

// Create a new role
router.post('/add-role', checkPermission('add_role_group'), async (req, res) => {
  const { name } = req.body;
  try {
    const role = new Role({ name });
    await role.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'add_role',
      performedBy: 'system', // Hardcoded since it's system level
      targetUser: role._id,
      userType: 'system'
    });
    await activityLog.save();

    res.status(201).json({ message: 'Role added successfully', role });
  } catch (error) {
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
      userType: 'system'
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
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Assign role group to admin
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
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
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
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role removed successfully' });
  } catch (error) {
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
router.get('/users-by-role/:roleId' , checkPermission('view_roles'), async (req, res) => {
  try {
    const roleId = req.params.roleId;

    // Find the role
    const role = await Role.findById(roleId);
    console.log(role, roleId)
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Find Admins with the role
const admins = await Admin.find({ roles: roleId }, 'name phone').exec();
    console.log(admins)
    // Since Customers don't have roles directly, only Admins will be fetched
    const result = {
      admins,
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/send-sms', async (req, res) => {
  const { phone, otp } = req.body;



  const result = await sendOtpViaSms(phone, otp);


    res.status(200).json(result);

});



module.exports = router;
