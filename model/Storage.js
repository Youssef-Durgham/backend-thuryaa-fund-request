const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const partitionSchema = new Schema({
  name: { type: String, required: true },
  location: { type: String, required: true }
});

const storageSchema = new Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  partitions: [partitionSchema],  // Add partitions as a subdocument
});

const Storage = mongoose.model('Storage', storageSchema);

module.exports = Storage;
