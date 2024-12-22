// routes/activityLogs.js
const express = require('express');
const ActivityLog = require('../../model/ActivityLog');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const jwt = require('jsonwebtoken');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);

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


router.get('/activity-logs', checkPermission('View_ActivityLogs'), async (req, res) => {
  try {
    const { action, itemType, userType, startDate, endDate } = req.query;
    const entityId = req.entity._id; // Extract the entity ID from the request
    const filter = { entity: entityId }; // Include entity filter

    // Add filters based on query parameters
    if (action) filter.action = action;
    if (itemType) filter.itemType = itemType;
    if (userType) filter.userType = userType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await ActivityLog.find(filter)
      .populate('performedBy', 'name')
      .populate('targetUser', 'name')
      .populate('targetItem');

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
