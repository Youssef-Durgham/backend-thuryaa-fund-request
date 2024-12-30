// Assuming we use Express.js for the backend
const express = require('express');
const mongoose = require('mongoose');
const ApprovalWorkflow = require('../../model/v2/ApprovalWorkflow');
const AssignedWorkflow = require('../../model/v2/AssignedWorkflow');
const FundRequest = require('../../model/v2/FundRequest');
const { Admin } = require('../../model/Users');
const logActivity = require('../../utils/activityLogger');
const sendEmailNotification = require('../../utils/emailNotification');
const jwt = require('jsonwebtoken');
const Entity = require('../../model/v2/Entity');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


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



// Create Fund Request with full details
router.post('/fund-requests/full/:workflowId', checkPermission('Create_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { description, amount, requestedBy, details, documents } = req.body;

    const fundRequest = new FundRequest({
      description,
      amount,
      requestedBy,
      details,
      documents, // Add document URLs here
      status: 'Pending'
    });
    await fundRequest.save({ session });

    const assignedWorkflow = await AssignedWorkflow.findById(workflowId);
    if (!assignedWorkflow) {
      throw new Error('Assigned workflow not found.');
    }

    const workflow = new ApprovalWorkflow({
      transactionType: assignedWorkflow.transactionType,
      transactionId: fundRequest._id,
      steps: assignedWorkflow.steps,
      createdBy: req.adminId,
      status: 'Pending'
    });
    await workflow.save({ session });

    await logActivity({
      action: 'Create_FundRequest',
      performedBy: req.adminId,
      targetItem: fundRequest._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `Full fund request created with workflow ID ${workflowId}`
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Fund request created successfully.', fundRequest, workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Approve Fund Request
router.post('/fund-requests/:workflowId/approve', checkPermission('Approve_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments } = req.body; // Extract comments from the request body
    const adminId = req.adminId; // Ensure adminId is available

    console.log(`[Approve] Admin ID: ${adminId} is attempting to approve workflow ID: ${workflowId}`);

    // Fetch Admin Details
    const admin = await Admin.findById(adminId).session(session);
    if (!admin) {
      console.error(`[Approve] Admin not found for ID: ${adminId}`);
      throw new Error('Admin not found.');
    }

    const workflow = await ApprovalWorkflow.findById(workflowId)
      .populate('steps.approvers', 'email name')
      .session(session);

    if (!workflow) {
      console.error(`[Approve] Workflow not found for ID: ${workflowId}`);
      throw new Error('Workflow not found.');
    }

    if (workflow.status !== 'Pending') {
      console.error(`[Approve] Workflow ID: ${workflowId} is not pending. Current status: ${workflow.status}`);
      throw new Error('Workflow is not pending.');
    }

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) {
      console.error(`[Approve] No current approval step found for workflow ID: ${workflowId}`);
      throw new Error('No current approval step found.');
    }

    // Ensure the approver is part of the current step
    const isApprover = currentStep.approvers.some(approver => approver._id.toString() === adminId);
    if (!isApprover) {
      console.error(`[Approve] Admin ID: ${adminId} is not an approver for the current step.`);
      throw new Error('You are not an approver for this step.');
    }

    console.log(`[Approve] Admin ${admin.name} is approving at step level ${currentStep.level}`);

    // Mark the current step as approved
    currentStep.status = 'Approved';
    currentStep.approvedBy = adminId;
    currentStep.approvedAt = new Date();
    currentStep.comments = comments; // Save the comments

    // Fetch FundRequest Details
    const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
    if (!fundRequest) {
      console.error(`[Approve] FundRequest not found for Transaction ID: ${workflow.transactionId}`);
      throw new Error('FundRequest not found.');
    }

    // Fetch Requester Details
    const requester = await Admin.findById(fundRequest.requestedBy).session(session);
    if (!requester) {
      console.error(`[Approve] Requester not found for FundRequest ID: ${fundRequest._id}`);
      throw new Error('Requester not found.');
    }

    // Send email to the requester about the approval of the current step
    console.log(`[Approve] Sending email to requester: ${requester.email}`);
    await sendEmailNotification({
      to: requester.email,
      subject: `تمت الموافقة على خطوة من طلب التمويل`,
      body: `تمت الموافقة على الخطوة ${currentStep.level} من طلب التمويل الخاص بك بواسطة ${admin.name}.\n\nيمكنك مراجعة طلب التمويل من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
      recipientName: requester.name,
      actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
      actionText: 'عرض التفاصيل'
    });
    console.log(`[Approve] Email sent to requester: ${requester.email}`);

    // Move to the next step
    const nextStep = workflow.steps.find(step => step.level === workflow.currentLevel + 1);
    if (nextStep) {
      workflow.currentLevel += 1;
      console.log(`[Approve] Moving to next step level: ${workflow.currentLevel} for workflow ID: ${workflowId}`);

      // Notify all approvers of the next step that action is required
      for (const approver of nextStep.approvers) {
        console.log(`[Approve] Sending email to next step approver: ${approver.email}`);
        await sendEmailNotification({
          to: approver.email,
          subject: `إجراء مطلوب: طلب تمويل جديد في الخطوة ${nextStep.level}`,
          body: `هناك طلب تمويل جديد يحتاج إلى موافقتك في الخطوة ${nextStep.level}.\n\nيمكنك مراجعة الطلب من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
          recipientName: approver.name,
          actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
          actionText: 'عرض التفاصيل'
        });
        console.log(`[Approve] Email sent to next step approver: ${approver.email}`);
      }
    } else {
      // Mark the entire workflow as approved if this is the last step
      workflow.status = 'Approved';
      console.log(`[Approve] Workflow ID: ${workflowId} is fully approved.`);

      fundRequest.status = 'Approved';
      await fundRequest.save({ session });
      console.log(`[Approve] FundRequest ID: ${fundRequest._id} status updated to Approved.`);

      // Send email to the requester about the completion
      console.log(`[Approve] Sending completion email to requester: ${requester.email}`);
      await sendEmailNotification({
        to: requester.email,
        subject: 'تمت الموافقة على طلب التمويل',
        body: `تمت الموافقة على طلب التمويل الخاص بك وتم الانتهاء منه.\n\nيمكنك مراجعة الطلب من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
        recipientName: requester.name,
        actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
        actionText: 'عرض التفاصيل'
      });
      console.log(`[Approve] Completion email sent to requester: ${requester.email}`);
    }

    await workflow.save({ session });
    console.log(`[Approve] Workflow ID: ${workflowId} saved successfully.`);

    await logActivity({
      action: 'Approve_FundRequest',
      performedBy: adminId,
      targetItem: workflow._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `تمت الموافقة على طلب التمويل عند مستوى الخطوة ${currentStep.level} مع التعليقات: "${comments}"`
    });
    console.log(`[Approve] Activity logged for workflow ID: ${workflowId}`);

    await session.commitTransaction();
    session.endSession();
    console.log(`[Approve] Transaction committed for workflow ID: ${workflowId}`);

    res.status(200).json({ message: 'تمت الموافقة على طلب التمويل بنجاح.', workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`[Approve] Error approving workflow ID: ${req.params.workflowId}:`, error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// Reject Fund Request
router.post('/fund-requests/:workflowId/reject', checkPermission('Reject_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments } = req.body; // Extract comments from the request body
    const adminId = req.adminId; // Ensure adminId is available

    console.log(`[Reject] Admin ID: ${adminId} is attempting to reject workflow ID: ${workflowId}`);

    // Fetch Admin Details
    const admin = await Admin.findById(adminId).session(session);
    if (!admin) {
      console.error(`[Reject] Admin not found for ID: ${adminId}`);
      throw new Error('Admin not found.');
    }

    const workflow = await ApprovalWorkflow.findById(workflowId)
      .populate('steps.approvers', 'email name')
      .session(session);

    if (!workflow) {
      console.error(`[Reject] Workflow not found for ID: ${workflowId}`);
      throw new Error('Workflow not found.');
    }

    if (workflow.status !== 'Pending') {
      console.error(`[Reject] Workflow ID: ${workflowId} is not pending. Current status: ${workflow.status}`);
      throw new Error('Workflow is not pending.');
    }

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) {
      console.error(`[Reject] No current approval step found for workflow ID: ${workflowId}`);
      throw new Error('No current approval step found.');
    }

    // Ensure the approver is part of the current step
    const isApprover = currentStep.approvers.some(approver => approver._id.toString() === adminId);
    if (!isApprover) {
      console.error(`[Reject] Admin ID: ${adminId} is not an approver for the current step.`);
      throw new Error('You are not an approver for this step.');
    }

    console.log(`[Reject] Admin ${admin.name} is rejecting at step level ${currentStep.level}`);

    // Mark the current step as rejected
    currentStep.status = 'Rejected';
    currentStep.approvedBy = adminId;
    currentStep.approvedAt = new Date();
    currentStep.comments = comments; // Save the comments

    // Fetch FundRequest Details
    const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
    if (!fundRequest) {
      console.error(`[Reject] FundRequest not found for Transaction ID: ${workflow.transactionId}`);
      throw new Error('FundRequest not found.');
    }

    // Fetch Requester Details
    const requester = await Admin.findById(fundRequest.requestedBy).session(session);
    if (!requester) {
      console.error(`[Reject] Requester not found for FundRequest ID: ${fundRequest._id}`);
      throw new Error('Requester not found.');
    }

    // Send email to the requester about the rejection of the current step
    console.log(`[Reject] Sending email to requester: ${requester.email}`);
    await sendEmailNotification({
      to: requester.email,
      subject: `تمت رفض خطوة من طلب التمويل`,
      body: `تمت رفض الخطوة ${currentStep.level} من طلب التمويل الخاص بك بواسطة ${admin.name}. التعليقات: "${comments}".\n\nيمكنك مراجعة طلب التمويل من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
      recipientName: requester.name,
      actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
      actionText: 'عرض التفاصيل'
    });
    console.log(`[Reject] Email sent to requester: ${requester.email}`);

    // Send email to all approvers of the current step about the rejection
    for (const approver of currentStep.approvers) {
      console.log(`[Reject] Sending rejection email to approver: ${approver.email}`);
      await sendEmailNotification({
        to: approver.email,
        subject: `تمت رفض الخطوة ${currentStep.level}`,
        body: `تمت رفض الخطوة ${currentStep.level} من طلب التمويل بواسطة ${admin.name}. التعليقات: "${comments}".\n\nيمكنك مراجعة طلب التمويل من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
        recipientName: approver.name,
        actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
        actionText: 'عرض التفاصيل'
      });
      console.log(`[Reject] Email sent to approver: ${approver.email}`);
    }

    // Move to the previous step
    const previousStep = workflow.steps.find(step => step.level === workflow.currentLevel - 1);
    if (previousStep) {
      workflow.currentLevel -= 1;
      console.log(`[Reject] Moving back to previous step level: ${workflow.currentLevel} for workflow ID: ${workflowId}`);

      // Notify all approvers of the previous step that action is required
      for (const approver of previousStep.approvers) {
        console.log(`[Reject] Sending email to previous step approver: ${approver.email}`);
        await sendEmailNotification({
          to: approver.email,
          subject: 'إجراء مطلوب: طلب التمويل مرفوض',
          body: `تم رفض طلب التمويل عند المستوى ${workflow.currentLevel + 1}. لقد عاد إلى مستواك لاتخاذ الإجراءات اللازمة. يرجى تسجيل الدخول إلى النظام لمراجعة واتخاذ الخطوات الضرورية.\n\nيمكنك مراجعة طلب التمويل من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
          recipientName: approver.name,
          actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
          actionText: 'عرض التفاصيل'
        });
        console.log(`[Reject] Email sent to previous step approver: ${approver.email}`);
      }
    } else {
      // Mark the entire workflow as rejected if there's no previous step
      workflow.status = 'Rejected';
      console.log(`[Reject] Workflow ID: ${workflowId} is fully rejected.`);

      fundRequest.status = 'Rejected';
      await fundRequest.save({ session });
      console.log(`[Reject] FundRequest ID: ${fundRequest._id} status updated to Rejected.`);

      // Send email to the requester about the full rejection
      console.log(`[Reject] Sending full rejection email to requester: ${requester.email}`);
      await sendEmailNotification({
        to: requester.email,
        subject: 'تم رفض طلب التمويل',
        body: `تم رفض طلب التمويل الخاص بك. التعليقات: "${comments}".\n\nيمكنك مراجعة طلب التمويل من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
        recipientName: requester.name,
        actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
        actionText: 'عرض التفاصيل'
      });
      console.log(`[Reject] Full rejection email sent to requester: ${requester.email}`);
    }

    await workflow.save({ session });
    console.log(`[Reject] Workflow ID: ${workflowId} saved successfully.`);

    await logActivity({
      action: 'Reject_FundRequest',
      performedBy: adminId,
      targetItem: workflow._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `تم رفض طلب التمويل عند مستوى الخطوة ${currentStep.level} مع التعليقات: "${comments}"`
    });
    console.log(`[Reject] Activity logged for workflow ID: ${workflowId}`);

    await session.commitTransaction();
    session.endSession();
    console.log(`[Reject] Transaction committed for workflow ID: ${workflowId}`);

    res.status(200).json({ message: 'تم رفض طلب التمويل بنجاح وتم إرجاعه إلى الخطوة السابقة.', workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`[Reject] Error rejecting workflow ID: ${req.params.workflowId}:`, error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});

// Cancel Fund Request
router.post(
  '/fund-requests/:workflowId/cancel',
  checkPermission('Cancel_FundRequest'),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { workflowId } = req.params;

      const workflow = await ApprovalWorkflow.findById(workflowId).session(session);
      if (!workflow) {
        throw new Error('Workflow not found.');
      }

      const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
      if (!fundRequest) {
        throw new Error('Fund request not found.');
      }

      // Only the requester can cancel
      if (fundRequest.requestedBy.toString() !== req.adminId) {
        throw new Error('Only the requester can cancel this fund request.');
      }

      // Only pending requests can be canceled
      if (fundRequest.status !== 'Pending') {
        throw new Error('Only pending fund requests can be canceled.');
      }

      // Mark both the workflow and the fund request as Canceled
      workflow.status = 'Canceled';
      fundRequest.status = 'Canceled';

      // Also update the current step: set status, set who canceled, and when
      const currentStep = workflow.steps.find(
        (step) => step.level === workflow.currentLevel
      );
      if (!currentStep) {
        throw new Error('No current step found in the workflow.');
      }
      currentStep.status = 'Canceled';
      currentStep.approvedBy = req.adminId;    // The user who canceled
      currentStep.approvedAt = new Date();     // The time of cancellation

      // Save
      await workflow.save({ session });
      await fundRequest.save({ session });

      // Log activity
      await logActivity({
        action: 'Cancel_FundRequest',
        performedBy: req.adminId,
        targetItem: workflow._id,
        itemType: 'FundRequest',
        userType: 'Admin',
        description: 'Canceled fund request',
      });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        message: 'Fund request canceled successfully.',
        workflow,
        fundRequest,
      });
    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.get('/fund-requests/:id', checkPermission('View_FundRequest'), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the fund request by ID
    const fundRequest = await FundRequest.findById(id)
      .populate('requestedBy', 'name email') // Populate requestedBy with admin details
      .lean();

    if (!fundRequest) {
      return res.status(404).json({ message: 'Fund request not found.' });
    }

    console.log('Fund Request Retrieved:', fundRequest); // Debugging

    // Fetch the workflow associated with the fund request
    const workflow = await ApprovalWorkflow.findOne({ transactionId: id })
      .populate('steps.approvers', 'name email') // Populate approvers for each step
      .lean();

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found for this fund request.' });
    }

    console.log('Associated Workflow:', workflow); // Debugging

    const response = {
      fundRequest,
      workflow,
    };

    res.status(200).json({
      message: 'Fund request details retrieved successfully.',
      data: response,
    });
  } catch (error) {
    console.error('Error fetching fund request details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/fund-requests/user-actions', checkPermission('View_FundRequests'), async (req, res) => {
  try {
    const userId = req.adminId;
    const { status } = req.query;
    console.log(userId)
    // Query for requests created by the user
    const userRequestsQuery = { requestedBy: userId };
    if (status) {
      userRequestsQuery.status = status;
    }

    const userRequests = await FundRequest.find(userRequestsQuery)
      .populate('requestedBy', 'name email') // Populate requestedBy details
      .sort({ createdAt: -1 })
      .lean();
console.log(userRequests)
    // Find workflows where the user is an approver at the current level
    const pendingWorkflows = await ApprovalWorkflow.find({
      status: 'Pending',
      'steps.approvers': userId,
      currentLevel: { // Only get workflows where user is at the current approval level
        $in: await ApprovalWorkflow.find({
          'steps.approvers': userId,
          status: 'Pending'
        }).distinct('currentLevel')
      }
    })
    .populate({
      path: 'transactionId',
      model: 'FundRequest',
      select: 'description amount status requestedBy createdAt'
    })
    .populate('createdBy', 'name email')
    .populate('steps.approvers', 'name email')
    .sort({ createdAt: -1 })
    .lean();
    console.log(pendingWorkflows)
    // Process pending approvals to include only relevant information
    const pendingApprovals = pendingWorkflows.map(workflow => {
      const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
      return {
        workflowId: workflow._id,
        fundRequest: workflow.transactionId,
        currentLevel: workflow.currentLevel,
        currentApprovers: currentStep ? currentStep.approvers : [],
        createdBy: workflow.createdBy,
        createdAt: workflow.createdAt,
        status: workflow.status
      };
    });
    console.log(pendingApprovals, currentStep)
    res.status(200).json({
      success: true,
      message: 'User actions retrieved successfully.',
      data: {
        createdByUser: userRequests,
        pendingApprovals: pendingApprovals.filter(approval => 
          approval.currentApprovers.some(approver => 
            approver._id.toString() === userId.toString()
          )
        )
      }
    });

  } catch (error) {
    console.error('Error fetching user actions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user actions', 
      error: error.message 
    });
  }
});

router.get('/myRequests', checkPermission('View_FundRequests'), async (req, res) => {
  try {
      const userObjectId = new mongoose.Types.ObjectId(req.adminId);

      // 1) My Requests (created by this user)
      const myRequests = await FundRequest.find({ requestedBy: userObjectId })
          .populate('requestedBy', 'name phone')
          .exec();

      // 2) Pending workflows requiring action from current user
      const pendingWorkflows = await ApprovalWorkflow.find({
          transactionType: 'po',
          status: 'Pending',
          'steps': {
              $elemMatch: {
                  approvers: userObjectId,
                  status: 'Pending'
              }
          }
      })
      .populate({
          path: 'transactionId',
          populate: {
              path: 'requestedBy',
              select: 'name phone'
          }
      })
      .populate({
          path: 'steps.approvers',
          select: 'name phone'
      })
      .exec();

      // Filter workflows where user is approver at current level
      const pendingRequests = pendingWorkflows
          .filter(workflow => {
              const currentStepIndex = workflow.steps.findIndex(step => 
                  step.level === workflow.currentLevel
              );
              if (currentStepIndex === -1) return false;
              
              const currentStep = workflow.steps[currentStepIndex];
              return currentStep.status === 'Pending' && 
                     currentStep.approvers.some(approver => 
                         approver._id.toString() === userObjectId.toString()
                     );
          })
          .map(workflow => ({
              _id: workflow._id,
              transactionId: {
                  _id: workflow.transactionId?._id,
                  description: workflow.transactionId?.description,
                  amount: workflow.transactionId?.amount,
                  status: workflow.transactionId?.status,
                  requestedBy: workflow.transactionId?.requestedBy,
              },
              workflowStatus: workflow.status,
              currentLevel: workflow.currentLevel,
              steps: workflow.steps,
          }));

      res.json({ myRequests, pendingRequests });
  } catch (error) {
      console.error('Error in GET /fundRequests/myRequests:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new workflow
router.post('/workflows', checkPermission('Create_Workflow'), async (req, res) => {
    try {
      const { transactionType, steps } = req.body;
  
      // Validate if a workflow already exists for the transaction type
      const existingWorkflow = await AssignedWorkflow.findOne({ transactionType });
      if (existingWorkflow) {
        return res.status(400).json({ message: 'Workflow already exists for this transaction type.' });
      }
  
      // Create the new workflow
      const newWorkflow = new AssignedWorkflow({
        transactionType,
        steps
      });
  
      await newWorkflow.save();
  
      await logActivity({
        action: 'Create_Workflow',
        performedBy: req.adminId,
        targetItem: newWorkflow._id,
        itemType: 'AssignedWorkflow',
        userType: 'Admin',
        description: `Created a new workflow for transaction type ${transactionType}`
      });
  
      res.status(201).json({ message: 'Workflow created successfully.', workflow: newWorkflow });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // API to get all workflows with assigned transaction types
router.get('/workflows', checkPermission('View_Workflows'), async (req, res) => {
    try {
      const workflows = await AssignedWorkflow.find().populate('steps.approvers', 'name email');
  
      res.status(200).json({ message: 'Workflows retrieved successfully.', workflows });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // Create or Update Assigned Workflow
router.post('/assigned-workflows', checkPermission('Manage_AssignedWorkflow'), async (req, res) => {
  try {
    const { transactionType, steps } = req.body;

    let assignedWorkflow = await AssignedWorkflow.findOne({ transactionType });
    if (!assignedWorkflow) {
      // Create new assigned workflow if it doesn't exist
      assignedWorkflow = new AssignedWorkflow({ transactionType, steps });
    } else {
      // Update existing assigned workflow
      assignedWorkflow.steps = steps;
    }

    await assignedWorkflow.save();

    await logActivity({
      action: 'Manage_AssignedWorkflow',
      performedBy: req.adminId,
      targetItem: assignedWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Created or updated assigned workflow for transaction type ${transactionType}`
    });

    res.status(200).json({ message: 'Assigned workflow managed successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add User to Assigned Workflow
router.post('/assigned-workflows/:workflowId/add-user', checkPermission('Manage_AssignedWorkflowUsers'), async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { level, userId } = req.body;

    const assignedWorkflow = await AssignedWorkflow.findById(workflowId);
    if (!assignedWorkflow) {
      return res.status(404).json({ message: 'Assigned workflow not found.' });
    }

    const step = assignedWorkflow.steps.find(step => step.level === level);
    if (!step) {
      return res.status(400).json({ message: `Step level ${level} not found in workflow.` });
    }

    if (!step.approvers.includes(userId)) {
      step.approvers.push(userId);
    }

    await assignedWorkflow.save();

    await logActivity({
      action: 'Add_User_AssignedWorkflow',
      performedBy: req.adminId,
      targetItem: assignedWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Added user ${userId} to workflow ${workflowId} at step level ${level}`
    });

    res.status(200).json({ message: 'User added to workflow successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove User from Assigned Workflow
router.post('/assigned-workflows/:workflowId/remove-user', checkPermission('Manage_AssignedWorkflowUsers'), async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { level, userId } = req.body;

    const assignedWorkflow = await AssignedWorkflow.findById(workflowId);
    if (!assignedWorkflow) {
      return res.status(404).json({ message: 'Assigned workflow not found.' });
    }

    const step = assignedWorkflow.steps.find(step => step.level === level);
    if (!step) {
      return res.status(400).json({ message: `Step level ${level} not found in workflow.` });
    }

    step.approvers = step.approvers.filter(approver => approver.toString() !== userId);

    await assignedWorkflow.save();

    await logActivity({
      action: 'Remove_User_AssignedWorkflow',
      performedBy: req.adminId,
      targetItem: assignedWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Removed user ${userId} from workflow ${workflowId} at step level ${level}`
    });

    res.status(200).json({ message: 'User removed from workflow successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
