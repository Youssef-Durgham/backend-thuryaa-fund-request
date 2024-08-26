const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionOrderSchema = new Schema({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  transactions: [{
    transactionType: {
      type: String,
      required: true,
      enum: ['Post', 'PartialDelivery', 'FullDelivery', 'PartialCancellation', 'FullCancellation', 'Refund', 'RefundRequested', 'RefundRejected']
    },
    items: [{
      item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      storage: { type: Schema.Types.ObjectId, ref: 'Storage' },
      partition: { type: Schema.Types.ObjectId, ref: 'Partition' }
    }],
    amount: { type: Number, required: true },
    performedBy: { type: Schema.Types.ObjectId, required: true },
    performedByType: { type: String, required: true, enum: ['Admin', 'Customer'] },
    usertype: { type: String, enum: ['Admin', 'Customer', 'Casher', 'Mm'] },
    date: { type: Date, default: Date.now },
    notes: { type: String }
  }]
});

const TransactionOrder = mongoose.model('TransactionOrder', transactionOrderSchema);
module.exports = TransactionOrder;