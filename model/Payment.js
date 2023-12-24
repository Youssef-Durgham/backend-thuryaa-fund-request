const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['waiting', 'confirmed', 'rejected'], default: 'waiting' },
    paidDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
