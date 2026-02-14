const mongoose = require('mongoose');

const fundRequestSchema = new mongoose.Schema({
  uniqueCode: { type: String, unique: true, required: true },
  details: { type: String, required: true },
  balance: { type: Number, required: true },
  currency: { type: String, enum: ['USD', 'IQD', 'EUR'], required: true },
  department: { type: String, required: true },
  handedTo: { type: String }, // تسلم بيد
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Canceled', 'Paid'],
    default: 'Pending'
  },
  attachments: [{ type: String }], // S3 keys
  requestDate: { type: Date, default: Date.now },
  requestTime: { type: String },
  isPaid: { type: Boolean, default: false },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const FundRequest = mongoose.model('FundRequest', fundRequestSchema);

module.exports = FundRequest;
