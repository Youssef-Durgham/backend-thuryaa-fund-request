const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  orderId: { type: Number, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  items: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true }
  }],
  status: { type: String, default: 'Pending' },
  workflowStatus: { type: String, default: 'Sales' },
  actions: [{
    action: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    date: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
