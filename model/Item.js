const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const itemSchema = new Schema({
  name: { type: String, required: true },
  productId: { type: String, required: true, unique: true },
  mainImageUrl: { type: String, required: true },
  images: [{ type: String }],
  price: { type: Number, required: true },
  cost: { type: Number, required: true },
  totalQuantity: { type: Number, required: true },
  reservedQuantity: { type: Number, default: 0 },
  profitPercentage: { type: Number, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategory: { type: Schema.Types.ObjectId, ref: 'Subcategory', required: true },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  UOM: { type: String },
  Specification: { type: String, default: '' },
  Brand: { type: String, default: '' },
  inventory: [{
    buyInvoiceId: { type: String, required: true },
    quantity: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    originalCost: { type: Number, required: true },
    storage: { type: Schema.Types.ObjectId, ref: 'Storage', required: true },
    partition: { type: Schema.Types.ObjectId, ref: 'Storage.partitions' },  // Reference to partition if applicable
    dateAdded: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],
  storageQuantities: [{
    storage: { type: Schema.Types.ObjectId, ref: 'Storage', required: true },
    partition: { type: Schema.Types.ObjectId, ref: 'Storage.partitions' },  // Reference to partition if applicable
    quantity: { type: Number, required: true }
  }]
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;

