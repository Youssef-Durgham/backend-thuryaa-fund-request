const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  orderId: { type: Number, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  items: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true },
    deliveredQuantity: { type: Number, default: 0 },
    cancelledQuantity: { type: Number, default: 0 }
  }],
  status: { type: String, default: 'Pending' },
  workflowStatus: { type: String, default: 'Sales' },
  actions: [{
    action: { type: String, required: true },
    userType: { type: String, required: true, enum: ['Admin', 'Customer', 'Mm', 'Casher'], default: 'Admin' },
    user: { type: Schema.Types.ObjectId, required: true, refPath: 'actions.userType' },
    date: { type: Date, default: Date.now },
    details: {
      items: [{
        item: { type: Schema.Types.ObjectId, ref: 'Item' },
        quantity: Number,
        deliveredQuantity: Number,
        cancelledQuantity: Number,
        price: Number
      }],
      totalAmount: Number
    }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
