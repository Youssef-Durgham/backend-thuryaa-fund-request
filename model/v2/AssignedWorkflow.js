const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// AssignedWorkflow Schema
const assignedWorkflowSchema = new Schema({
  transactionType: { type: String, required: true, unique: true }, // e.g., 'FundRequest'
  steps: [{
    level: { type: Number },
    approvers: [{ type: Schema.Types.ObjectId, ref: 'Admin', required: true }]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to update `updatedAt` field
assignedWorkflowSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const AssignedWorkflow = mongoose.model('AssignedWorkflow', assignedWorkflowSchema);
module.exports = AssignedWorkflow;
