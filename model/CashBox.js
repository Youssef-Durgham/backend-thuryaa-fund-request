// models/CashBox.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../utils/entityPlugin');

const cashBoxSchema = new Schema({
  box: { type: Schema.Types.ObjectId, ref: 'Box', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  isOpen: { type: Boolean, default: false },
  openedAt: { type: Date },
  closedAt: { type: Date },
  initialAmount: { type: Number, default: 0 },
  currentAmount: { type: Number, default: 0 },
  transactions: [{ type: Schema.Types.ObjectId, ref: 'Transaction' }]
}, { timestamps: true });

cashBoxSchema.plugin(entityPlugin);

const CashBox = mongoose.model('CashBox', cashBoxSchema);

module.exports = CashBox;