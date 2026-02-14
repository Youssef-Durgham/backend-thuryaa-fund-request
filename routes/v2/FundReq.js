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
const FundRequestCounter = require('../../model/v2/FundRequestCounter');

const BASE_URL = process.env.BASE_URL || 'https://rida-funds.spc-it.com.iq';

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

      const hasPermission = admin.entityRoles.some(entityRole => {
        if (entityRole.entity.toString() !== entityC1._id.toString()) {
          return false;
        }
        return entityRole.roles.some(role => role.permissions.includes(permission));
      });

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


// =============================================
// CREATE FUND REQUEST
// =============================================
router.post('/fund-requests/full/:workflowId', checkPermission('Create_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      details,
      balance,
      currency,
      department,
      handedTo,
      attachments,
      requestDate,
      requestTime
    } = req.body;

    // Generate unique code
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0].replace(/-/g, '');

    const counter = await FundRequestCounter.findOneAndUpdate(
      { date: formattedDate },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, session }
    );

    const uniqueCode = `${formattedDate}-${String(counter.sequence).padStart(6, '0')}`;

    const fundRequest = new FundRequest({
      uniqueCode,
      details,
      balance,
      currency,
      department,
      handedTo,
      attachments,
      status: 'Pending',
      requestedBy: req.adminId,
      requestDate: requestDate || Date.now(),
      requestTime: requestTime || today.toTimeString().split(' ')[0]
    });

    await fundRequest.save({ session });

    // Validate assigned workflow
    const assignedWorkflow = await AssignedWorkflow.findById(req.params.workflowId);
    if (!assignedWorkflow) {
      throw new Error('Assigned workflow not found.');
    }

    const workflow = new ApprovalWorkflow({
      transactionType: assignedWorkflow.transactionType,
      transactionId: fundRequest._id,
      steps: assignedWorkflow.steps.map(step => ({
        level: step.level,
        stepName: step.stepName,
        approvers: step.approvers,
        canReject: step.canReject,
        status: 'Pending'
      })),
      createdBy: req.adminId,
      status: 'Pending',
      assignedWorkflow: req.params.workflowId
    });

    await workflow.save({ session });

    // Populate approvers before sending emails
    await workflow.populate('steps.approvers');

    // Send email to the first step approvers
    const firstStep = workflow.steps.find(step => step.level === 1);
    if (firstStep) {
      for (const approver of firstStep.approvers) {
        try {
          await sendEmailNotification({
            to: approver.email,
            subject: `إجراء مطلوب: طلب تمويل جديد بانتظار موافقتك`,
            body: `يوجد طلب تمويل جديد بحاجة إلى موافقتك.\n\nتفاصيل الطلب:\n- الكود: ${uniqueCode}\n- المبلغ: ${balance} ${currency}\n- القسم: ${department}\n\nيمكنك مراجعة الطلب من خلال الرابط التالي:\n${BASE_URL}/fund-requests/${fundRequest._id}`,
            recipientName: approver.name,
            actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
            actionText: 'عرض الطلب'
          });
        } catch (emailErr) {
          console.error(`Failed to send email to approver ${approver._id}:`, emailErr.message);
        }
      }
    }

    await logActivity({
      action: 'Create_FundRequest',
      performedBy: req.adminId,
      targetItem: fundRequest._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `Fund request created: ${uniqueCode}`
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'تم إنشاء طلب التمويل بنجاح.', uniqueCode, fundRequest, workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// =============================================
// APPROVE FUND REQUEST
// =============================================
router.post('/fund-requests/:workflowId/approve', checkPermission('Approve_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments, attachments = [] } = req.body;
    const adminId = req.adminId;

    const admin = await Admin.findById(adminId).session(session);
    if (!admin) throw new Error('Admin not found.');

    const workflow = await ApprovalWorkflow.findById(workflowId)
      .populate('steps.approvers', 'email name')
      .session(session);

    if (!workflow) throw new Error('Workflow not found.');
    if (workflow.status !== 'Pending') throw new Error('Workflow is not pending.');

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) throw new Error('No current approval step found.');

    // Ensure the approver is part of the current step
    const isApprover = currentStep.approvers.some(approver => approver._id.toString() === adminId);
    if (!isApprover) throw new Error('You are not an approver for this step.');

    // Mark the current step as approved
    currentStep.status = 'Approved';
    currentStep.approvedBy = adminId;
    currentStep.approvedAt = new Date();
    currentStep.comments = comments;
    currentStep.attachments = attachments;

    // Fetch FundRequest
    const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
    if (!fundRequest) throw new Error('FundRequest not found.');

    // Fetch Requester
    const requester = await Admin.findById(fundRequest.requestedBy).session(session);

    // Send email to requester about approval
    if (requester && requester.email) {
      try {
        await sendEmailNotification({
          to: requester.email,
          subject: `تمت الموافقة على خطوة من طلب التمويل`,
          body: `تمت الموافقة على الخطوة ${currentStep.level} (${currentStep.stepName || ''}) من طلب التمويل الخاص بك بواسطة ${admin.name}.\n\n${BASE_URL}/fund-requests/${fundRequest._id}`,
          recipientName: requester.name,
          actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
          actionText: 'عرض التفاصيل'
        });
      } catch (emailErr) {
        console.error('Failed to send email to requester:', emailErr.message);
      }
    }

    // Check if there's a next step
    const nextStep = workflow.steps.find(step => step.level === workflow.currentLevel + 1);

    if (nextStep) {
      // Move to next step
      workflow.currentLevel += 1;

      // Notify next step approvers
      for (const approver of nextStep.approvers) {
        try {
          await sendEmailNotification({
            to: approver.email,
            subject: `إجراء مطلوب: طلب تمويل في الخطوة ${nextStep.level}`,
            body: `هناك طلب تمويل يحتاج إلى موافقتك في الخطوة ${nextStep.level} (${nextStep.stepName || ''}).\n\n${BASE_URL}/fund-requests/${fundRequest._id}`,
            recipientName: approver.name,
            actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
            actionText: 'عرض التفاصيل'
          });
        } catch (emailErr) {
          console.error(`Failed to send email to approver:`, emailErr.message);
        }
      }
    } else {
      // This is the last step (الكاشير) - mark as Paid
      workflow.status = 'Paid';
      fundRequest.status = 'Paid';
      fundRequest.isPaid = true;
      fundRequest.paidBy = adminId;
      fundRequest.paidAt = new Date();
      await fundRequest.save({ session });

      // Send completion email
      if (requester && requester.email) {
        try {
          await sendEmailNotification({
            to: requester.email,
            subject: 'تم صرف طلب التمويل',
            body: `تم صرف طلب التمويل الخاص بك بنجاح.\n\n${BASE_URL}/fund-requests/${fundRequest._id}`,
            recipientName: requester.name,
            actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
            actionText: 'عرض التفاصيل'
          });
        } catch (emailErr) {
          console.error('Failed to send completion email:', emailErr.message);
        }
      }
    }

    await workflow.save({ session });

    await logActivity({
      action: 'Approve_FundRequest',
      performedBy: adminId,
      targetItem: workflow._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `تمت الموافقة على طلب التمويل عند الخطوة ${currentStep.level} (${currentStep.stepName || ''})`
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تمت الموافقة على طلب التمويل بنجاح.', workflow });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error approving:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});


// =============================================
// REJECT FUND REQUEST (returns to previous step)
// =============================================
router.post('/fund-requests/:workflowId/reject', checkPermission('Reject_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;
    const { comments, attachments = [] } = req.body;
    const adminId = req.adminId;

    const admin = await Admin.findById(adminId).session(session);
    if (!admin) throw new Error('Admin not found.');

    const workflow = await ApprovalWorkflow.findById(workflowId)
      .populate('steps.approvers', 'email name')
      .session(session);

    if (!workflow) throw new Error('Workflow not found.');
    if (workflow.status !== 'Pending') throw new Error('Workflow is not pending.');

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (!currentStep) throw new Error('No current approval step found.');

    // Check if this step can reject
    if (currentStep.canReject === false) {
      throw new Error('هذه الخطوة لا يمكنها الرفض. يمكن فقط الموافقة.');
    }

    // Ensure the approver is part of the current step
    const isApprover = currentStep.approvers.some(approver => approver._id.toString() === adminId);
    if (!isApprover) throw new Error('You are not an approver for this step.');

    // Mark current step as rejected
    currentStep.status = 'Rejected';
    currentStep.rejectedBy = adminId;
    currentStep.rejectedAt = new Date();
    currentStep.comments = comments;
    currentStep.attachments = attachments;

    // Fetch FundRequest
    const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
    if (!fundRequest) throw new Error('FundRequest not found.');

    const requester = await Admin.findById(fundRequest.requestedBy).session(session);

    if (workflow.currentLevel === 1) {
      // If rejected at the first step, return to employee for editing
      fundRequest.status = 'Rejected';
      await fundRequest.save({ session });

      // Notify the requester
      if (requester && requester.email) {
        try {
          await sendEmailNotification({
            to: requester.email,
            subject: 'تم رفض طلب التمويل - يرجى التعديل وإعادة الإرسال',
            body: `تم رفض طلب التمويل الخاص بك في الخطوة ${currentStep.level} (${currentStep.stepName || ''}).\nالتعليقات: "${comments}"\n\nيرجى تعديل الطلب وإعادة إرساله.\n${BASE_URL}/fund-requests/${fundRequest._id}`,
            recipientName: requester.name,
            actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
            actionText: 'تعديل الطلب'
          });
        } catch (emailErr) {
          console.error('Failed to send rejection email:', emailErr.message);
        }
      }
    } else {
      // Return to previous step - reset prev step to Pending
      const prevStep = workflow.steps.find(step => step.level === workflow.currentLevel - 1);
      if (prevStep) {
        prevStep.status = 'Pending';
        prevStep.approvedBy = undefined;
        prevStep.approvedAt = undefined;
        prevStep.comments = undefined;

        // Notify previous step approvers
        for (const approver of prevStep.approvers) {
          try {
            await sendEmailNotification({
              to: approver.email,
              subject: `طلب تمويل مرفوض - يحتاج إلى مراجعتك مرة أخرى`,
              body: `تم رفض طلب التمويل في الخطوة ${currentStep.level} (${currentStep.stepName || ''}) بواسطة ${admin.name}.\nالتعليقات: "${comments}"\n\nالطلب عاد إلى خطوتك للمراجعة.\n${BASE_URL}/fund-requests/${fundRequest._id}`,
              recipientName: approver.name,
              actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
              actionText: 'مراجعة الطلب'
            });
          } catch (emailErr) {
            console.error('Failed to send email to prev approver:', emailErr.message);
          }
        }
      }

      // Move back one level
      workflow.currentLevel -= 1;
    }

    // Notify requester about rejection
    if (workflow.currentLevel > 0 && requester && requester.email) {
      try {
        await sendEmailNotification({
          to: requester.email,
          subject: 'تم رفض خطوة من طلب التمويل',
          body: `تم رفض طلب التمويل في الخطوة ${currentStep.level} (${currentStep.stepName || ''}) بواسطة ${admin.name}.\nالتعليقات: "${comments}"\n\nتم إرجاع الطلب للخطوة السابقة.\n${BASE_URL}/fund-requests/${fundRequest._id}`,
          recipientName: requester.name,
          actionUrl: `${BASE_URL}/fund-requests/${fundRequest._id}`,
          actionText: 'عرض التفاصيل'
        });
      } catch (emailErr) {
        console.error('Failed to send rejection email to requester:', emailErr.message);
      }
    }

    await workflow.save({ session });

    await logActivity({
      action: 'Reject_FundRequest',
      performedBy: adminId,
      targetItem: workflow._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: `تم رفض طلب التمويل عند الخطوة ${currentStep.level} (${currentStep.stepName || ''}) - تم الإرجاع للخطوة السابقة`
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: 'تم رفض طلب التمويل وإرجاعه للخطوة السابقة.',
      workflow
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error rejecting:', error);
    res.status(500).json({ message: 'خطأ في الخادم', error: error.message });
  }
});


// =============================================
// CANCEL FUND REQUEST (by requester only)
// =============================================
router.post('/fund-requests/:workflowId/cancel', checkPermission('Cancel_FundRequest'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { workflowId } = req.params;

    const workflow = await ApprovalWorkflow.findById(workflowId).session(session);
    if (!workflow) throw new Error('Workflow not found.');

    const fundRequest = await FundRequest.findById(workflow.transactionId).session(session);
    if (!fundRequest) throw new Error('Fund request not found.');

    if (fundRequest.requestedBy.toString() !== req.adminId) {
      throw new Error('Only the requester can cancel this fund request.');
    }

    if (fundRequest.status !== 'Pending' && fundRequest.status !== 'Rejected') {
      throw new Error('Only pending or rejected fund requests can be canceled.');
    }

    workflow.status = 'Canceled';
    fundRequest.status = 'Canceled';

    const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
    if (currentStep) {
      currentStep.status = 'Canceled';
      currentStep.approvedBy = req.adminId;
      currentStep.approvedAt = new Date();
    }

    await workflow.save({ session });
    await fundRequest.save({ session });

    await logActivity({
      action: 'Cancel_FundRequest',
      performedBy: req.adminId,
      targetItem: workflow._id,
      itemType: 'FundRequest',
      userType: 'Admin',
      description: 'Canceled fund request'
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'تم إلغاء طلب التمويل بنجاح.', workflow, fundRequest });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// =============================================
// GET SINGLE FUND REQUEST DETAILS
// =============================================
router.get('/fund-requests/:id', checkPermission('View_FundRequest'), async (req, res) => {
  try {
    const { id } = req.params;

    const fundRequest = await FundRequest.findById(id)
      .populate('requestedBy', 'name email department')
      .populate('paidBy', 'name email')
      .lean();

    if (!fundRequest) {
      return res.status(404).json({ message: 'Fund request not found.' });
    }

    const workflow = await ApprovalWorkflow.findOne({ transactionId: id })
      .populate('steps.approvers', 'name email')
      .populate('steps.approvedBy', 'name email')
      .populate('steps.rejectedBy', 'name email')
      .lean();

    res.status(200).json({
      message: 'Fund request details retrieved successfully.',
      data: { fundRequest, workflow }
    });
  } catch (error) {
    console.error('Error fetching fund request:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// =============================================
// GET PAID FUND REQUESTS (for المحاسب)
// =============================================
router.get('/fund-requests-paid', checkPermission('View_Paid_FundRequests'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { isPaid: true, status: 'Paid' };

    if (search) {
      query.$or = [
        { uniqueCode: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await FundRequest.countDocuments(query);
    const requests = await FundRequest.find(query)
      .populate('requestedBy', 'name email department')
      .populate('paidBy', 'name email')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    res.status(200).json({
      message: 'Paid fund requests retrieved successfully.',
      totalRequests: total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      requests
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// =============================================
// MY REQUESTS (user's own + pending approvals)
// =============================================
router.get('/myRequests', checkPermission('View_FundRequests'), async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.adminId);

    // User's own requests
    const myRequests = await FundRequest.find({ requestedBy: userObjectId })
      .populate('requestedBy', 'name email department')
      .sort({ createdAt: -1 })
      .lean();

    // Pending workflows where user is current approver
    const pendingQuery = {
      status: 'Pending',
      'steps': {
        $elemMatch: {
          approvers: userObjectId,
          status: 'Pending'
        }
      }
    };

    if (req.query.workflowId) {
      pendingQuery.assignedWorkflow = new mongoose.Types.ObjectId(req.query.workflowId);
    }

    const pendingWorkflows = await ApprovalWorkflow.find(pendingQuery)
      .populate({
        path: 'transactionId',
        populate: { path: 'requestedBy', select: 'name email department' }
      })
      .populate({ path: 'steps.approvers', select: 'name email' })
      .exec();

    const pendingRequests = pendingWorkflows.filter(workflow => {
      const currentStep = workflow.steps.find(step => step.level === workflow.currentLevel);
      if (!currentStep) return false;
      const approverIds = currentStep.approvers.map(a => (a._id ? a._id.toString() : a.toString()));
      return currentStep.status === 'Pending' && approverIds.includes(userObjectId.toString());
    }).map(workflow => ({
      _id: workflow._id,
      transactionId: {
        _id: workflow.transactionId?._id,
        details: workflow.transactionId?.details,
        balance: workflow.transactionId?.balance,
        currency: workflow.transactionId?.currency,
        status: workflow.transactionId?.status,
        department: workflow.transactionId?.department,
        requestedBy: workflow.transactionId?.requestedBy,
      },
      workflowStatus: workflow.status,
      currentLevel: workflow.currentLevel,
      currentStepName: workflow.steps.find(s => s.level === workflow.currentLevel)?.stepName,
      canReject: workflow.steps.find(s => s.level === workflow.currentLevel)?.canReject,
      steps: workflow.steps,
    }));

    res.json({ myRequests, pendingRequests });
  } catch (error) {
    console.error('Error in GET /myRequests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// =============================================
// USER APPROVALS HISTORY
// =============================================
router.get('/workflows/user-approvals', checkPermission('View_FundRequests'), async (req, res) => {
  try {
    const userId = req.adminId;
    if (!userId) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    const { page = 1, limit = 10, search = '', workflowId } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const pipeline = [
      {
        $lookup: {
          from: 'approvalworkflows',
          localField: '_id',
          foreignField: 'transactionId',
          as: 'workflowData'
        }
      },
      {
        $match: {
          $or: [
            { requestedBy: new mongoose.Types.ObjectId(userId) },
            { 'workflowData.steps.approvedBy': new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      ...(workflowId ? [{
        $match: {
          'workflowData.assignedWorkflow': new mongoose.Types.ObjectId(workflowId)
        }
      }] : []),
      {
        $lookup: {
          from: 'admins',
          localField: 'requestedBy',
          foreignField: '_id',
          as: 'requester'
        }
      },
      {
        $unwind: { path: '$requester', preserveNullAndEmptyArrays: true }
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { details: { $regex: search, $options: 'i' } },
            { uniqueCode: { $regex: search, $options: 'i' } },
            { 'requester.name': { $regex: search, $options: 'i' } },
            { department: { $regex: search, $options: 'i' } },
          ]
        }
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
          totalCount: [{ $count: 'count' }]
        }
      }
    );

    const [result = {}] = await FundRequest.aggregate(pipeline);
    const { paginatedResults = [], totalCount = [] } = result;
    const total = totalCount[0]?.count || 0;

    return res.status(200).json({
      message: 'Workflows retrieved successfully.',
      totalRequests: total,
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      workflows: paginatedResults
    });
  } catch (error) {
    console.error('Error fetching user-approvals:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// =============================================
// WORKFLOW MANAGEMENT
// =============================================

// Create a new workflow template
router.post('/workflows', checkPermission('Create_Workflow'), async (req, res) => {
  try {
    const { transactionType, steps } = req.body;

    const existingWorkflow = await AssignedWorkflow.findOne({ transactionType });
    if (existingWorkflow) {
      return res.status(400).json({ message: 'Workflow already exists for this transaction type.' });
    }

    const newWorkflow = new AssignedWorkflow({ transactionType, steps });
    await newWorkflow.save();

    await logActivity({
      action: 'Create_Workflow',
      performedBy: req.adminId,
      targetItem: newWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Created workflow for ${transactionType}`
    });

    res.status(201).json({ message: 'Workflow created successfully.', workflow: newWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all workflows
router.get('/workflows', checkPermission('View_Workflows'), async (req, res) => {
  try {
    const workflows = await AssignedWorkflow.find().populate('steps.approvers', 'name email department');
    res.status(200).json({ message: 'Workflows retrieved successfully.', workflows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create/update assigned workflow
router.post('/assigned-workflows', checkPermission('Manage_AssignedWorkflow'), async (req, res) => {
  try {
    const { transactionType, steps } = req.body;

    let assignedWorkflow = await AssignedWorkflow.findOne({ transactionType });
    if (!assignedWorkflow) {
      assignedWorkflow = new AssignedWorkflow({ transactionType, steps });
    } else {
      assignedWorkflow.steps = steps;
    }

    await assignedWorkflow.save();

    await logActivity({
      action: 'Manage_AssignedWorkflow',
      performedBy: req.adminId,
      targetItem: assignedWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Managed assigned workflow for ${transactionType}`
    });

    res.status(200).json({ message: 'Assigned workflow managed successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add user to workflow step
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
      return res.status(400).json({ message: `Step level ${level} not found.` });
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
      description: `Added user ${userId} to workflow at level ${level}`
    });

    res.status(200).json({ message: 'User added to workflow successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove user from workflow step
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
      return res.status(400).json({ message: `Step level ${level} not found.` });
    }

    step.approvers = step.approvers.filter(approver => approver.toString() !== userId);
    await assignedWorkflow.save();

    await logActivity({
      action: 'Remove_User_AssignedWorkflow',
      performedBy: req.adminId,
      targetItem: assignedWorkflow._id,
      itemType: 'AssignedWorkflow',
      userType: 'Admin',
      description: `Removed user ${userId} from workflow at level ${level}`
    });

    res.status(200).json({ message: 'User removed from workflow successfully.', assignedWorkflow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
