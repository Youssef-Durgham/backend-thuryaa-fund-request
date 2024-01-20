const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, required: true, unique: true }, // Added barcode field
  quantity: { type: Number, required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  price: { type: Number },
  // Additional fields as needed
});

module.exports = mongoose.model('Inventory', inventorySchema);
