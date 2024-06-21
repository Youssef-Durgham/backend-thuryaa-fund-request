const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Item = require('../model/Item');
const InvoiceHistory = require('../model/InvoiceHistory');
const Storage = require('../model/Storage');

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
function calculateAverageCost(currentCost, currentQuantity, newCost, newQuantity) {
  return ((currentCost * currentQuantity) + (newCost * newQuantity)) / (currentQuantity + newQuantity);
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
      const { productId, buyInvoiceId, quantity, price, cost, storageId } = update;

      let existingItem = await Item.findOne({ productId });

      if (!existingItem) {
        return res.status(404).json({ message: `Item with productId ${productId} not found` });
      }

      // Validate storageId
      const storage = await Storage.findById(storageId);
      if (!storage) {
        return res.status(404).json({ message: `Storage with id ${storageId} not found` });
      }

      // Update price directly with the new value
      existingItem.price = price;

      // Calculate new average cost
      existingItem.cost = calculateAverageCost(existingItem.cost, existingItem.totalQuantity, cost, quantity);

      // Update total quantity
      existingItem.totalQuantity = Number(existingItem.totalQuantity) + Number(quantity);

      // Add inventory record
      existingItem.inventory.push({ buyInvoiceId, quantity, originalPrice: price, originalCost: cost, storage: storageId });

      // Update storage quantities
      const storageQuantity = existingItem.storageQuantities.find(sq => sq.storage.toString() === storageId);
      if (storageQuantity) {
        storageQuantity.quantity = Number(storageQuantity.quantity) + Number(quantity);
      } else {
        existingItem.storageQuantities.push({ storage: storageId, quantity: Number(quantity) });
      }

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

    // Save invoice history
    const invoiceHistory = new InvoiceHistory({
      buyInvoiceId: updates[0].buyInvoiceId,
      items: updatedItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.totalQuantity,
        price: item.price,
        cost: item.cost,
        storage: item.inventory[item.inventory.length - 1].storage // Last updated storage
      }))
    });

    await invoiceHistory.save();

    res.status(200).json({ message: 'Item quantities updated successfully', items: updatedItems });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch items by supplier ID with pagination
