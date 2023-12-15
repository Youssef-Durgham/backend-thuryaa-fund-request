const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const percentageSchema = new mongoose.Schema({
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: true,
    },
    debtCut: {
      type: Number,
      required: true,
    },
    idorder: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  });
  
  percentageSchema.plugin(mongoosePaginate);
  
  module.exports = mongoose.model('Percentage', percentageSchema);
  