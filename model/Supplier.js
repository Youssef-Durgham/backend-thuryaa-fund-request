const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const supplierSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: false },
  location: { type: String, required: false },
  note: { type: String, required: false }
});

const Supplier = mongoose.model('Supplier', supplierSchema);

module.exports = Supplier;
