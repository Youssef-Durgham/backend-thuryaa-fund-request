const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actionType: { type: String, required: true, enum: ['add', 'edit', 'delete', 'sell', 'transfer'] },
    details: { type: String },
    date: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('History', historySchema);