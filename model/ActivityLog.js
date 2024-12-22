const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const activityLogSchema = new Schema({
  action: { type: String, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  targetUser: { type: Schema.Types.ObjectId, ref: 'User' },
  targetItem: { type: Schema.Types.ObjectId, refPath: 'itemType' },
  itemType: { type: String, required: true, enum: ['Product', 'Purchase', 'Sale', 'Expense', 'Account', 'Tax', 'Box', 'CashBox', 'JournalTemplate', 'RecurringEntry', 'BankStatement', 'Reconciliation', 'Payroll', 'CurrencyRevaluation', 'AccountsPayable', 'AccountsReceivable', 'login', 'Admin-Activitys', 'FundRequest'] },
  userType: { type: String, required: true, enum: ['Admin', 'Customer', 'Supplier', 'Employee', 'System'] },
  description: { type: String },
  changes: { type: Schema.Types.Mixed }, // تفاصيل التغييرات
  entity: { type: Schema.Types.ObjectId, ref: 'Entity' }, // إضافة الكيان
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
module.exports = ActivityLog;