router.get('/items/supplier/:supplierId', checkPermission('Search_Items'), async (req, res) => {
  const { supplierId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    const totalItems = await Item.countDocuments({ supplier: supplierId });
    const totalPages = Math.ceil(totalItems / limit);
    const items = await Item.find({ supplier: supplierId })
      .select('name productId mainImageUrl price cost totalQuantity profitPercentage category subcategory storageQuantities supplier')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('storageQuantities.storage', 'name')
      .populate('supplier', 'name')
      .skip((page - 1) * limit)
      .limit(limit);

    const transformedItems = items.map(item => {
      return {
        ...item.toObject(),
        category: item.category.name,
        subcategory: item.subcategory.name,
        storageQuantities: item.storageQuantities.map(sq => ({
          storage: sq.storage.name,
          quantity: sq.quantity
        })),
        supplier: item.supplier.name
      };
    });

    res.status(200).json({
      currentPage: page,
      totalPages,
      items: transformedItems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search items by name or productId
router.get('/items/search', checkPermission('Search_Items'), async (req, res) => {
  const { query } = req.query;

  try {
      const items = await Item.find({
          $or: [
              { name: new RegExp(query, 'i') },
              { productId: new RegExp(query, 'i') }
          ]
      })
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('supplier', 'name phone');

      res.status(200).json({ items });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// Update item by ID
router.put('/items/:id', checkPermission('Update_Items'), async (req, res) => {
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

// GET items by supplier ID for search in qty screen
router.get('/items/increase/supplier/:supplierId', checkPermission('Search_Items'), async (req, res) => {
  try {
    const supplierId = req.params.supplierId;
    const items = await Item.find({ supplier: supplierId })
      .populate('category', 'name') // Assuming the category schema has a 'name' field
      .populate('subcategory', 'name'); // Assuming the subcategory schema has a 'name' field

    const response = items.map(item => ({
      name: item.name,
      productId: item.productId,
      mainImageUrl: item.mainImageUrl,
      price: item.price,
      cost: item.cost,
      totalQuantity: item.totalQuantity,
      profitPercentage: item.profitPercentage,
      category: item.category.name,
      subcategory: item.subcategory.name
    }));

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all Items and filter by them for a supplier
router.get('/items', checkPermission('Search_Items'), async (req, res) => {
  try {
    const { supplierId, storageIds, search } = req.query;

    // Create a query object
    let query = {};

    // Filter by supplierId if provided
    if (supplierId) {
      query.supplier = supplierId;
    }

    // Filter by storage if provided
    if (storageIds) {
      const storageIdArray = storageIds.split(','); // Assume storageIds is a comma-separated list
      query['storageQuantities.storage'] = { $in: storageIdArray };
    }

    // Search by product name or productId if provided
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') }, // Case-insensitive regex search for name
        { productId: search } // Exact match for productId
      ];
    }

    // Execute the query and populate necessary fields
    const items = await Item.find(query)
      .select('name productId mainImageUrl price cost totalQuantity reservedQuantity profitPercentage category subcategory storageQuantities supplier')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('storageQuantities.storage', 'name')
      .populate('supplier', 'name');

    // Transform the response to replace IDs with names
    const transformedItems = items.map(item => {
      return {
        ...item.toObject(),
        category: item.category.name,
        subcategory: item.subcategory.name,
        storageQuantities: item.storageQuantities.map(sq => ({
          storage: sq.storage.name,
          quantity: sq.quantity
        })),
        supplier: item.supplier.name
      };
    });

    res.status(200).json(transformedItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get inventory history by item id
router.get('/items/:itemId/inventory', checkPermission('Search_Inv'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const item = await Item.findById(itemId).populate('inventory.storage', 'name');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get the total number of inventory records
    const totalInventory = item.inventory.length;

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalInventory / limit);

    // Get the paginated inventory data
    const paginatedInventory = item.inventory.slice((page - 1) * limit, page * limit);

    // Map the paginated inventory to replace storage IDs with names and add item details
    const inventoryWithDetails = await Promise.all(
      paginatedInventory.map(async (inventoryItem) => {
        const storage = await Storage.findById(inventoryItem.storage);
        return {
          ...inventoryItem.toObject(),
          storage: storage.name,
          productId: item.productId,
          itemName: item.name,
        };
      })
    );

    res.status(200).json({
      inventory: inventoryWithDetails,
      totalPages,
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Get storages with non-zero quantity for an item
router.get('/item-storages/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // Fetch the item
    const item = await Item.findById(itemId).populate('storageQuantities.storage');
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Filter storage quantities with non-zero quantities
    const storageDetails = item.storageQuantities
      .filter(sq => sq.quantity > 0)
      .map(sq => ({
        storageId: sq.storage._id,
        storageName: sq.storage.name,
        quantity: sq.quantity
      }));

    res.status(200).json({ storageDetails });
  } catch (error) {
    console.error('Error fetching storages:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Get the avalible qty in each storage for each items
router.post('/items/storage-quantities', async (req, res) => {
  try {
    const { items } = req.body; // Expecting an array of item IDs or product IDs

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid input: items must be an array' });
    }

    // Find the items in the database
    const foundItems = await Item.find({ _id: { $in: items } })
    .select('name productId storageQuantities')
    .populate('storageQuantities.storage', 'name location');  

    // Transform the data to include storage quantities with storage details
    const result = foundItems.map(item => ({
      itemId: item._id,
      name: item.name,
      productId: item.productId,
      storageQuantities: item.storageQuantities.map(sq => ({
        storageId: sq.storage._id,
        storageName: sq.storage.name,
        storageLocation: sq.storage.location,
        quantity: sq.quantity
      }))
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});


  module.exports = router;