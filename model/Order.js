const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  orderId: { type: Number, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  items: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true },
    deliveredQuantity: { type: Number, default: 0 },
    cancelledQuantity: { type: Number, default: 0 },
    deliveryDate: { type: Date }
  }],
  location: { type: String, required: true },
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
        price: Number,
        deliveryDate: Date
      }],
      totalAmount: Number
    }
  }],
  remainingDeliveryDate: { type: Date },  // Moved to main order
  reminderSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
