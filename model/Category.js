const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../utils/entityPlugin');

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  imageUrl: { type: String }
});

categorySchema.plugin(entityPlugin);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
