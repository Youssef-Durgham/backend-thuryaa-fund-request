const mongoose = require('mongoose');

const fundRequestSchema = new mongoose.Schema({
  uniqueCode: { type: String, unique: true, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['USD', 'IQD', 'EUR'], required: true }, // Currency field
  requestFundType: { type: String, required: true }, // Fund Type
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  project: { type: String, required: false }, // Reference to project
  department: { type: String, required: true }, // Reference to department
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Canceled'], default: 'Pending' },
  details: { type: mongoose.Schema.Types.Mixed },
  companyName: { type: String, required: true },
  projectName: { type: String, required: false },
  documents: [{ type: String }],
  items: [
    {
      name: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }
  ], // Support multiple items in fund request
  requestDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const FundRequest = mongoose.model('FundRequest', fundRequestSchema);

module.exports = FundRequest;
