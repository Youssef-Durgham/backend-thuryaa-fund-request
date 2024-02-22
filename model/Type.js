const mongoose = require('mongoose');

const typeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true }
  // ... additional fields ...
});

module.exports = mongoose.model('Type', typeSchema);