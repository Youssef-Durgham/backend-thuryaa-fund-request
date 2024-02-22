const mongoose = require('mongoose');

  const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    types: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Type' }]
    // ... additional fields ...
  });

module.exports = mongoose.model('Group', groupSchema);
