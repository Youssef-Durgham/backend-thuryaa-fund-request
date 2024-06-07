const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();

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

// Get Admin User List
router.get('/admin-users-list', checkPermission('List_Admin_Users'), async (req, res) => {
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const admins = await Admin.find()
                              .populate('roles')
                              .skip(skip)
                              .limit(limit)
                              .sort({ name: 1 }); // Optional: Sort by name ascending

    const totalAdmins = await Admin.countDocuments();
    const totalPages = Math.ceil(totalAdmins / limit);

    res.status(200).json({
      admins,
      currentPage: page,
      totalPages,
      totalAdmins
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

  // Get activity log entries based on user ID with pagination
router.get('/activity-log/:userId', async (req, res) => {
  const { userId } = req.params;
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const logs = await ActivityLog.find({ targetUser: userId })
                                  .skip(skip)
                                  .limit(limit)
                                  .sort({ timestamp: -1 }); // Optional: Sort by timestamp descending

    const totalLogs = await ActivityLog.countDocuments({ targetUser: userId });
    const totalPages = Math.ceil(totalLogs / limit);

    res.status(200).json({
      logs,
      currentPage: page,
      totalPages,
      totalLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get login history entries based on admin ID with pagination
router.get('/login-history/:adminId', async (req, res) => {
  const { adminId } = req.params;
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const logs = await LoginHistory.find({ userId: adminId })
                                   .skip(skip)
                                   .limit(limit)
                                   .sort({ loginTime: -1 }); // Optional: Sort by login time descending

    const totalLogs = await LoginHistory.countDocuments({ userId: adminId });
    const totalPages = Math.ceil(totalLogs / limit);

    res.status(200).json({
      logs,
      currentPage: page,
      totalPages,
      totalLogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
  
  module.exports = router;
  