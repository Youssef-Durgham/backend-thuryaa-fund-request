const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  barcode: { type: String, required: true },
  quantity: { type: Number, required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  price: { type: Number },
  dateAdded: { type: Date, required: false },
  // Additional fields as needed
});

module.exports = mongoose.model('Inventory', inventorySchema);
