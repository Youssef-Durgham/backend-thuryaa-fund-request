// cashbox.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cashboxSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
  totalAmount: { type: Number, default: 0 },
  handoverLogs: [{ type: Schema.Types.ObjectId, ref: 'HandoverLog' }]
});

const Cashbox = mongoose.model('Cashbox', cashboxSchema);

module.exports = Cashbox;
