const express = require('express');
const { Admin, Customer } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();

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
  
  module.exports = router;
  