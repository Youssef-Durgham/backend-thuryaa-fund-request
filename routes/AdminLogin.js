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

      // Find the admin user - populate both roles and entityRoles.roles
      const admin = await Admin.findById(decoded.id)
        .populate('roles')
        .populate({ path: 'entityRoles.roles' });

      if (!admin) {
        return res.status(401).json({ message: 'غير مصرح: المستخدم غير موجود' });
      }

      // If the user is a System user, bypass permission checks
      if (admin.type === 'System') {
        console.log('System user detected. Bypassing permission checks.');
        req.adminId = decoded.id; // Store the admin ID in the request object
        return next();
      }

      // Check permissions in directly assigned roles
      let hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      // Also check permissions in entityRoles (v2 entity-based roles)
      if (!hasPermission) {
        hasPermission = admin.entityRoles.some(entityRole =>
          entityRole.roles.some(role => role.permissions && role.permissions.includes(permission))
        );
      }

      console.log(permission, token, decoded, admin, hasPermission);

      if (!hasPermission) {
        return res.status(403).json({ message: 'محظور: صلاحيات غير كافية' });
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
  const { email, name, password, phone, type, department } = req.body;
  try {
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'المشرف موجود بالفعل' });
    }
    admin = new Admin({ email, name, password, phone, type, department });
    await admin.save();
    // Return admin without password
    const adminObj = admin.toObject();
    delete adminObj.password;
    res.status(201).json({ message: 'تم إنشاء المشرف بنجاح', admin: adminObj });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
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

    res.status(201).json({ message: 'تمت إضافة الصلاحية بنجاح', role });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
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

    res.status(201).json({ message: 'تمت إضافة مجموعة الصلاحيات بنجاح', roleGroup });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
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
      return res.status(404).json({ message: 'مجموعة الصلاحيات أو الصلاحية غير موجودة' });
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

    res.status(200).json({ message: 'تم تعيين الصلاحية للمجموعة بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
  }
});

// Assign role to role group
router.post('/assign-role-to-group', checkPermission('assign_roles'), async (req, res) => {
  const { groupId, roleId } = req.body;
  try {
    const roleGroup = await RoleGroup.findById(groupId);
    const role = await Role.findById(roleId);
    if (!roleGroup || !role) {
      return res.status(404).json({ message: 'مجموعة الصلاحيات أو الصلاحية غير موجودة' });
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

    res.status(200).json({ message: 'تم تعيين الصلاحية للمجموعة بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
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
      return res.status(404).json({ message: 'المشرف أو مجموعة الصلاحيات غير موجودة' });
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

    res.status(200).json({ message: 'تم تعيين مجموعة الصلاحيات بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
  }
});

// Admin registration
router.post('/register/admin', async (req, res) => {
  const { email, name, password, roles, phone, department } = req.body;
  try {
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'المشرف موجود بالفعل' });
    }
    admin = new Admin({ email, name, password, roles, phone, department });
    await admin.save();
    res.status(201).json({ message: 'تم تسجيل المشرف بنجاح' });
  } catch (error) {
    res.status(500).json({ message: 'خطأ في الخادم', error });
  }
});

// ✅ FIX: Admin login - removed MongoDB transaction (requires replica set)
// and fixed error status codes
router.post('/login/admin', async (req, res) => {
  const { email, password, newPassword } = req.body;

  try {
    const admin = await Admin.findOne({ email })
      .populate('entities')
      .populate('roles');

    if (!admin) {
      return res.status(401).json({ message: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'بريد إلكتروني أو كلمة مرور غير صحيحة' });
    }

    // Handle password change if required
    if (admin.forcePasswordChange) {
      if (!newPassword) {
        return res.status(403).json({ 
          message: 'يجب تغيير كلمة المرور',
          forcePasswordChange: true 
        });
      }
      if (await bcrypt.compare(newPassword, admin.oldPassword)) {
        return res.status(400).json({ message: 'كلمة المرور الجديدة لا يمكن أن تكون نفس القديمة' });
      }
      admin.oldPassword = admin.password;
      admin.password = newPassword; // pre-save hook will hash it
      admin.forcePasswordChange = false;
      await admin.save();
    }

    const token = jwt.sign({
      id: admin._id,
      userType: 'admin',
      email: admin.email,
      name: admin.name,
    }, JWT_SECRET, { expiresIn: '365d' });

    // Log the login (non-blocking, don't let logging failure break login)
    try {
      await Promise.all([
        new LoginHistory({
          userId: admin._id,
          ipAddress: req.ip,
        }).save(),

        new ActivityLog({
          action: 'login',
          performedBy: admin._id,
          targetUser: admin._id,
          userType: 'System',
          itemType: 'Admin-Activitys'
        }).save()
      ]);
    } catch (logError) {
      console.error('Failed to log login activity:', logError);
      // Don't fail the login just because logging failed
    }

    res.status(200).json({
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        department: admin.department,
        roles: admin.roles
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});


// Reset admin password
router.post('/reset-password', async (req, res) => {
    const { adminId, initialPassword } = req.body;
    try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'المشرف غير موجود' });
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
  
      res.status(200).json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'خطأ في الخادم', error });
    }
  });

  router.get('/AdminLogin/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ message: 'لم يتم توفير الرمز' });
    }
  
    try {
      // Verify the token
      const decoded = jwt.verify(token, 'your_jwt_secret');
  
      // Find the admin in the database
      const admin = await Admin.findById(decoded.id).select('-password');
  
      if (!admin) {
        return res.status(404).json({ message: 'المشرف غير موجود' });
      }
  
      // Check if the admin needs to change their password
      if (admin.forcePasswordChange) {
        return res.status(403).json({ message: 'يجب تغيير كلمة المرور', forcePasswordChange: true });
      }
  
      // Token is valid and admin exists
      res.json({
        message: 'الرمز صالح',
        admin: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          roles: admin.roles
        }
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'رمز غير صالح' });
      }
      console.error('Error in /AdminLogin/verify:', error);
      res.status(500).json({ message: 'خطأ داخلي في الخادم' });
    }
  });

  // Endpoint to reset an admin's password
router.post('/AdminLogin/reset-password', async (req, res) => {
  const { adminId, newPassword } = req.body;

  // Ensure required fields are provided
  if (!adminId || !newPassword) {
    return res.status(400).json({ message: 'حقول مطلوبة مفقودة' });
  }

  try {
    // Find the admin by provided adminId
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: 'المشرف غير موجود' });
    }

    // Update password (the pre-save hook will hash it)
    admin.password = newPassword;

    // Reset the forcePasswordChange flag
    admin.forcePasswordChange = false;
    
    // Save the updated admin document
    await admin.save();

    res.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
  } catch (error) {
    console.error("Error in /AdminLogin/reset-password:", error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
});


module.exports = router;
