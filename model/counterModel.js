const mongoose = require('mongoose');

// Counter Schema for auto-increment
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

// Export the Counter model
module.exports = mongoose.model('Counter', CounterSchema);
