// models/Transaction.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const transactionSchema = new Schema({
  fromBox: { type: Schema.Types.ObjectId, ref: 'Box' },
  toBox: { type: Schema.Types.ObjectId, ref: 'Box' },
  amount: { type: Number, required: true }, // المبلغ بالعملة الأصلية
  currency: { type: String, default: 'IQD' }, // العملة المستخدمة
  exchangeRate: { type: Number, default: 1320 }, // سعر الصرف إلى العملة الأساسية
  amountInBaseCurrency: { type: Number, required: true }, // المبلغ بعد التحويل للعملة الأساسية
  performedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  description: { type: String },
  type: { type: String, enum: ['transfer', 'deposit', 'withdrawal'], required: true },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }]
}, { timestamps: true });

transactionSchema.plugin(entityPlugin);

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
