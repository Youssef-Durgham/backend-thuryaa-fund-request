const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  amount: {
    type: Number,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  OperationId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
