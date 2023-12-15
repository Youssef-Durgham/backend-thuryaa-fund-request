const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deposit', 'withdraw'],  // ensure type is either 'deposit' or 'withdraw'
    required: true
  },
  transactionNumber: {
    type: String,
    unique: true,
    required: true,
  },
  manualtransactionNumber: {
    type: String,
    required: true,
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
  },
  amount: {
    type: Number,
    required: true,
  },
  debt: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


module.exports = mongoose.model('Transaction', transactionSchema);
