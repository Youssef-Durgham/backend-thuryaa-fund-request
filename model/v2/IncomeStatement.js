// models/IncomeStatement.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const incomeStatementSchema = new Schema({
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  revenues: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  expenses: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  netIncome: { type: Number, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

incomeStatementSchema.plugin(entityPlugin);

const IncomeStatement = mongoose.model('IncomeStatement', incomeStatementSchema);
module.exports = IncomeStatement;
