// models/JournalVoucher.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const journalVoucherSchema = new Schema({
  voucherNumber: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  description: { type: String },
  entries: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 }
  }],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  type: { 
    type: String, 
    enum: ['Regular', 'Adjustment', 'Correction'], 
    default: 'Regular' 
  },
  reversingEntry: { type: Schema.Types.ObjectId, ref: 'JournalVoucher' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

journalVoucherSchema.plugin(entityPlugin);

const JournalVoucher = mongoose.model('JournalVoucher', journalVoucherSchema);
module.exports = JournalVoucher;
