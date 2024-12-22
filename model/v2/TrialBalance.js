// models/TrialBalance.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const trialBalanceSchema = new Schema({
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  accounts: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  }],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

trialBalanceSchema.plugin(entityPlugin);

const TrialBalance = mongoose.model('TrialBalance', trialBalanceSchema);
module.exports = TrialBalance;
