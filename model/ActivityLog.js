const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const activityLogSchema = new Schema({
  action: { type: String, required: true }, // e.g., 'assign_role', 'delete_role', 'login'
  performedBy: { type: String, required: true }, // The admin who performed the action
  targetUser: { type: String }, // The user affected by the action
  targetItem: { type: String }, // The user affected by the action
  userType: { type: String, required: true, enum: ['Admin', 'Customer', 'system', 'mm'] }, // The type of the target user
  role: { type: String }, // Role ID if action involves a role
  timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
