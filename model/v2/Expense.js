// models/Expense.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const expenseSchema = new Schema({
  expenseDate: { type: Date, default: Date.now },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  isCanceled: { type: Boolean, default: false },
  canceledAt: { type: Date },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

// إضافة فهارس على الحقول المستخدمة في الفلاتر
expenseSchema.index({ expenseDate: 1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ createdBy: 1 });

expenseSchema.plugin(entityPlugin);

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;
