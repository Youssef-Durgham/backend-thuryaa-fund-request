const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const invoiceItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  cost: { type: Number, required: true },
});

const invoiceHistorySchema = new Schema({
  buyInvoiceId: { type: String, required: true },
  items: [invoiceItemSchema],
  timestamp: { type: Date, default: Date.now }
});

const InvoiceHistory = mongoose.model('InvoiceHistory', invoiceHistorySchema);

module.exports = InvoiceHistory;
