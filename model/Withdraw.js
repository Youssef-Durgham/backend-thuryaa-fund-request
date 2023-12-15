const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const withdrawSchema = new mongoose.Schema({
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    amount: {
      type: Number,
      required: true,
    },
    idorder: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  });
  
  withdrawSchema.plugin(mongoosePaginate);
  
  module.exports = mongoose.model('Withdraw', withdrawSchema);
  