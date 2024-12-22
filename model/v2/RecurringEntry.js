// models/RecurringEntry.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const recurringEntrySchema = new Schema({
  template: { type: Schema.Types.ObjectId, ref: 'JournalTemplate', required: true },
  entries: [{
    debitAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    creditAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true },
    description: { type: String }
  }],
  runDate: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

recurringEntrySchema.plugin(entityPlugin);

const RecurringEntry = mongoose.model('RecurringEntry', recurringEntrySchema);
module.exports = RecurringEntry;
