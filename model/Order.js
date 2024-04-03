const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true, default: 1 }
  });
  
  const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Add this line
    orderType: { type: String, required: true, enum: ['sell', 'return', 'exchange', 'transfer', 'direct sell'] }, // New field
    customerName: { type: String, required: true },
    items: [orderItemSchema],
    totalPrice: { type: Number, required: true },
    invoiceNumber: {type: String, required: true},
    note: { type: String }, // Optional note field
  buyInvoiceNumber: { type: String }, // Optional buy invoice number field
    createdAt: { type: Date, default: Date.now }
  });
  
  orderSchema.pre('save', async function(next) {
    let total = 0;
    for (let item of this.items) {
      const inventoryItem = await mongoose.model('Inventory').findById(item.inventoryItem);
      if (!inventoryItem) {
        throw new Error('Item not found in inventory');
      }
      if (item.quantity > inventoryItem.quantity) {
        throw new Error('Insufficient item quantity in inventory');
      }
  
      // Calculate total price
      total += inventoryItem.price * item.quantity;
  
      // Decrease inventory quantity
      inventoryItem.quantity -= item.quantity;
      await inventoryItem.save();
    }
    this.totalPrice = total;
    next();
  });
  // orderSchema.pre('save', async function(next) {
  //   let total = 0;
  //   for (let item of this.items) {
  //     const inventoryItem = await mongoose.model('Inventory').findById(item.inventoryItem);
  //     if (!inventoryItem) {
  //       throw new Error('Item not found in inventory');
  //     }
    
  //     // Calculate total price
  //     total += inventoryItem.price * item.quantity;
    
  //     // Decrease inventory quantity - Allow it to go negative
  //     inventoryItem.quantity -= item.quantity;
  //     await inventoryItem.save();
  //   }
  //   this.totalPrice = total;
  //   next();
  // });
  
  
  module.exports = mongoose.model('Order', orderSchema);
  