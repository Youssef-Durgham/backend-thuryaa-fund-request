const express = require('express');
const { Admin, Customer } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const { Role } = require('../model/Role');

const router = express.Router();

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

// Get customer User List
router.get('/customers-list', async (req, res) => {
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const customers = await Customer.find()
                                    .skip(skip)
                                    .limit(limit)
                                    .sort({ name: 1 }); // Optional: Sort by name ascending

    const totalCustomers = await Customer.countDocuments();
    const totalPages = Math.ceil(totalCustomers / limit);

    res.status(200).json({
      customers,
      currentPage: page,
      totalPages,
      totalCustomers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Activity Log For Customer As List
router.get('/activity-log/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const logs = await ActivityLog.find({ targetUser: customerId, userType: 'Customer' })
                                  .skip(skip)
                                  .limit(limit)
                                  .sort({ timestamp: -1 }); // Optional: Sort by timestamp descending

    const totalLogs = await ActivityLog.countDocuments({ targetUser: customerId, userType: 'Customer' });
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

// Get login history entries based on customer ID with pagination
router.get('/login-history/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const { page = 1 } = req.query; // Default to page 1 if not specified

  const limit = 50; // Entries per page
  const skip = (page - 1) * limit;

  try {
    const logs = await LoginHistory.find({ userId: customerId })
                                   .skip(skip)
                                   .limit(limit)
                                   .sort({ loginTime: -1 }); // Optional: Sort by login time descending

    const totalLogs = await LoginHistory.countDocuments({ userId: customerId });
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

// Search customers by phone or name
router.get('/search-customers', checkPermission('create_order'), async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const customers = await Customer.find({
      $or: [
        { phone: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    }).select('_id phone name'); // Include _id along with phone and name

    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while searching for customers' });
  }
});
  
  module.exports = router;
  