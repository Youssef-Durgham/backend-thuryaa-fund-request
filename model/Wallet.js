const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const walletSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    balance: { type: Number, default: 0 }
  });
  
  const Wallet = mongoose.model('Wallet', walletSchema);
  
  module.exports = Wallet;
  