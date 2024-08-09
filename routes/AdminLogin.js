const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');
const { RoleGroup, Role } = require('../model/Role');

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

// Create admin account
router.post('/create-admin/sys', checkPermission('Create_admin'), async (req, res) => {
  const { phone, name, password } = req.body;
  try {
    let admin = await Admin.findOne({ phone });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    admin = new Admin({ phone, name, password });
    await admin.save();
    res.status(201).json({ message: 'Admin created successfully', admin });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Create a new role
router.post('/add-role/sys', async (req, res) => {
  const { username, password, name, permissions } = req.body;
  if (username !== HARD_CODED_USER || password !== HARD_CODED_PASS) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const role = new Role({ name, permissions });
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

// Create a new role group
router.post('/add-role-group/sys', async (req, res) => {
  const { username, password, groupName } = req.body;
  if (username !== HARD_CODED_USER || password !== HARD_CODED_PASS) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const roleGroup = new RoleGroup({ groupName });
    await roleGroup.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'add_role_group',
      performedBy: 'system', // Hardcoded since it's system level
      targetUser: roleGroup._id,
      userType: 'system'
    });
    await activityLog.save();

    res.status(201).json({ message: 'Role group added successfully', roleGroup });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// assign role group to user as sys
router.post('/assign-role-to-group/sys', checkPermission('assign_roles'), async (req, res) => {
  const { groupId, roleId, username, password } = req.body;
  if (username !== HARD_CODED_USER || password !== HARD_CODED_PASS) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const roleGroup = await RoleGroup.findById(groupId);
    const role = await Role.findById(roleId);
    if (!roleGroup || !role) {
      return res.status(404).json({ message: 'Role group or Role not found' });
    }
    roleGroup.roles.push(roleId);
    await roleGroup.save();

    // Log the role assignment
    const activityLog = new ActivityLog({
      action: 'assign_role_to_group',
      performedBy: req.adminId,
      targetUser: roleGroup._id,
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role assigned to group successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Assign role to role group
router.post('/assign-role-to-group', checkPermission('assign_roles'), async (req, res) => {
  const { groupId, roleId } = req.body;
  try {
    const roleGroup = await RoleGroup.findById(groupId);
    const role = await Role.findById(roleId);
    if (!roleGroup || !role) {
      return res.status(404).json({ message: 'Role group or Role not found' });
    }
    roleGroup.roles.push(roleId);
    await roleGroup.save();

    // Log the role assignment
    const activityLog = new ActivityLog({
      action: 'assign_role_to_group',
      performedBy: req.adminId,
      targetUser: roleGroup._id,
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role assigned to group successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Assign role group to user directly
router.post('/assign-role-group-direct', async (req, res) => {
  const { username, password, adminId, groupId } = req.body;
  if (username !== HARD_CODED_USER || password !== HARD_CODED_PASS) {
    return res.status(403).json({ message: 'Forbidden' });
  }
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
      performedBy: 'system',
      targetUser: admin._id,
      userType: 'system'
    });
    await activityLog.save();

    res.status(200).json({ message: 'Role group assigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

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
  
      const token = jwt.sign({ id: admin._id, userType: 'admin' }, 'your_jwt_secret', { expiresIn: '365d' });
  
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
router.post('/reset-password', async (req, res) => {
    const { adminId, initialPassword } = req.body;
    try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      admin.oldPassword = admin.password; // Store the old password
      admin.password = initialPassword;
      admin.forcePasswordChange = true; // Add a flag to enforce password change
      await admin.save();
  
      // Log the activity
      const activityLog = new ActivityLog({
        action: 'reset_password',
        performedBy: 'reset_password',
        targetUser: admin._id,
        userType: 'Admin'
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Server error', error });
    }
  });

module.exports = router;
