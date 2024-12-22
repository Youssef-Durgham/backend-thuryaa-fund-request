// models/Entity.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const entitySchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['Company', 'Branch', 'Department', 'Division'],
    required: true 
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Archived'],
    default: 'Active'
  },
  fiscalYearStart: { type: Date, required: true },
  fiscalYearEnd: { type: Date, required: true },
  baseCurrency: { type: String, default: 'IQD' },
  parentEntity: { type: Schema.Types.ObjectId, ref: 'Entity' }, // For hierarchical structure
  taxIdentificationNumber: { type: String },
  registrationNumber: { type: String },
  legalName: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  contact: {
    phone: String,
    email: String,
    website: String
  },
  settings: {
    accountingMethod: { 
      type: String, 
      enum: ['Cash', 'Accrual'],
      default: 'Accrual'
    },
    automaticClosingPeriod: { type: Boolean, default: false },
    requireDoubleEntry: { type: Boolean, default: true },
    allowNegativeInventory: { type: Boolean, default: false },
    lockPeriodDays: { type: Number, default: 30 }
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { 
  timestamps: true,
  strict: true
});

// Indexes
entitySchema.index({ code: 1 }, { unique: true });
entitySchema.index({ parentEntity: 1 });
entitySchema.index({ status: 1 });

const Entity = mongoose.model('Entity', entitySchema);
module.exports = Entity;