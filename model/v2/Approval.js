// models/Approval.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const approvalSchema = new Schema({
  approver: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  status: { type: String, enum: ['Approved', 'Rejected'], required: true },
  comments: { type: String },
  approvedAt: { type: Date, default: Date.now }
}, { timestamps: true });


const Approval = mongoose.model('Approval', approvalSchema);
module.exports = Approval;
