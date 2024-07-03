const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  imageUrl: { type: String }
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
