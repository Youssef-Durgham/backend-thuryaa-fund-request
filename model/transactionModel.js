const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, enum: ['debt', 'owes'] },
    amount: { type: Number, required: true },
    amounttx: { type: Number },
    dueDate: { type: Date, required: true },
    paid: { type: Boolean, default: false },
    paypaid: { type: Boolean, default: false },
    paidDate: { type: Date },
    paidAmount: { type: Number },
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
    status: { type: String, enum: ['not set' ,'waiting', 'confirmed', 'rejected'], default: 'not set' },
    notes: [{ type: String }], // Array of notes
    fileLinks: [{ type: String }], // Array of file links
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
