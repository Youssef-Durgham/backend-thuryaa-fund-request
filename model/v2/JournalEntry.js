// models/JournalEntry.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const journalEntryLineSchema = new Schema({
  account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  description: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  currency: { type: String, default: 'IQD' },
  exchangeRate: { type: Number, default: 1 },
  debitInBaseCurrency: { type: Number, default: 0 },
  creditInBaseCurrency: { type: Number, default: 0 }
});

const journalEntrySchema = new Schema({
  entryNumber: { 
    type: String, 
    required: true,
    unique: true
  },
  date: { 
    type: Date, 
    required: true,
    index: true 
  },
  postingDate: { type: Date },
  type: {
    type: String,
    enum: ['Standard', 'Adjusting', 'Reversing', 'Recurring', 'Closing'],
    default: 'Standard'
  },
  status: {
    type: String,
    enum: ['Draft', 'PendingApproval', 'Approved', 'Posted', 'Rejected', 'Reversed'],
    default: 'Draft'
  },
  description: { type: String, required: true },
  reference: { type: String },
  entries: [journalEntryLineSchema],
  totalDebit: { type: Number, required: true },
  totalCredit: { type: Number, required: true },
  baseCurrency: { type: String, default: 'IQD' },
  totalDebitInBaseCurrency: { type: Number, required: true },
  totalCreditInBaseCurrency: { type: Number, required: true },
  attachments: [{
    name: { type: String },
    url: { type: String }
  }],
  recurring: {
    isRecurring: { type: Boolean, default: false },
    frequency: { 
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly']
    },
    nextDueDate: { type: Date },
    endDate: { type: Date }
  },
  approvalHistory: [{
    action: { 
      type: String,
      enum: ['Submit', 'Approve', 'Reject', 'Revise']
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    date: { type: Date },
    comments: { type: String }
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  reversedBy: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  reversalOf: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  period: { type: String }, // For accounting period tracking
  tags: [{ type: String }]
}, { 
  timestamps: true,
  strict: true
});

// Add compound index for efficient querying
journalEntrySchema.index({ date: 1, status: 1, type: 1 });

// Pre-save middleware to validate debits = credits
journalEntrySchema.pre('save', function(next) {
  const totalDebit = this.entries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = this.entries.reduce((sum, entry) => sum + entry.credit, 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    next(new Error('Total debits must equal total credits'));
  }
  
  this.totalDebit = totalDebit;
  this.totalCredit = totalCredit;
  next();
});

journalEntrySchema.plugin(entityPlugin);

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);
module.exports = JournalEntry;