const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  // Add other relevant fields
});

module.exports = mongoose.model('Location', locationSchema);
