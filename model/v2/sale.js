// models/Sale.js
const mongoose = require('mongoose');
const auditMiddleware = require('../../utils/auditMiddleware');
const entityPlugin = require('../../utils/entityPlugin');
const Schema = mongoose.Schema;

const saleSchema = new Schema({
  saleDate: { type: Date, default: Date.now },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  currency: { type: String, default: 'IQD' }, // العملة المستخدمة في البيع
  exchangeRate: { type: Number, default: 1320 }, // سعر الصرف إلى العملة الأساسية
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
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
  approvalWorkflow: { type: Schema.Types.ObjectId, ref: 'ApprovalWorkflow' }, // ربط سير عمل الموافقة
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' } // حالة عملية البيع
}, { timestamps: true });

auditMiddleware(saleSchema, 'Sale');
saleSchema.plugin(entityPlugin);

// إضافة فهارس على الحقول المستخدمة في الفلاتر
saleSchema.index({ saleDate: 1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ createdBy: 1 });

const Sale = mongoose.model('Sale', saleSchema);
module.exports = Sale;
