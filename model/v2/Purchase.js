// models/Purchase.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const purchaseSchema = new Schema({
  purchaseDate: { type: Date, default: Date.now },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  currency: { type: String, default: 'IQD' }, // العملة المستخدمة في الشراء
  exchangeRate: { type: Number, default: 1320 }, // سعر الصرف إلى العملة الأساسية
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    cost: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true }, // المبلغ بالعملة الأصلية
  tax: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true }, // المبلغ الإجمالي بعد الضريبة
  amountInBaseCurrency: { type: Number, required: true }, // المبلغ بعد التحويل للعملة الأساسية
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  isCanceled: { type: Boolean, default: false },
  canceledAt: { type: Date },
  description: { type: String },
  relatedLedgerEntries: [{ type: Schema.Types.ObjectId, ref: 'GeneralLedger' }],
  approvalWorkflow: { type: Schema.Types.ObjectId, ref: 'ApprovalWorkflow' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' } // حالة العملية

}, { timestamps: true });

// إضافة فهارس على الحقول المستخدمة في الفلاتر
purchaseSchema.index({ purchaseDate: 1 });
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ createdBy: 1 });
purchaseSchema.index({ entity: 1 });

purchaseSchema.plugin(entityPlugin);

const Purchase = mongoose.model('Purchase', purchaseSchema);
module.exports = Purchase;
