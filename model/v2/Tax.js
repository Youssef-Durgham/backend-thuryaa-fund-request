// models/Tax.js (Enhanced version)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const taxPeriodSchema = new Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['Open', 'Closed', 'Filed'],
    default: 'Open'
  },
  filingDate: Date,
  filedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
});

const taxRuleSchema = new Schema({
  name: { type: String, required: true },
  rate: { type: Number, required: true },
  category: { 
    type: String, 
    enum: ['Sales', 'Purchase', 'Income', 'Property', 'Custom'],
    required: true 
  },
  applicableAccounts: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
  isCompound: { type: Boolean, default: false },
  exemptionThreshold: { type: Number },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  notes: String,
  isActive: { type: Boolean, default: true }
});

const taxTransactionSchema = new Schema({
  date: { type: Date, required: true },
  taxRule: { type: Schema.Types.ObjectId, ref: 'TaxRule', required: true },
  baseAmount: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  reference: { type: Schema.Types.ObjectId, refPath: 'referenceModel' },
  referenceModel: { 
    type: String, 
    enum: ['Sale', 'Purchase', 'Expense'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Filed', 'Paid', 'Refunded'],
    default: 'Pending'
  },
  period: { type: Schema.Types.ObjectId, ref: 'TaxPeriod' }
}, { timestamps: true });

const TaxPeriod = mongoose.model('TaxPeriod', taxPeriodSchema);
const TaxRule = mongoose.model('TaxRule', taxRuleSchema);
const TaxTransaction = mongoose.model('TaxTransaction', taxTransactionSchema);

module.exports = { TaxPeriod, TaxRule, TaxTransaction };

// models/CostAccounting.js
const costCenterSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Department', 'Project', 'Product', 'Service', 'Location'],
    required: true 
  },
  parent: { type: Schema.Types.ObjectId, ref: 'CostCenter' },
  budget: {
    amount: { type: Number, default: 0 },
    period: { type: String },
    startDate: Date,
    endDate: Date
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive', 'Archived'],
    default: 'Active'
  },
  description: String,
  managers: [{ type: Schema.Types.ObjectId, ref: 'Admin' }]
}, { timestamps: true });

const costAllocationRuleSchema = new Schema({
  name: { type: String, required: true },
  sourceCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', required: true },
  destinationCenters: [{
    center: { type: Schema.Types.ObjectId, ref: 'CostCenter' },
    allocationPercentage: { type: Number, required: true }
  }],
  basis: { 
    type: String, 
    enum: ['Fixed', 'Headcount', 'Revenue', 'Usage', 'Custom'],
    required: true 
  },
  frequency: { 
    type: String, 
    enum: ['Monthly', 'Quarterly', 'Annually', 'OneTime'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

const costTransactionSchema = new Schema({
  date: { type: Date, required: true },
  costCenter: { type: Schema.Types.ObjectId, ref: 'CostCenter', required: true },
  amount: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['Direct', 'Allocated', 'Overhead'],
    required: true 
  },
  description: String,
  reference: { type: Schema.Types.ObjectId, refPath: 'referenceModel' },
  referenceModel: { 
    type: String, 
    enum: ['Expense', 'Purchase', 'Sale', 'Asset'],
    required: true 
  },
  allocatedFrom: { type: Schema.Types.ObjectId, ref: 'CostCenter' },
  allocationRule: { type: Schema.Types.ObjectId, ref: 'CostAllocationRule' }
}, { timestamps: true });

costCenterSchema.plugin(entityPlugin);
costAllocationRuleSchema.plugin(entityPlugin);
costTransactionSchema.plugin(entityPlugin);

const CostCenter = mongoose.model('CostCenter', costCenterSchema);
const CostAllocationRule = mongoose.model('CostAllocationRule', costAllocationRuleSchema);
const CostTransaction = mongoose.model('CostTransaction', costTransactionSchema);

module.exports = { CostCenter, CostAllocationRule, CostTransaction };