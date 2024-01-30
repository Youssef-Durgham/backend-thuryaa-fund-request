const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { body, validationResult } = require('express-validator');
const Location = require('../model/Location.js');
const Inventory = require("../model/Inventory.js");
const Order = require("../model/Order.js");
const History = require("../model/History.js");
const { v5: uuidv5 } = require('uuid');
const Transaction = require("../model/Transaction.js");

function generateOpNumber() {
  // High-resolution timestamp in microseconds
  const timestamp = process.hrtime.bigint().toString(36);

  // Generate a short random string
  const randomPart = Math.random().toString(36).substring(2, 6);

  // Combine timestamp and random string
  return timestamp + randomPart;
}

router.get('/generate-op-number', (req, res) => {
  const opNumber = generateOpNumber();
  res.json({ opNumber });
});


router.get('/transactions/:opNumber', async (req, res) => {
  try {
    const { opNumber } = req.params;
    const transaction = await Transaction.findOne({ opNumber }).populate('items');
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


//api to login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.correctPassword(password))) {
      return res.status(401).json({ message: "Incorrect username or password" });
    }

    // Create and send token (you'll need to set up a secret for JWT)
    const token = jwt.sign({ id: user._id, role: user.role }, 'your_jwt_secret', { expiresIn: '90d' });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

//api to create user
router.post('/create-user', [
  body('username').isString().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').isIn(['manager', 'seller', 'storage', 'admin', 'inventory', 'logistics']).withMessage('Invalid role'),
  body('name').isString().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('location').not().isEmpty().withMessage('Location is required'),
  // Add more validators as needed
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, role, name, email, location } = req.body;

  try {
    // Check if location exists
    const locationExists = await Location.findById(location);
    if (!locationExists) {
      return res.status(404).json({ message: "Location not found" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with given username or email' });
    }

    // Create new user
    const newUser = new User({ username, password, role, name, email, location });
    await newUser.save();

    // Exclude sensitive information like password from the response
    newUser.password = undefined; 
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// edit user data
router.put('/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// list all user
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    let query = {};

    if (role) {
      query.role = role;
    }

    const users = await User.find(query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// change user password
router.post('/admin/reset-password/:userId', async (req, res) => {
  try {
    const { newPassword } = req.body; // Admin provides the new password
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/change-role/:userId', async (req, res) => {
  try {
    const { newRole } = req.body; // Admin provides the new role
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['manager', 'seller', 'storage', 'admin', 'inventory', 'logistics'].includes(newRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    user.role = newRole;
    await user.save();

    res.status(200).json({ message: 'User role updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Location
router.post('/locations', async (req, res) => {
  try {
    const newLocation = new Location(req.body);
    await newLocation.save();
    res.status(201).json(newLocation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update Location
router.put('/locations/:id', async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete Location
router.delete('/locations/:id', async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List Locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add Inventory Item
router.post('/inventory', async (req, res) => {
  try {
    const existingItem = await Inventory.findOne({ barcode: req.body.barcode });
    if (existingItem) {
      existingItem.quantity += req.body.quantity;
      await existingItem.save();
      res.json(existingItem);
    } else {
      const newItem = new Inventory(req.body);
      await newItem.save();

      // Record the add action in history
      const historyEntry = new History({
        userId: req.body.userId, // Get the user ID from the request body
        actionType: 'add',
        details: `Added new item: ${JSON.stringify(newItem)}`
      });
      await historyEntry.save();

      res.status(201).json(newItem);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/inventory/bulk', async (req, res) => {
  try {
    const { items, opNumber } = req.body;
    let { transactionType } = req.body;

    // Set default transaction type to 'add' if not provided
    transactionType = transactionType || 'add';

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid input: Expected an array of items." });
    }

    const transactionItems = [];
    for (const item of items) {
      const existingItem = await Inventory.findOne({ barcode: item.barcode });
      let inventoryItem;

      if (existingItem) {
        // Adjust quantity for 'add' transaction type
        if (transactionType === 'add') {
          existingItem.quantity += item.quantity;
        }
        // Other transaction types like 'transfer', 'direct sale', 'sale' will have different logic

        if (item.dateAdded) {
          existingItem.dateAdded = new Date(item.dateAdded);
        }
        await existingItem.save();
        inventoryItem = existingItem;
      } else {
        if (!item.dateAdded) {
          item.dateAdded = new Date();
        } else {
          item.dateAdded = new Date(item.dateAdded);
        }
        const newItem = new Inventory(item);
        await newItem.save();
        inventoryItem = newItem;
      }

      transactionItems.push({ itemId: inventoryItem._id, quantity: item.quantity });
    }

    const transaction = new Transaction({
      opNumber,
      items: transactionItems,
      transactionType
    });
    await transaction.save();

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/transfer-inventory/bulk', async (req, res) => {
  try {
    const { transfers, opNumber } = req.body; // transfers is an array of objects { userId, itemId, quantity, fromLocationId, toLocationId }

      if (!Array.isArray(transfers)) {
          return res.status(400).json({ message: "Invalid input: Expected an array of transfers." });
      }

      const transactionItems = [];
      for (const transfer of transfers) {
          const { userId, itemId, quantity: quantityString, fromLocationId, toLocationId } = transfer;

          // Convert quantity from string to number and validate
          const quantity = parseInt(quantityString, 10);
          if (isNaN(quantity)) {
              throw new Error('Invalid quantity format');
          }

          // Find and validate inventory item
          const inventoryItem = await Inventory.findOne({
              _id: itemId,
              location: fromLocationId
          });
          if (!inventoryItem || quantity > inventoryItem.quantity) {
              throw new Error('Inventory item not found or insufficient quantity');
          }

          // Update or create destination inventory
          let destinationInventory = await Inventory.findOne({
              barcode: inventoryItem.barcode,
              location: toLocationId
          });
          if (destinationInventory) {
              destinationInventory.quantity += quantity;
              await destinationInventory.save();
          } else {
              const newInventory = new Inventory({
                  name: inventoryItem.name,
                  barcode: inventoryItem.barcode,
                  quantity,
                  location: toLocationId,
                  price: inventoryItem.price
              });
              await newInventory.save();
          }

          // Deduct the quantity from the source location
          inventoryItem.quantity -= quantity;
          await inventoryItem.save();

          // Prepare transaction item
          transactionItems.push({ inventoryItem: inventoryItem._id, quantity });

          // Create a transfer order for each item (optional: you might want one order for all transfers)
          const transferOrder = new Order({
              user: userId,
              customerName: 'Inventory Transfer',
              items: [{ inventoryItem: inventoryItem._id, quantity: quantity }],
              totalPrice: 0,
              invoiceNumber: generateInvoiceNumber(),
              orderType: 'transfer'
          });
          await transferOrder.save();
      }

      // Create a bulk transaction
      const bulkTransaction = new Transaction({
        opNumber,
        items: transactionItems,
        transactionType: 'transfer' // or any other relevant type according to your application logic
    });
    await bulkTransaction.save();

      res.status(201).json(bulkTransaction);
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
});

// Update Inventory Item
router.put('/inventory-edit/:id', async (req, res) => {
  try {
    // First, find the current state of the item
    const currentItem = await Inventory.findById(req.params.id);
    if (!currentItem) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    // Store old data for history
    const oldData = {
      name: currentItem.name,
      barcode: currentItem.barcode,
      quantity: currentItem.quantity,
      location: currentItem.location,
      price: currentItem.price
    };

    // Update the item with new data
    const updatedItem = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedItem) {
      return res.status(404).json({ message: 'Error updating item' });
    }

    // Store new data for history
    const newData = {
      name: updatedItem.name,
      barcode: updatedItem.barcode,
      quantity: updatedItem.quantity,
      location: updatedItem.location,
      price: updatedItem.price
    };

    // Record the edit action in history
    const historyEntry = new History({
      userId: req.body.userId, // Assuming you have the user ID from session or token
      actionType: 'edit',
      details: `Edited item with ID: ${req.params.id}. Old data: ${JSON.stringify(oldData)}, New data: ${JSON.stringify(newData)}`
    });
    await historyEntry.save();

    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete Inventory Item
router.delete('/inventory-delete/:id', async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }

    const historyDetails = `Deleted item '${item.name}' with barcode: ${item.barcode}, quantity: ${item.quantity}, and ID: ${req.params.id}`;

    const historyEntry = new History({
      userId: req.query.userId, // Get user ID from query parameters
      actionType: 'delete',
      details: historyDetails
    });
    await historyEntry.save();

    await Inventory.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List Inventory Items
router.get('/inventory', async (req, res) => {
  try {
    const pageSize = 10;
    const page = parseInt(req.query.page) || 1;
    const userId = req.query.userId;
    const locationFilter = req.query.location; // Get location filter from query

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let query = {};
    if (user.role !== 'admin' && user.role !== 'manager') {
      query.location = user.location;
    } else if (locationFilter && locationFilter !== 'All') {
      query.location = locationFilter; // Apply location filter for admin
    }

    const totalItems = await Inventory.countDocuments(query);
    const totalPages = Math.ceil(totalItems / pageSize);
    const items = await Inventory.find(query)
                                 .skip((page - 1) * pageSize)
                                 .limit(pageSize);

    res.json({ items, page, pageSize, totalItems, totalPages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/inventory/:barcode', async (req, res) => {
  try {
    const barcode = req.params.barcode;
    const item = await Inventory.findOne({ barcode: barcode });

    if (!item) {
      return res.status(404).send('Item not found');
    }

    res.send(item);
  } catch (error) {
    res.status(500).send('Server error');
  }
});


router.get('/inventory-user', async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have user's id from the request
    const user = await User.findById(userId).populate('location');
    if (!user || !user.location) {
      return res.status(404).json({ message: 'User or user location not found' });
    }

    const pageSize = 10; // Set page size
    const page = parseInt(req.query.page) || 1; // Current page

    const items = await Inventory.find({ location: user.location._id })
                                .skip((page - 1) * pageSize)
                                .limit(pageSize);

    res.json({ items, page, pageSize });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// search for items
router.get('/inventory/search', async (req, res) => {
  try {
    const userId = req.query.userId;
    const query = req.query.q; // Search query
    const inventoryId = req.query.inventoryId; // Optional Inventory ID from the query
    const pageSize = 10; // Set page size
    const page = parseInt(req.query.page) || 1; // Current page

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let searchCriteria = {
      name: { $regex: query, $options: "i" } // Search by name
    };

    // For non-admin users, restrict search to the user's location
    if (user.role !== 'admin') {
      searchCriteria.location = user.location;
    } else if (req.query.location && req.query.location !== 'All') {
      // For admin users, apply location filter if provided
      searchCriteria.location = req.query.location;
    }

    // Apply inventory ID filter if provided
    if (inventoryId) {
      searchCriteria._id = inventoryId;
    }

    const searchItems = await Inventory.find(searchCriteria)
                                .skip((page - 1) * pageSize)
                                .limit(pageSize);

    res.json({ items: searchItems, page, pageSize });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/inventory/search/transfer', async (req, res) => {
  try {
    const { userId, q: query, inventoryId, page: pageQuery, location: locationQuery } = req.query;
    const pageSize = 10; // Set page size
    const page = parseInt(pageQuery) || 1; // Current page

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let searchCriteria = { name: { $regex: query, $options: "i" } }; // Search by name

    // For non-admin users, restrict search to the user's location
    if (user.role !== 'admin') {
      searchCriteria.location = user.location;
    } else if (locationQuery && locationQuery !== 'All') {
      // For admin users, apply location filter if provided
      searchCriteria.location = locationQuery;
    }

    // Apply inventory ID filter if provided
    if (inventoryId) {
      searchCriteria._id = inventoryId;
    }

    const searchItems = await Inventory.find(searchCriteria)
                                .skip((page - 1) * pageSize)
                                .limit(pageSize);

    res.json({ items: searchItems, page, pageSize });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// api for sell order
router.post('/orders', async (req, res) => {
  try {
    const { userId, customerName, items, totalPrice, invoiceNumber } = req.body; // Include userId in the request

    // Find the user by userId
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate totalPrice in the pre-save hook instead of here
    const newOrder = new Order({
      user: userId, // Associate the user with the order
      customerName,
      items,
      totalPrice: totalPrice,
      invoiceNumber,
      orderType: 'sell'
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

function generateInvoiceNumber() {
  const timestamp = Date.now();
  return `INV-${timestamp}`;
}

router.post('/direct-sale', async (req, res) => {
  try {
    const { userId, barcode, quantity, invoiceNumber } = req.body;

    // Find the user by userId
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the inventory item by barcode
    const inventoryItem = await mongoose.model('Inventory').findOne({ barcode: barcode });
    if (!inventoryItem || quantity > inventoryItem.quantity) {
      return res.status(400).json({ message: 'Invalid barcode or insufficient inventory quantity' });
    }

    // Create a new order item
    const orderItem = {
      inventoryItem: inventoryItem._id,
      quantity: quantity
    };

    // Create a new order
    const newOrder = new Order({
      user: userId,
      customerName: user.name, // Assuming the user model has a 'name' field
      items: [orderItem],
      totalPrice: inventoryItem.price * quantity,
      invoiceNumber: invoiceNumber, // Implement this function as per your requirement
      orderType: 'direct sell'
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/transfer-inventory', async (req, res) => {
  try {
    const { userId, itemId, quantity: quantityString, fromLocationId, toLocationId } = req.body;

    // Convert quantity from string to number
    const quantity = parseInt(quantityString, 10);
    if (isNaN(quantity)) {
      return res.status(400).json({ message: 'Invalid quantity format' });
    }

    // Find the inventory item by ID at the original location
    const inventoryItem = await mongoose.model('Inventory').findOne({
      _id: itemId,
      location: fromLocationId
    });
    if (!inventoryItem) {
      return res.status(404).json({ message: 'Inventory item not found at the original location' });
    }

    // Check if the quantity is available in the current location
    if (quantity > inventoryItem.quantity) {
      return res.status(400).json({ message: 'Insufficient quantity in current inventory', requested: quantity, available: inventoryItem.quantity });
    }

    // Handle the inventory at the destination location
    let destinationInventory = await mongoose.model('Inventory').findOne({
      barcode: inventoryItem.barcode,
      location: toLocationId
    });

    if (destinationInventory) {
      // If found, update its quantity
      destinationInventory.quantity += quantity;
      await destinationInventory.save();
    } else {
      // If not found, create a new inventory record for the destination
      const newInventory = new mongoose.model('Inventory')({
        name: inventoryItem.name,
        barcode: inventoryItem.barcode,
        quantity: quantity,
        location: toLocationId,
        price: inventoryItem.price
      });
      await newInventory.save();
    }

    // Create a transfer order
    const transferOrder = new Order({
      user: userId,
      customerName: 'Inventory Transfer',
      items: [{ inventoryItem: inventoryItem._id, quantity: quantity }],
      totalPrice: 0,
      invoiceNumber: generateInvoiceNumber(),
      orderType: 'transfer'
    });

    await transferOrder.save();
    res.status(201).json(transferOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// api to get details of order
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// api to return orders as pages
router.get('/orders', async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize) || 10; // Number of items per page, default is 10
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    const orders = await Order.find()
                              .skip((page - 1) * pageSize) // Skip the previous pages' items
                              .limit(pageSize); // Limit the number of items

    const totalOrders = await Order.countDocuments(); // Total number of orders
    const totalPages = Math.ceil(totalOrders / pageSize); // Total number of pages

    res.json({
      orders,
      page,
      pageSize,
      totalPages,
      totalOrders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/reports/inventory', async (req, res) => {
  try {
    const inventoryReport = await Inventory.aggregate([
      {
        $group: {
          _id: "$location", // Group by location
          totalItems: { $sum: 1 }, // Count items per location
          totalQuantity: { $sum: "$quantity" } // Sum quantities per location
        }
      },
      {
        $lookup: {
          from: 'locations',
          localField: '_id',
          foreignField: '_id',
          as: 'locationDetails'
        }
      }
    ]);

    res.json(inventoryReport);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/user-history/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query; // Default values for pagination
    const userId = req.params.userId;

    // Validate the userId, if needed
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    const history = await History.find({ userId: userId })
      .sort({ date: -1 }) // Sort by date in descending order
      .skip((page - 1) * limit) // Skip the previous pages
      .limit(limit) // Limit the number of results
      .exec();

    const total = await History.countDocuments({ userId: userId });

    res.json({
      history,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});





module.exports = router;