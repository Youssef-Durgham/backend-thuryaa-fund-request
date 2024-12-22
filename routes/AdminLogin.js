const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');
const { RoleGroup, Role } = require('../model/Role');
const mongoose = require('mongoose');
const JWT_SECRET = 'your_jwt_secret';

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

// Create admin account
router.post('/create-admin/sys', checkPermission('Create_admin'), async (req, res) => {
  const { phone, name, password, email, type } = req.body;
  try {
    let admin = await Admin.findOne({ phone });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    admin = new Admin({ phone, name, password, email, type });
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
      userType: 'System',
      itemType: 'Admin-Activitys'
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
      userType: 'System',
      itemType: 'Admin-Activitys'
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
      userType: 'System',
      itemType: 'Admin-Activitys'
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
      userType: 'System',
      itemType: 'Admin-Activitys'
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
      userType: 'System',
      itemType: 'Admin-Activitys'
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
  const session = await mongoose.startSession();
  session.startTransaction();

  let transactionCommitted = false;

  try {
    const admin = await Admin.findOne({ phone })
      .populate('entities')
      .populate('roles')
      .session(session);

    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      throw new Error('Invalid phone or password');
    }

    // Handle password change if required
    if (admin.forcePasswordChange) {
      if (!newPassword) {
        throw new Error('Password change required');
      }
      if (await bcrypt.compare(newPassword, admin.oldPassword)) {
        throw new Error('New password cannot be same as old password');
      }
      admin.oldPassword = admin.password;
      admin.password = await bcrypt.hash(newPassword, 10);
      admin.forcePasswordChange = false;
    }

    await admin.save({ session });

    const token = jwt.sign({
      id: admin._id,
      userType: 'admin',
      phone: admin.phone,
      name: admin.name,
    }, JWT_SECRET, { expiresIn: '365d' });

    // Log the login
    await Promise.all([
      new LoginHistory({
        userId: admin._id,
        ipAddress: req.ip,
      }).save({ session }),

      new ActivityLog({
        action: 'login',
        performedBy: admin._id,
        targetUser: admin._id,
        userType: 'System',
        itemType: 'Admin-Activitys'
      }).save({ session })
    ]);

    await session.commitTransaction();
    transactionCommitted = true;

    res.status(200).json({
      token,
      // entities: activeEntities, // Uncomment if activeEntities logic is added back
      // currentEntity: await Entity.findById(admin.currentEntity), // Uncomment if currentEntity is required
      user: {
        id: admin._id,
        name: admin.name,
        phone: admin.phone,
        roles: admin.roles
      }
    });
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
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
        userType: 'System',
        itemType: 'Admin-Activitys'
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Server error', error });
    }
  });

  router.get('/AdminLogin/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
  
    try {
      // Verify the token
      const decoded = jwt.verify(token, 'your_jwt_secret');
  
      // Find the admin in the database
      const admin = await Admin.findById(decoded.id).select('-password');
  
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
  
      // Check if the admin needs to change their password
      if (admin.forcePasswordChange) {
        return res.status(403).json({ message: 'Password change required', forcePasswordChange: true });
      }
  
      // Token is valid and admin exists
      res.json({
        message: 'Token is valid',
        admin: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          roles: admin.roles
        }
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      console.error('Error in /AdminLogin/verify:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

module.exports = router;
