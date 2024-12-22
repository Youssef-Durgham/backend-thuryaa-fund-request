const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../utils/entityPlugin');

const supplierSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: false },
  location: { type: String, required: false },
  note: { type: String, required: false }
});

supplierSchema.plugin(entityPlugin);

const Supplier = mongoose.model('Supplier', supplierSchema);

module.exports = Supplier;
