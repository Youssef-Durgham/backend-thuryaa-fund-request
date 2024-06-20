const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const trashSchema = new Schema({
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Trash = mongoose.model('Trash', trashSchema);

module.exports = Trash;
