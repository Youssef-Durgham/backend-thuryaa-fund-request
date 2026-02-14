const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const assignedWorkflowSchema = new Schema({
  transactionType: { type: String, required: true, unique: true }, // e.g., 'FundRequest'
  steps: [{
    level: { type: Number },
    stepName: { type: String }, // e.g. 'مدير', 'مالي', 'المدير التنفيذي', 'الكاشير'
    approvers: [{ type: Schema.Types.ObjectId, ref: 'Admin', required: true }],
    canReject: { type: Boolean, default: true } // false for الكاشير
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

assignedWorkflowSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const AssignedWorkflow = mongoose.model('AssignedWorkflow', assignedWorkflowSchema);
module.exports = AssignedWorkflow;
