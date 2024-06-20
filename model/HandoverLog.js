const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const handoverLogSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  cashbox: { type: Schema.Types.ObjectId, ref: 'Cashbox', required: true }
});

const HandoverLog = mongoose.model('HandoverLog', handoverLogSchema);

module.exports = HandoverLog;
