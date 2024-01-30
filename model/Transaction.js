const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    opNumber: { type: String, required: true, unique: true },
    items: [{
        itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
        quantity: { type: Number, required: true },
    }],
    transactionType: { type: String, enum: ['add', 'transfer', 'direct sale', 'sale'], required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
