// models/Reconciliation.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const reconciliationSchema = new Schema({
  bankStatement: { type: Schema.Types.ObjectId, ref: 'BankStatement', required: true },
  ledgerEntries: [{
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'GeneralLedger', required: true },
    matched: { type: Boolean, default: false }
  }],
  discrepancies: [{
    type: String,
    description: String
  }],
  reconciledAt: { type: Date },
  reconciledBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

reconciliationSchema.plugin(entityPlugin);

const Reconciliation = mongoose.model('Reconciliation', reconciliationSchema);
module.exports = Reconciliation;
