const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../utils/entityPlugin');

const subcategorySchema = new Schema({
  name: { type: String, required: true },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  imageUrl: { type: String }
});

subcategorySchema.plugin(entityPlugin);

const Subcategory = mongoose.model('Subcategory', subcategorySchema);

module.exports = Subcategory;
