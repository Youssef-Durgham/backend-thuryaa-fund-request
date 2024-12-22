// models/AccountsPayable.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const accountsPayableSchema = new Schema({
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Paid', 'Overdue'], default: 'Pending' },
  description: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

accountsPayableSchema.index({ supplier: 1 });
accountsPayableSchema.index({ dueDate: 1 });
accountsPayableSchema.index({ status: 1 });

accountsPayableSchema.plugin(entityPlugin);

const AccountsPayable = mongoose.model('AccountsPayable', accountsPayableSchema);
module.exports = AccountsPayable;
