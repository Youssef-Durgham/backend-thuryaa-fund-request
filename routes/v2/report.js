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
    // Read query parameters including workflowId, requestedBy and pendingApproverId
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
      workflowId,
      requestedBy, // Filter by user who made the request
      pendingApproverId // Filter by pending approver
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // Build the filter object
    const filter = {};

    // Filter by requestedBy (user who made the request)
    if (requestedBy) {
      filter.requestedBy = requestedBy;
    }

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
    if (workflowId) {
      // Find all workflows that have the given assignedWorkflow id
      const workflows = await ApprovalWorkflow.find({
        assignedWorkflow: workflowId
      });
      
      if (workflows && workflows.length > 0) {
        // Extract all matching FundRequest transaction ids
        const transactionIds = workflows.map(wf => wf.transactionId);
        filter._id = { $in: transactionIds };
      } else {
        // If no matching workflows are found, set a filter that returns no documents
        filter._id = null;
      }
    }

    // Filter by pending approver - FIXED LOGIC
    if (pendingApproverId) {
      console.log('Filtering by pending approver:', pendingApproverId);
      
      // Find all pending workflows
      const pendingWorkflows = await ApprovalWorkflow.find({
        status: 'Pending'
      }).populate('steps.approvers');

      // Filter to only those where the user is a pending approver at the current level
      const relevantWorkflows = [];
      
      for (const workflow of pendingWorkflows) {
        // Find the current step
        const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
        
        if (currentStep && currentStep.status === 'Pending') {
          // Check if the user is in the current step's approvers
          const isApprover = currentStep.approvers.some(approver => {
            const approverId = approver._id ? approver._id.toString() : approver.toString();
            return approverId === pendingApproverId;
          });
          
          if (isApprover) {
            relevantWorkflows.push(workflow);
          }
        }
      }

      console.log(`Found ${relevantWorkflows.length} workflows pending approval from user ${pendingApproverId}`);

      if (relevantWorkflows.length > 0) {
        const pendingTransactionIds = relevantWorkflows.map(wf => wf.transactionId);
        
        // If we already have a filter on _id from workflowId, we need to intersect
        if (filter._id && filter._id.$in) {
          const existingIds = filter._id.$in.map(id => id.toString());
          const newIds = pendingTransactionIds.map(id => id.toString());
          const intersectedIds = existingIds.filter(id => newIds.includes(id));
          
          if (intersectedIds.length > 0) {
            filter._id = { $in: intersectedIds.map(id => mongoose.Types.ObjectId(id)) };
          } else {
            filter._id = null; // No intersection found
          }
        } else {
          filter._id = { $in: pendingTransactionIds };
        }
      } else {
        // No matching workflows found - return empty results
        filter._id = null;
      }
    }

    // If search is provided, search in specific text fields
    if (search) {
      const numericSearch = parseFloat(search);
      if (!isNaN(numericSearch)) {
        filter.$or = [
          { uniqueCode: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { amount: numericSearch }
        ];
      } else {
        filter.$or = [
          { uniqueCode: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
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
          transactionId: fundRequest._id
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

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      fundRequests: fundRequestsWithApprovers
    });
  } catch (error) {
    console.error("Error fetching fund requests:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.get('/fund-requests/statistics', checkPermission('Report'), async (req, res) => {
  try {
    const { workflowId, requestedBy, pendingApproverId } = req.query;
    let filter = {};
    
    // Filter by requestedBy for statistics
    if (requestedBy) {
      filter.requestedBy = requestedBy;
    }
    
    // Handle workflow filtering
    let workflowTransactionIds = null;
    if (workflowId) {
      // Convert the workflowId to an ObjectId to ensure a correct match
      const assignedWorkflowId = mongoose.Types.ObjectId(workflowId);
      
      // Find all workflows matching the assignedWorkflow id for FundRequests
      const workflows = await ApprovalWorkflow.find({
        assignedWorkflow: assignedWorkflowId,
        transactionType: 'FundRequest'
      });
      
      if (workflows && workflows.length > 0) {
        workflowTransactionIds = workflows.map(wf => wf.transactionId);
      } else {
        // No matching workflows found; force the filter to return no results
        filter._id = null;
      }
    }
    
    // Handle pending approver filtering - FIXED LOGIC
    let pendingApproverTransactionIds = null;
    if (pendingApproverId) {
      console.log('Statistics: Filtering by pending approver:', pendingApproverId);
      
      // Find all pending workflows
      const pendingWorkflows = await ApprovalWorkflow.find({
        status: 'Pending'
      }).populate('steps.approvers');

      // Filter to only those where the user is a pending approver at the current level
      const relevantWorkflows = [];
      
      for (const workflow of pendingWorkflows) {
        // Find the current step
        const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
        
        if (currentStep && currentStep.status === 'Pending') {
          // Check if the user is in the current step's approvers
          const isApprover = currentStep.approvers.some(approver => {
            const approverId = approver._id ? approver._id.toString() : approver.toString();
            return approverId === pendingApproverId;
          });
          
          if (isApprover) {
            relevantWorkflows.push(workflow);
          }
        }
      }

      console.log(`Statistics: Found ${relevantWorkflows.length} workflows pending approval from user ${pendingApproverId}`);

      if (relevantWorkflows.length > 0) {
        pendingApproverTransactionIds = relevantWorkflows.map(wf => wf.transactionId);
      } else {
        // No matching workflows found
        filter._id = null;
      }
    }
    
    // Combine workflow and pending approver filters if both exist
    if (workflowTransactionIds || pendingApproverTransactionIds) {
      if (workflowTransactionIds && pendingApproverTransactionIds) {
        // Intersect both sets of IDs
        const workflowIds = workflowTransactionIds.map(id => id.toString());
        const pendingIds = pendingApproverTransactionIds.map(id => id.toString());
        const intersectedIds = workflowIds.filter(id => pendingIds.includes(id));
        
        if (intersectedIds.length > 0) {
          filter._id = { $in: intersectedIds.map(id => mongoose.Types.ObjectId(id)) };
        } else {
          filter._id = null; // No intersection
        }
      } else if (workflowTransactionIds) {
        filter._id = { $in: workflowTransactionIds };
      } else if (pendingApproverTransactionIds) {
        filter._id = { $in: pendingApproverTransactionIds };
      }
    }

    // If filter._id is null, return empty statistics
    if (filter._id === null) {
      return res.json({
        overall: {
          totalCount: 0,
          totalAmount: 0
        },
        statsByStatus: [],
        statsByCurrency: [],
        statusCounts: {
          pending: 0,
          approved: 0,
          rejected: 0,
          canceled: 0,
          open: 0,
          closed: 0
        },
        totalRequests: 0
      });
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

    // Calculate extra counts based on status
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
    const overallAmount = overallStats[0] ? overallStats[0].totalAmount : 0;

    // Format the response
    const response = {
      overall: {
        totalCount: overallCount,
        totalAmount: overallAmount
      },
      statsByStatus: statsByStatus.map(item => ({
        status: item._id,
        count: item.count,
        totalAmount: item.totalAmount
      })),
      statsByCurrency: statsByCurrency.map(item => ({
        currency: item._id,
        count: item.count,
        totalAmount: item.totalAmount
      })),
      statusCounts: {
        pending: statsByStatus.find(s => s._id === 'Pending')?.count || 0,
        approved: statsByStatus.find(s => s._id === 'Approved')?.count || 0,
        rejected: statsByStatus.find(s => s._id === 'Rejected')?.count || 0,
        canceled: statsByStatus.find(s => s._id === 'Canceled')?.count || 0,
        open: openCount,
        closed: closedCount
      },
      totalRequests: overallCount // For backward compatibility
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching fund request statistics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});
  

  module.exports = router;
