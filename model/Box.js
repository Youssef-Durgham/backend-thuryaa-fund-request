// models/Box.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const boxSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'Admin' },  // Reference to the admin who owns this box
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Box = mongoose.model('Box', boxSchema);
module.exports = Box;