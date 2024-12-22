// models/CashFlowStatement.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const cashFlowStatementSchema = new Schema({
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  operatingActivities: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  investingActivities: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  financingActivities: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  netCashFlow: { type: Number, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

cashFlowStatementSchema.plugin(entityPlugin);

const CashFlowStatement = mongoose.model('CashFlowStatement', cashFlowStatementSchema);
module.exports = CashFlowStatement;
