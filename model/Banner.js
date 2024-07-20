const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;