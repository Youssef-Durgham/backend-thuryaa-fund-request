const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionOrderSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['Post', 'PartialDelivery', 'FullDelivery', 'PartialCancellation', 'FullCancellation', 'Refund'] 
  },
  items: [{
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  amount: { type: Number, required: true },
  performedBy: { type: Schema.Types.ObjectId, required: true },
  performedByType: { type: String, required: true, enum: ['Admin', 'Customer', 'Casher', 'Mm'] },
  date: { type: Date, default: Date.now }
});

const TransactionOrder = mongoose.model('TransactionOrder', transactionOrderSchema);
module.exports = TransactionOrder;