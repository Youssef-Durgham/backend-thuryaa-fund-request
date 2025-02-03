// Assuming we use Express.js for the backend
const express = require('express');
const FundRequest = require('../../model/v2/FundRequest');
const { Admin } = require('../../model/Users');
const jwt = require('jsonwebtoken');
const Entity = require('../../model/v2/Entity');


const router = express.Router();

// Utility to check permissions

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate({
        path: 'entityRoles.roles',
      });

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      if (admin.type === 'System') {
        req.adminId = decoded.id;
        return next();
      }

      // Fetch the entity with code 'C1'
      const entityC1 = await Entity.findOne({ code: 'C1' });
      if (!entityC1) {
        return res.status(404).json({ message: 'Entity with code C1 not found' });
      }

      // Check if the admin has roles and permissions associated with entity C1
      const hasPermission = admin.entityRoles.some(entityRole => {
        // Match the entity
        if (entityRole.entity.toString() !== entityC1._id.toString()) {
          return false;
        }
        // Check for the permission in the roles
        return entityRole.roles.some(role => role.permissions.includes(permission));
      });

      console.log('Has Permission:', hasPermission);
      console.log('Admin:', admin);

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id;
      next();
    } catch (error) {
      console.error('Permission Check Error:', error.message);
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};


router.get('/fund-requests', checkPermission('Report'), async (req, res) => {
    try {
      // Read query parameters
      let {
        page = 1,
        limit = 50,
        search,
        status,
        currency,
        requestFundType,
        fromDate,
        toDate
      } = req.query;
      
      page = parseInt(page);
      limit = parseInt(limit);
  
      // Build the filter object
      const filter = {};
  
      // Filtering by exact fields
      if (status) {
        filter.status = status;
      }
      if (currency) {
        filter.currency = currency;
      }
      if (requestFundType) {
        filter.requestFundType = requestFundType;
      }
  
      // Filtering by a date range on the requestDate field
      if (fromDate || toDate) {
        filter.requestDate = {};
        if (fromDate) {
          filter.requestDate.$gte = new Date(fromDate);
        }
        if (toDate) {
          filter.requestDate.$lte = new Date(toDate);
        }
      }
  
      // If search is provided, search in specific text fields (e.g. uniqueCode and description)
      if (search) {
        filter.$or = [
          { uniqueCode: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
  
      // Get total count for pagination
      const total = await FundRequest.countDocuments(filter);
  
      // Retrieve fund requests with pagination and sorting (most recent first)
      const fundRequests = await FundRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
  
      res.json({
        total,
        page,
        pages: Math.ceil(total / limit),
        fundRequests
      });
    } catch (error) {
      console.error("Error fetching fund requests:", error);
      res.status(500).json({ message: "Server Error" });
    }
  });


router.get('/fund-requests/statistics', checkPermission('Report'), async (req, res) => {
    try {
      // 1. Aggregation by status (to get counts and total amounts per status)
      const statsByStatus = await FundRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]);
  
      // 2. Aggregation by currency (to get counts and total amounts per currency)
      const statsByCurrency = await FundRequest.aggregate([
        {
          $group: {
            _id: "$currency",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]);
  
      // 3. Overall statistics (total count and total amount)
      const overallStats = await FundRequest.aggregate([
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ]);
  
      // 4. Calculate extra counts based on status:
      //    - open:    Pending fund requests.
      //    - closed:  Approved and Rejected requests.
      //    - canceled: Canceled requests.
      //    - counted: Overall total (same as overallStats totalCount)
      let openCount = 0,
          closedCount = 0,
          canceledCount = 0;
  
      statsByStatus.forEach(item => {
        switch (item._id) {
          case 'Pending':
          case 'Rejected':
            openCount = item.count;
            break;
          case 'Approved':
            closedCount += item.count;
            break;
          case 'Canceled':
            canceledCount = item.count;
            break;
          default:
            break;
        }
      });
  
      // Use the overallStats result for "counted"
      const overallCount = overallStats[0] ? overallStats[0].totalCount : 0;
  
      // Prepare the extra statusCounts object
      const statusCounts = {
        open: openCount,
        closed: closedCount,
        canceled: canceledCount,
        counted: overallCount
      };
  
      res.json({
        overall: overallStats[0] || { totalCount: 0, totalAmount: 0 },
        byStatus: statsByStatus,
        byCurrency: statsByCurrency,
        statusCounts
      });
    } catch (error) {
      console.error("Error generating statistics:", error);
      res.status(500).json({ message: "Server Error" });
    }
  });
  

  module.exports = router;
