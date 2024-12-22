// models/FinancialReport.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const financialReportSchema = new Schema({
  reportType: { 
    type: String, 
    enum: ['BalanceSheet', 'ProfitAndLoss', 'CashFlow', 'TrialBalance'],
    required: true 
  },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  data: {
    assets: [{
      accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      amount: Number,
      category: String
    }],
    liabilities: [{
      accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      amount: Number,
      category: String
    }],
    equity: [{
      accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      amount: Number,
      category: String
    }],
    revenue: [{
      accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      amount: Number,
      category: String
    }],
    expenses: [{
      accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      amount: Number,
      category: String
    }]
  },
  summary: {
    totalAssets: Number,
    totalLiabilities: Number,
    totalEquity: Number,
    netIncome: Number,
    grossProfit: Number
  },
  status: { 
    type: String, 
    enum: ['Draft', 'Published', 'Archived'],
    default: 'Draft'
  },
  notes: [{ 
    note: String, 
    addedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    addedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Add indices for common queries
financialReportSchema.index({ reportType: 1, periodStart: 1, periodEnd: 1 });
financialReportSchema.index({ status: 1 });
financialReportSchema.index({ createdBy: 1 });

financialReportSchema.plugin(entityPlugin);

const FinancialReport = mongoose.model('FinancialReport', financialReportSchema);
module.exports = FinancialReport;