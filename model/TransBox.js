const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../utils/entityPlugin');

const TransBoxSchema = new Schema({
    fromBox: { type: Schema.Types.ObjectId, ref: 'Box' },
    toBox: { type: Schema.Types.ObjectId, ref: 'Box' }, // Made optional for withdrawals
    amount: { type: Number, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    description: { type: String },
    type: { type: String, enum: ['transfer', 'deposit', 'withdrawal'], required: true }
  }, { timestamps: true });

  TransBoxSchema.plugin(entityPlugin);

const TransBox = mongoose.model('TransBox', TransBoxSchema);
module.exports = TransBox;