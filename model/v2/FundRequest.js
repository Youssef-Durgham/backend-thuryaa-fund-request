const mongoose = require('mongoose');

const fundRequestSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' },
    details: { type: mongoose.Schema.Types.Mixed }, // Additional details
    createdAt: { type: Date, default: Date.now }
  });
  
  const FundRequest = mongoose.model('FundRequest', fundRequestSchema);
  
module.exports = FundRequest;