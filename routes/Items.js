const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Item = require('../model/Item');
const InvoiceHistory = require('../model/InvoiceHistory');
const Storage = require('../model/Storage');
const Category = require('../model/Category');
const mongoose = require('mongoose');

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
      const { name, productId, mainImageUrl, images, category, subcategory, supplier, profitPercentage, UOM, Specification, Brand } = item;

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
        UOM,              // Ensure UOM is being saved
        Specification,    // Ensure Specification is being saved
        Brand,            // Ensure Brand is being saved
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
      const { productId, buyInvoiceId, quantity, price, cost, storageId, partitionId, dateAdded, note } = update;

      let existingItem = await Item.findOne({ productId });

      if (!existingItem) {
        return res.status(404).json({ message: `Item with productId ${productId} not found` });
      }

      // Validate storageId
      const storage = await Storage.findById(storageId);
      if (!storage) {
        return res.status(404).json({ message: `Storage with id ${storageId} not found` });
      }

      // If partitionId is provided, validate it
      let partition;
      if (partitionId) {
        partition = storage.partitions.id(partitionId);
        if (!partition) {
          return res.status(404).json({ message: `Partition with id ${partitionId} not found` });
        }
      }

      // Update price directly with the new value
      existingItem.price = price;

      // Calculate new average cost
      existingItem.cost = calculateAverageCost(existingItem.cost, existingItem.totalQuantity, cost, quantity);

      // Update total quantity
      existingItem.totalQuantity = Number(existingItem.totalQuantity) + Number(quantity);

      // Add inventory record with dateAdded and note
      existingItem.inventory.push({ 
        buyInvoiceId, 
        quantity, 
        originalPrice: price, 
        originalCost: cost, 
        storage: storageId,
        partition: partitionId || null,
        dateAdded: dateAdded || new Date(),
        note: note || ''
      });

      // Update storage quantities
      const storageQuantity = existingItem.storageQuantities.find(sq => 
        sq.storage && sq.storage.toString() === storageId && (!partitionId || (sq.partition && sq.partition.toString() === partitionId))
      );
      if (storageQuantity) {
        storageQuantity.quantity = Number(storageQuantity.quantity) + Number(quantity);
      } else {
        existingItem.storageQuantities.push({ storage: storageId, partition: partitionId || null, quantity: Number(quantity) });
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
      .select('name productId mainImageUrl price cost totalQuantity profitPercentage category subcategory storageQuantities supplier UOM Specification Brand')
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
  const { name, mainImageUrl, images, category, subcategory, profitPercentage, UOM, Specification, Brand } = req.body;

  try {
    const updatedItem = await Item.findByIdAndUpdate(
      id,
      {
        name,
        mainImageUrl,
        images,
        category,
        subcategory,
        profitPercentage,
        UOM,
        Specification,
        Brand
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
      .populate('category', 'name')
      .populate('subcategory', 'name');

    const response = items.map(item => ({
      name: item.name,
      productId: item.productId,
      mainImageUrl: item.mainImageUrl,
      price: item.price,
      cost: item.cost,
      totalQuantity: item.totalQuantity,
      profitPercentage: item.profitPercentage,
      category: item.category ? item.category.name : null,
      subcategory: item.subcategory ? item.subcategory.name : null
    }));

    res.status(200).json(response);
  } catch (error) {
    console.log(error);
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
      .select('_id name productId mainImageUrl price cost totalQuantity reservedQuantity profitPercentage category subcategory storageQuantities supplier')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('storageQuantities.storage', 'name')
      .populate('supplier', 'name');

    // Transform the response to replace IDs with names
    const transformedItems = items.map(item => ({
      id: item._id,
      name: item.name,
      productId: item.productId,
      mainImageUrl: item.mainImageUrl,
      price: item.price,
      cost: item.cost,
      totalQuantity: item.totalQuantity,
      reservedQuantity: item.reservedQuantity,
      profitPercentage: item.profitPercentage,
      category: item.category ? item.category.name : null,
      subcategory: item.subcategory ? item.subcategory.name : null,
      storageQuantities: item.storageQuantities.map(sq => ({
        storage: sq.storage ? sq.storage.name : null,
        quantity: sq.quantity
      })),
      supplier: item.supplier ? item.supplier.name : null
    }));

    res.status(200).json(transformedItems);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// Get inventory history by item id
router.get('/items/:itemId/inventory', checkPermission('Search_Inv'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { page = 1, limit = 50, exportAll = false } = req.query;
    const queryLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * queryLimit;

    // Fetch the item without populating the entire inventory
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const totalInventory = item.inventory.length;
    let inventoryQuery;

    if (exportAll === 'true') {
      inventoryQuery = item.inventory;
    } else {
      // Use Array.slice for pagination when not exporting all
      inventoryQuery = item.inventory.slice(skip, skip + queryLimit);
    }

    const inventoryWithDetails = await Promise.all(
      inventoryQuery.map(async (inventoryItem) => {
        const storage = await Storage.findById(inventoryItem.storage);
        return {
          ...inventoryItem.toObject(),
          storage: storage ? storage.name : 'Unknown',
          productId: item.productId,
          itemName: item.name,
        };
      })
    );

    const totalPages = Math.ceil(totalInventory / queryLimit);

    res.status(200).json({
      inventory: inventoryWithDetails,
      totalPages: exportAll === 'true' ? 1 : totalPages,
      currentPage: parseInt(page),
      totalItems: totalInventory,
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
    const token = req.headers.authorization.split(' ')[1]; // Extract token from header
    const decodedToken = jwt.verify(token, "your_jwt_secret"); // Verify token
    const userId = decodedToken.id;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid input: items must be an array' });
    }

    // Fetch the user and their roles
    const user = await Admin.findById(userId).populate('roles');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all permissions related to storages
    const storagePermissions = user.roles.reduce((acc, role) => {
      return acc.concat(role.permissions.filter(permission => permission.startsWith('View_Storage_')));
    }, []);

    // Extract the storage IDs from permissions (assuming they follow a pattern like 'View_Storage_<StorageID>')
    const allowedStorageIds = storagePermissions.map(permission => permission.split('_').pop());

    // Find the items in the database and populate the storages
    const foundItems = await Item.find({ _id: { $in: items } })
      .select('name productId storageQuantities')
      .populate({
        path: 'storageQuantities.storage',
        match: { _id: { $in: allowedStorageIds } }, // Filter storages based on permissions
        select: 'name location partitions', // Select the storage details along with partitions
        populate: {
          path: 'partitions',
          select: 'name location' // Select the partition details
        }
      });

    // Transform the data to include storage quantities with storage and partition details
    const result = foundItems.map(item => ({
      itemId: item._id,
      name: item.name,
      productId: item.productId,
      storageQuantities: item.storageQuantities
        .filter(sq => sq.storage) // Filter out any storage that wasn't populated due to permissions
        .map(sq => {
          const partitionDetails = sq.partition
            ? sq.storage.partitions.id(sq.partition)
            : null;

          return {
            storageId: sq.storage._id,
            storageName: sq.storage.name,
            storageLocation: sq.storage.location,
            partitionId: sq.partition ? sq.partition._id : null,
            partitionName: partitionDetails ? partitionDetails.name : null,
            partitionLocation: partitionDetails ? partitionDetails.location : null,
            quantity: sq.quantity
          };
        })
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/categories-with-items', async (req, res) => {
  try {
    const categories = await Category.find({});

    const categoriesWithItems = await Promise.all(categories.map(async (category) => {
      const items = await Item.find({
        category: category._id,
        totalQuantity: { $gt: 0 },
        $expr: { $gt: ['$totalQuantity', '$reservedQuantity'] }
      }).limit(20);

      if (items.length === 0) return null; // Skip categories with no items

      return {
        category: category.name,
        imageUrl: category.imageUrl,
        items: items.map(item => ({
          name: item.name,
          productId: item.productId,
          _id: item._id,
          mainImageUrl: item.mainImageUrl,
          images: item.images,
          price: item.price,
          totalQuantity: item.totalQuantity,
          reservedQuantity: item.reservedQuantity,
        }))
      };
    }));

    // Filter out null values
    const filteredCategoriesWithItems = categoriesWithItems.filter(category => category !== null);

    res.status(200).json(filteredCategoriesWithItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/item/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate productId as a valid ObjectId
    console.log(productId)
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    // Ensure productId is a valid ObjectId
    const item = await Item.findOne({ _id: new mongoose.Types.ObjectId(productId) })
      .select('_id name productId mainImageUrl images price cost totalQuantity category subcategory supplier description UOM Specification Brand');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error });
  }
});

// Route to get items by category with pagination
router.get('/category/items/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1 } = req.query; // Default to page 1 if not provided
    const itemsPerPage = 40;

    // Fetch items based on categoryId with pagination
    const items = await Item.find({ category: categoryId })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    // Count total items for the given category
    const totalItems = await Item.countDocuments({ category: categoryId });

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Return response
    res.status(200).json({
      page: Number(page),
      totalPages,
      totalItems,
      items,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

//search for items as pages
router.get('/search/items', async (req, res) => {
  try {
    const { name, page = 1 } = req.query; // Get the search query and page number from query parameters
    const itemsPerPage = 40;

    // Find items by name using a case-insensitive regex
    const items = await Item.find({ name: new RegExp(name, 'i') })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    // Count total items matching the search query
    const totalItems = await Item.countDocuments({ name: new RegExp(name, 'i') });

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Return response
    res.status(200).json({
      page: Number(page),
      totalPages,
      totalItems,
      items,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Search items by productId or name
router.get('/items/SearchByIdOrName', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const items = await Item.find({
      $or: [
        { productId: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    });

    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an item by ID if no quantity is present in storageQuantities
router.delete('/items/:id', checkPermission('Delete_item'), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Find the item by ID
    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if all storageQuantities have zero quantity
    const hasNonZeroQuantity = item.storageQuantities.some(
      (storageQty) => storageQty.quantity > 0
    );

    if (hasNonZeroQuantity) {
      return res.status(400).json({
        message: 'Item cannot be deleted as it has quantities in storage'
      });
    }

    // Delete the item
    await Item.findByIdAndDelete(itemId);

    res.status(200).json({ message: 'Item successfully deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// edit the price and cost
router.put('/items/editprice/:id', checkPermission('canEditItem'), async (req, res) => {
  const { price, cost } = req.body;
  
  // Validate the input to make sure price and cost are provided
  if (price == null || cost == null) {
    return res.status(400).json({ message: 'Price and cost are required' });
  }

  try {
    // Find the item by ID and update its price and cost
    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      { price, cost },
      { new: true } // This option returns the updated item
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({
      message: 'Item updated successfully',
      item: updatedItem
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


  module.exports = router;