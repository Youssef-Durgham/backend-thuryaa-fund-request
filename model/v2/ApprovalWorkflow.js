// models/ApprovalWorkflow.js
const mongoose = require('mongoose');

// models/ApprovalWorkflow.js (تحديث)
const approvalWorkflowSchema = new mongoose.Schema({
  transactionType: { type: String, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FundRequest', required: true },
  steps: [{
    level: { type: Number, required: true },
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }],
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    comments: { type: String }
  }],
  currentLevel: { type: Number, default: 1 },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdAt: { type: Date, default: Date.now }
});
  
  const ApprovalWorkflow = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
  module.exports = ApprovalWorkflow;
  