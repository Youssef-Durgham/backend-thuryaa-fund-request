const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    orderId: {
        type: String,
        required: true,
    },
    transactionId: {
        type: String,
    },
    token: {
        type: String,
    },
    link: {
        type: String,
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true
    },
    clonedCartItems: [
        {
            productId: { type: Schema.Types.ObjectId, ref: 'Item', required: true }, // Referring to Item model
            quantity: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],
    location: {
        type: String,
    },
    status: { type: String, required: true, enum: ['pending', 'done'], default: 'pending' },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
