const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storageSchema = new Schema({
  name: { type: String, required: true },
  location: { type: String, required: true }
});

const Storage = mongoose.model('Storage', storageSchema);

module.exports = Storage;
