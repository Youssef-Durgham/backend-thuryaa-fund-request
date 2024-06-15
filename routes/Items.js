const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Item = require('../model/Item');

const router = express.Router();

const checkPermission = (permission) => {
    return async (req, res, next) => {
      console.log(req.headers.authorization, "by func");
      try {
        const token = req.headers.authorization.split(' ')[1];
        console.log(token);
        
        const decoded = jwt.verify(token, 'your_jwt_secret');
        console.log(decoded);
        console.log(permission, token, decoded);
  
        const admin = await Admin.findById(decoded.id).populate('roles');
  
        // Check permissions in directly assigned roles
        const hasPermission = admin.roles.some(role =>
          role.permissions.includes(permission)
        );
  
        console.log(permission, token, decoded, admin, hasPermission);
  
        if (!hasPermission) {
          return res.status(403).json({ message: 'Forbidden' });
        }
  
        req.adminId = decoded.id; // Store the admin ID in the request object
        next();
      } catch (error) {
        console.log("JWT Verification Error:", error.message);
        console.log(error.stack);
        res.status(401).json({ message: 'Unauthorized', error: error.message });
      }
    };
  };



// Helper function to calculate the new average price
function calculateAveragePrice(currentPrice, currentQuantity, newPrice, newQuantity) {
  return ((currentPrice * currentQuantity) + (newPrice * newQuantity)) / (currentQuantity + newQuantity);
}

  
// Define Items Endpoint
router.post('/define-items', checkPermission('Define_items'), async (req, res) => {
  const items = req.body.items; // Expecting an array of items

  try {
    const definedItems = [];

    for (const item of items) {
      const { name, productId, mainImageUrl, images, category, subcategory, supplier, profitPercentage } = item;

      let existingItem = await Item.findOne({ productId });

      if (existingItem) {
        return res.status(400).json({ message: `Item with productId ${productId} already exists` });
      }

      const newItem = new Item({
        name,
        productId,
        mainImageUrl,
        images,
        price: 0,
        cost: 0,
        totalQuantity: 0,
        profitPercentage,
        category,
        subcategory,
        supplier,
        inventory: []
      });

      await newItem.save();
      definedItems.push(newItem);

      const activityLog = new ActivityLog({
        action: 'Add_item',
        performedBy: req.adminId,
        targetItem: newItem._id.toString(),
        userType: 'mm',
        timestamp: new Date()
      });

      await activityLog.save();
    }

    res.status(200).json({ message: 'Items defined successfully', items: definedItems });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Quantities Endpoint
router.post('/update-quantities', checkPermission('Update_quantities'), async (req, res) => {
  const updates = req.body.updates; // Expecting an array of updates

  try {
    const updatedItems = [];

    for (const update of updates) {
      const { productId, buyInvoiceId, quantity, price, cost } = update;

      let existingItem = await Item.findOne({ productId });

      if (!existingItem) {
        return res.status(404).json({ message: `Item with productId ${productId} not found` });
      }

      existingItem.totalQuantity += quantity;
      existingItem.price = calculateAveragePrice(existingItem.price, existingItem.totalQuantity, price, quantity);
      existingItem.cost = calculateAveragePrice(existingItem.cost, existingItem.totalQuantity, cost, quantity);
      existingItem.inventory.push({ buyInvoiceId, quantity, originalPrice: price, originalCost: cost });

      await existingItem.save();
      updatedItems.push(existingItem);

      const activityLog = new ActivityLog({
        action: 'Update_item_qty',
        performedBy: req.adminId,
        targetItem: existingItem._id.toString(),
        userType: 'mm',
        timestamp: new Date()
      });

      await activityLog.save();
    }

    res.status(200).json({ message: 'Item quantities updated successfully', items: updatedItems });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch items by supplier ID with pagination
router.get('/items/supplier/:supplierId', async (req, res) => {
  const { supplierId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
      const totalItems = await Item.countDocuments({ supplier: supplierId });
      const totalPages = Math.ceil(totalItems / limit);
      const items = await Item.find({ supplier: supplierId })
          .populate('category', 'name')
          .populate('subcategory', 'name')
          .skip((page - 1) * limit)
          .limit(limit);

      res.status(200).json({
          currentPage: page,
          totalPages,
          items
      });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// Search items by name or productId
router.get('/items/search', async (req, res) => {
  const { query } = req.query;

  try {
      const items = await Item.find({
          $or: [
              { name: new RegExp(query, 'i') },
              { productId: new RegExp(query, 'i') }
          ]
      });

      res.status(200).json({ items });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// Update item by ID
router.put('/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, mainImageUrl, images, category, subcategory, profitPercentage } = req.body;

  try {
    const updatedItem = await Item.findByIdAndUpdate(
      id,
      {
        name,
        mainImageUrl,
        images,
        category,
        subcategory,
        profitPercentage
      },
      { new: true }
    )
      .populate('category', 'name')
      .populate('subcategory', 'name');

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.status(200).json({ item: updatedItem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


  module.exports = router;