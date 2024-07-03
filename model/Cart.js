const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartSchema = new Schema({
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Item', required: true }, // Referring to Item model
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
      }
    ],
    updatedAt: { type: Date, default: Date.now }
  });
  
const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
