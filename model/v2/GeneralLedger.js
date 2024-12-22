// models/GeneralLedger.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const ledgerEntrySchema = new Schema({
  date: { type: Date, default: Date.now },
  description: { type: String },
  debitAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  creditAccount: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  amount: { type: Number, required: true }, // المبلغ بالعملة الأصلية
  currency: { type: String, default: 'IQD' }, // العملة المستخدمة
  exchangeRate: { type: Number, default: 1 }, // سعر الصرف إلى العملة الأساسية
  amountInBaseCurrency: { type: Number, required: true }, // المبلغ بعد التحويل للعملة الأساسية
  reference: { type: Schema.Types.ObjectId, refPath: 'refModel' }, // مثل Sale, Purchase
  refModel: { type: String, enum: ['Sale', 'Purchase', 'Transfer', 'Expense', 'AccountsPayable', 'AccountsReceivable'], required: true }
}, { timestamps: true });

// إضافة فهارس على الحقول المستخدمة في الفلاتر
ledgerEntrySchema.index({ date: 1 });
ledgerEntrySchema.index({ debitAccount: 1 });
ledgerEntrySchema.index({ creditAccount: 1 });
ledgerEntrySchema.index({ refModel: 1 });

ledgerEntrySchema.plugin(entityPlugin);

const GeneralLedger = mongoose.model('GeneralLedger', ledgerEntrySchema);
module.exports = GeneralLedger;
