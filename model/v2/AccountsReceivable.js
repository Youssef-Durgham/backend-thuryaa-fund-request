// models/AccountsReceivable.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const accountsReceivableSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Received', 'Overdue'], default: 'Pending' },
  description: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

accountsReceivableSchema.index({ customer: 1 });
accountsReceivableSchema.index({ dueDate: 1 });
accountsReceivableSchema.index({ status: 1 });

accountsReceivableSchema.plugin(entityPlugin);

const AccountsReceivable = mongoose.model('AccountsReceivable', accountsReceivableSchema);
module.exports = AccountsReceivable;
