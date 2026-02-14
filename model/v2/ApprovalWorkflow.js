const mongoose = require('mongoose');

const approvalWorkflowSchema = new mongoose.Schema({
  transactionType: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FundRequest', required: true },
  steps: [{
    level: { type: Number },
    stepName: { type: String }, // e.g. 'مدير', 'مالي', 'المدير التنفيذي', 'الكاشير'
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
    canReject: { type: Boolean, default: true }, // false for الكاشير
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectedAt: { type: Date },
    comments: { type: String },
    attachments: [{
      url: { type: String },
      name: { type: String },
      size: { type: Number },
      type: { type: String },
      uploadedAt: { type: Date, default: Date.now }
    }]
  }],
  currentLevel: { type: Number, default: 1 },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled', 'Paid'], default: 'Pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  assignedWorkflow: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignedWorkflow', required: true },
  createdAt: { type: Date, default: Date.now }
});

const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
module.exports = ApprovalWorkflow;
