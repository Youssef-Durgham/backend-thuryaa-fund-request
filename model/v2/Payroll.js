// models/Payroll.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const payrollSchema = new Schema({
  payrollDate: { type: Date, required: true },
  employees: [{
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    grossSalary: { type: Number, required: true },
    deductions: { type: Number, required: true },
    netSalary: { type: Number, required: true }
  }],
  totalGross: { type: Number, required: true },
  totalDeductions: { type: Number, required: true },
  totalNet: { type: Number, required: true },
  isProcessed: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

payrollSchema.plugin(entityPlugin);

const Payroll = mongoose.model('Payroll', payrollSchema);
module.exports = Payroll;
