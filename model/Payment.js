const mongoose = require('mongoose');

const Counter = require('./counterModel');

// Payment Schema
const paymentSchema = new mongoose.Schema({
    transactionNumber: { type: String, unique: true },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['waiting', 'confirmed', 'rejected'], default: 'waiting' },
    paidDate: { type: Date, default: Date.now }
});

// Pre-save hook for auto-incrementing transactionNumber
paymentSchema.pre('save', async function(next) {
    try {
        const counterDoc = await Counter.findByIdAndUpdate(
            { _id: 'paymentTransactionNumber' }, 
            { $inc: { seq: 1 } }, 
            { new: true, upsert: true }
        );
        this.transactionNumber = counterDoc.seq.toString();
        next();
    } catch (error) {
        next(error);
    }
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
