// models/JournalTemplate.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const journalTemplateSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  entries: [{
    debitAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    creditAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true },
    description: { type: String }
  }],
  complexEntries: [{
    accounts: [{
      account: { type: Schema.Types.ObjectId, ref: 'Account'},
      debit: { type: Number, default: 0 },
      credit: { type: Number, default: 0 }
    }],
    description: { type: String }
  }],
  frequency: { 
    type: String, 
    enum: ['Daily', 'Weekly', 'Monthly', 'Yearly'], 
    required: true 
  },
  nextRunDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

journalTemplateSchema.plugin(entityPlugin);

const JournalTemplate = mongoose.model('JournalTemplate', journalTemplateSchema);
module.exports = JournalTemplate;
