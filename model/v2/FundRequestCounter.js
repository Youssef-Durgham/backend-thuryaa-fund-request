const mongoose = require('mongoose');

const fundRequestCounterSchema = new mongoose.Schema({
  date: { type: String, unique: true, required: true }, // Format: YYYYMMDD
  sequence: { type: Number, default: 0 }
});

const FundRequestCounter = mongoose.model('FundRequestCounter', fundRequestCounterSchema);

module.exports = FundRequestCounter;
