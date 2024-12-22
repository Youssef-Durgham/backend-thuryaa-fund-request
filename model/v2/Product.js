// models/Product.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const productSchema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, unique: true }, // معرف المنتج الفريد
  description: { type: String },
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
  price: { type: Number, required: true },
  cost: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  unit: { type: String, required: true }, // مثل 'pcs', 'kg'
  reorderLevel: { type: Number, default: 0 }, // مستوى إعادة الطلب
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' }, // المورد
  imageUrl: { type: String },
  // إضافة العملة إذا كان السعر قد تم تخزينه في عملة متعددة
  currency: { type: String, default: 'IQD' }
}, { timestamps: true });

productSchema.plugin(entityPlugin);

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
