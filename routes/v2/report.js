// Assuming we use Express.js for the backend
const express = require('express');
const FundRequest = require('../../model/v2/FundRequest');
const { Admin } = require('../../model/Users');
const jwt = require('jsonwebtoken');
const Entity = require('../../model/v2/Entity');
const ApprovalWorkflow = require('../../model/v2/ApprovalWorkflow');


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
    // Read query parameters including workflowId
    let {
      page = 1,
      limit = 50,
      search,
      status,
      currency,
      requestFundType,
      fromDate,
      toDate,
      minAmount,
      maxAmount,
      workflowId // new query param for filtering by workflow id
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

    // Filtering by date range on the requestDate field
    if (fromDate || toDate) {
      filter.requestDate = {};
      if (fromDate) {
        filter.requestDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        filter.requestDate.$lte = new Date(toDate);
      }
    }

    // Filtering by amount range
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Filtering by workflow id: lookup the ApprovalWorkflow
    let workflowFilter = {};
    if (workflowId) {
      workflowFilter.assignedWorkflow = workflowId;
    }

    // Get total count for pagination
    const total = await FundRequest.countDocuments(filter);

    // Retrieve fund requests with pagination, sorting, and populate the requestedBy field
    const fundRequests = await FundRequest.find(filter)
      .populate('requestedBy', 'name phone email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // For each fund request, fetch the associated workflow to get current pending approvers
    const fundRequestsWithApprovers = await Promise.all(
      fundRequests.map(async (fundRequest) => {
        // Find the workflow for this fund request
        const workflow = await ApprovalWorkflow.findOne({ 
          transactionId: fundRequest._id,
          ...workflowFilter 
        })
        .populate('steps.approvers', 'name email')
        .lean();

        let currentPendingApprovers = [];
        let currentPendingLevel = null;

        if (workflow && workflow.status === 'Pending') {
          // Find the current step
          const currentStep = workflow.steps.find(
            step => step.level === workflow.currentLevel
          );
          
          if (currentStep && currentStep.status === 'Pending') {
            currentPendingApprovers = currentStep.approvers || [];
            currentPendingLevel = currentStep.level;
          }
        }

        return {
          ...fundRequest,
          currentPendingApprovers,
          currentPendingLevel,
          workflowStatus: workflow ? workflow.status : null
        };
      })
    );

    // If workflowId was provided, filter out requests that don't have matching workflows
    const filteredRequests = workflowId 
      ? fundRequestsWithApprovers.filter(req => req.workflowStatus !== null)
      : fundRequestsWithApprovers;

    res.json({
      total: workflowId ? filteredRequests.length : total,
      page,
      pages: Math.ceil((workflowId ? filteredRequests.length : total) / limit),
      fundRequests: filteredRequests
    });
  } catch (error) {
    console.error("Error fetching fund requests:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get('/fund-requests/statistics', checkPermission('Report'), async (req, res) => {
  try {
    const { workflowId } = req.query;
    let filter = {};
    
    if (workflowId) {
      // Convert the workflowId to an ObjectId to ensure a correct match.
      const assignedWorkflowId = mongoose.Types.ObjectId(workflowId);
      
      // Find all workflows matching the assignedWorkflow id for FundRequests
      const workflows = await ApprovalWorkflow.find({
        assignedWorkflow: assignedWorkflowId,
        transactionType: 'FundRequest'
      });
      
      if (workflows && workflows.length > 0) {
        const transactionIds = workflows.map(wf => wf.transactionId);
        filter._id = { $in: transactionIds };
      } else {
        // No matching workflows found; force the filter to return no results
        filter._id = null;
      }
    }

    // Aggregation by status with filter applied
    const statsByStatus = await FundRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    // Aggregation by currency with filter applied
    const statsByCurrency = await FundRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$currency",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    // Overall statistics with filter applied
    const overallStats = await FundRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    // Calculate extra counts based on status:
    let openCount = 0,
        closedCount = 0,
        canceledCount = 0;

    statsByStatus.forEach(item => {
      switch (item._id) {
        case 'Pending':
        case 'Rejected':
          openCount += item.count;
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

    const overallCount = overallStats[0] ? overallStats[0].totalCount : 0;
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
