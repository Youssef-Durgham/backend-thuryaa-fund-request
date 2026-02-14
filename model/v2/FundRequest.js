const mongoose = require('mongoose');

const fundRequestSchema = new mongoose.Schema({
  uniqueCode: { type: String, unique: true, required: true },
  description: { type: String },
  details: { type: String },
  amount: { type: Number },
  balance: { type: Number },
  currency: { type: String, enum: ['USD', 'IQD', 'EUR'], required: true },
  department: { type: String, required: true },
  handedTo: { type: String },
  customerNumber: { type: String },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Canceled', 'Paid'],
    default: 'Pending'
  },
  items: [{
    name: { type: String },
    quantity: { type: Number },
    price: { type: Number }
  }],
  documents: [{ type: String }],
  attachments: [{ type: String }],
  requestDate: { type: Date, default: Date.now },
  requestTime: { type: String },
  isPaid: { type: Boolean, default: false },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const FundRequest = mongoose.model('FundRequest', fundRequestSchema);

module.exports = FundRequest;
