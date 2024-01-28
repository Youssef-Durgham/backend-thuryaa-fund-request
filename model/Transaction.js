const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    opNumber: { type: String, required: true, unique: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' }],
    // Additional fields as needed
    date: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('Transaction', transactionSchema);
  