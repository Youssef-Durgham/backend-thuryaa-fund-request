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
const Type = require("../model/Type.js");
const Group = require("../model/Group.js");
const bcrypt = require('bcryptjs');

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
  body('location').not().isEmpty().withMessage('Location is required'),
  // Add more validators as needed
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password, role, name, location } = req.body;

  try {
    // Check if location exists
    const locationExists = await Location.findById(location);
    if (!locationExists) {
      return res.status(404).json({ message: "Location not found" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists with given username or email' });
    }

    // Create new user
    const newUser = new User({ username, password, role, name, location });
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
    // Find the user that needs to be updated
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update the user fields from the request body
    for (let key in req.body) {
      if (req.body.hasOwnProperty(key)) {
        // If the password is being updated, hash it before saving
        if (key === 'password' && req.body[key]) {
          req.body[key] = await bcrypt.hash(req.body[key], 12);
        }
        user[key] = req.body[key];
      }
    }

    // Save the updated user
    const updatedUser = await user.save();

    // Exclude sensitive information like password from the response
    updatedUser.password = undefined;

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
    const { items, opNumber, userId } = req.body;
    let { transactionType } = req.body;

    transactionType = transactionType || 'add';

    const user = await User.findById(userId);
if (!user) {
  return res.status(404).json({ message: 'User not found' });
}

const userRole = user.role; // Retrieve the role of the user

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid input: Expected an array of items." });
    }

    const transactionItems = [];
    for (const item of items) {
      const existingItem = await Inventory.findOne({ barcode: item.barcode });
      let inventoryItem;
      const fromLocationId = (userRole === 'admin' || userRole === 'manager') ? item.location : user.location;

      if (existingItem) {
        if (transactionType === 'add') {
          existingItem.quantity += item.quantity;
        }
        // Optional: Update group and type if provided
        if (item.group) existingItem.group = item.group;
        if (item.type) existingItem.type = item.type;

        if (item.dateAdded) {
          existingItem.dateAdded = new Date(item.dateAdded);
        }
        await existingItem.save();
        inventoryItem = existingItem;
      } else {
        // Set dateAdded and create new item
        item.dateAdded = item.dateAdded ? new Date(item.dateAdded) : new Date();
        item.location = fromLocationId;
        const newItem = new Inventory(item);
        await newItem.save();
        inventoryItem = newItem;
      }

      transactionItems.push({ itemId: inventoryItem._id, quantity: item.quantity });
    }

    const transaction = new Transaction({
      opNumber,
      items: transactionItems,
      transactionType,
      userId // Save the userId here
    });
    await transaction.save();

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.post('/transfer-inventory/bulk', async (req, res) => {
  try {
    const { transfers, opNumber, opNumber2, userId } = req.body;

    if (!Array.isArray(transfers)) {
        return res.status(400).json({ message: "Invalid input: Expected an array of transfers." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transactionItems = [];
    for (const transfer of transfers) {
        const { userId, itemId, quantity: quantityString, toLocationId } = transfer;

        const fromLocationId = (user.role === 'admin' || user.role === 'manager') ? 
                                transfer.fromLocationId : user.location;


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

      // Check if there's enough quantity
      if (!inventoryItem || quantity > inventoryItem.quantity) {
          return res.status(400).json({ message: `Insufficient quantity for item ID ${itemId}` });
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
                price: inventoryItem.price,
                group: inventoryItem.group, // Copy group from source item
                type: inventoryItem.type, // Copy type from source item
            });
            await newInventory.save();
        }


        await inventoryItem.save();

        // Prepare transaction item
        transactionItems.push({
            itemId: inventoryItem._id, // or destinationInventory._id if you want to reference the new item
            quantity
        });

        // Optional: Create a transfer order for each item
        const transferOrder = new Order({
            user: userId,
            customerName: 'Inventory Transfer',
            items: [{ inventoryItem: inventoryItem._id, quantity: quantity }],
            totalPrice: 0,
            invoiceNumber: generateInvoiceNumber(), // Ensure you have a function to generate this
            orderType: 'transfer'
        });
        await transferOrder.save();
    }

    // Create a bulk transaction
    const bulkTransaction = new Transaction({
      opNumber: opNumber,
      items: transactionItems,
      transactionType: 'transfer',
      userId
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

    // Fetch all items that match the query without pagination
    const items = await Inventory.find(query)
      .populate('group', 'name') // Populating 'group' field with its 'name'
      .populate('type', 'name'); // Populating 'type' field with its 'name'

    // Transform items to replace group and type ObjectId with their names
    const transformedItems = items.map(item => {
      const itemObject = item.toObject();
      return {
        ...itemObject,
        group: item.group ? item.group.name : null, // Check if group exists
        type: item.type ? item.type.name : null     // Check if type exists
      };
    });

    res.json({ items: transformedItems });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/api/inventory/:barcode', async (req, res) => {
  try {
    const { userId, location: locationParam } = req.query; // Assuming you are passing them as query parameters
    const barcode = req.params.barcode;

    // Find user based on userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Determine the location based on the user's role
    let location = user.role === 'admin' || user.role === 'manager' ? locationParam : user.location;

    // Find the item in the inventory
    const item = await Inventory.findOne({ barcode: barcode, location: location });

    if (!item) {
      return res.status(404).send('Item not found');
    }

    // Check if item quantity is zero
    if (item.quantity === 0) {
      return res.status(400).send('This item does not have quantity');
    }

    res.send(item);
  } catch (error) {
    console.log(error)
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
    const inventoryId = req.query.inventoryId; // Optional Inventory ID
    const groupFilter = req.query.group;
    const typeFilter = req.query.type;
    const minQuantity = req.query.minQuantity;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let searchCriteria = {};
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: "i" } },
        { barcode: { $regex: query, $options: "i" } }
      ];
    }

    if (req.query.location && req.query.location !== 'All') {
      searchCriteria.location = req.query.location;
    } else if (user.role !== 'admin') {
      searchCriteria.location = user.location;
    }

    if (inventoryId) {
      searchCriteria._id = inventoryId;
    }

    if (groupFilter) {
      searchCriteria.group = groupFilter;
    }

    if (typeFilter) {
      searchCriteria.type = typeFilter;
    }

    if (minQuantity) {
      searchCriteria.quantity = { $gte: Number(minQuantity) };
    }

    // Default sort criteria: sort by quantity in descending order
    let sortCriteria = { quantity: -1 };

    // Allow overriding sort criteria if provided in query
    if (req.query.sortBy) {
      const sortFields = req.query.sortBy.split(',');
      sortFields.forEach(field => {
        let [key, order] = field.split(':');
        sortCriteria[key] = order === 'desc' ? -1 : 1;
      });
    }

    const searchItems = await Inventory.find(searchCriteria)
    .populate('group', 'name')
    .populate('type', 'name')
    .populate('location', 'name') // Populate location name
    .sort(sortCriteria);

const transformedItems = searchItems.map(item => {
return {
...item.toObject(),
group: item.group ? item.group.name : null,
type: item.type ? item.type.name : null,
location: item.location ? item.location.name : null // Add location name
};
});

res.json({ items: transformedItems });
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

    // Modify this section to include managers along with admins
    if (user.role !== 'admin' && user.role !== 'manager') {
      // For non-admin and non-manager users, restrict search to the user's location
      searchCriteria.location = user.location;
    } else if (locationQuery && locationQuery !== 'All') {
      // For admin and manager users, apply location filter if provided
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
    const { userId, customerName, items, totalPrice, invoiceNumber, opNumber } = req.body; // Include userId in the request

    // Find the user by userId
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create the new order
    const newOrder = new Order({
      user: userId, // Associate the user with the order
      customerName,
      items,
      totalPrice: totalPrice,
      invoiceNumber,
      orderType: 'sell'
    });

    await newOrder.save();

    // Prepare transaction items
    const transactionItems = items.map(item => ({
      itemId: item.inventoryItem, // Assuming inventoryItem is the ID of the item
      quantity: item.quantity
    }));

    // Create a transaction
    const transaction = new Transaction({
      opNumber: opNumber, // You can use the invoice number as operation number
      items: transactionItems,
      transactionType: 'sale',
      userId
    });

    await transaction.save();

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

router.post('/api/groups', async (req, res) => {
  try {
    const group = new Group({
      name: req.body.name,
      // ... other fields ...
    });
    await group.save();
    res.status(201).send(group);
  } catch (error) {
    res.status(400).send(error);
  }
});

router.post('/api/types', async (req, res) => {
  try {
    const type = new Type({
      name: req.body.name,
      group: req.body.groupId,
      // ... other fields ...
    });

    const savedType = await type.save();

    const group = await Group.findById(req.body.groupId);
    if (!group) {
      return res.status(404).send('Group not found');
    }

    group.types.push(savedType._id);
    await group.save();

    res.status(201).send(savedType);
  } catch (error) {
    res.status(400).send(error);
  }
});


router.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find().populate('types');
    res.status(200).send(groups);
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/users/all', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/transactions/all/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Fetch the user's name
    const user = await User.findById(userId).select('name');
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const transactions = await Transaction.find({ userId: userId })
      .populate({
        path: 'items.itemId',
        populate: { path: 'group type location' }
      })
      .sort({ date: -1 }) // Sort by date in descending order
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ userId: userId });
    const pages = Math.ceil(total / limit);

    res.json({
      transactions,
      total,
      pages,
      currentPage: page,
      userName: user.name // Include the user's name in the response
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/sales-summary', async (req, res) => {
  try {
      const { fromDate, toDate, locationId } = req.query;

      let matchQuery = {
          transactionType: { $in: ['sale', 'direct sale'] },
          date: { $gte: new Date(fromDate), $lte: new Date(toDate) }
      };

      let aggregateQuery = [
          { $match: matchQuery },
          { $unwind: "$items" },
          {
              $lookup: {
                  from: "inventories",
                  localField: "items.itemId",
                  foreignField: "_id",
                  as: "itemDetails"
              }
          },
          { $unwind: "$itemDetails" }
      ];

      if (locationId) {
        aggregateQuery.push({ $match: { "itemDetails.location": new mongoose.Types.ObjectId(locationId) } });
      }

      // Group by item name and sum the quantities
      aggregateQuery.push(
          {
              $group: {
                  _id: "$itemDetails.name",
                  totalQuantity: { $sum: "$items.quantity" }
              }
          },
          {
              $project: {
                  _id: 0,
                  itemName: "$_id",
                  totalQuantity: 1
              }
          }
      );

      const summary = await Transaction.aggregate(aggregateQuery);
      res.json(summary);
  } catch (error) {
    console.log(error)
      res.status(500).send(error.message);
  }
});


router.get('/inventory-summary', async (req, res) => {
  try {
    const { fromDate, toDate, locationId } = req.query;
    const locationObjectId = new mongoose.Types.ObjectId(locationId);

    // Aggregate inventory quantities
    const inventoryItems = await Inventory.aggregate([
      { $match: { location: locationObjectId } },
      { $group: { _id: "$name", quantityNow: { $sum: "$quantity" } } }
    ]);

    // Filter out items with zero quantity
    const filteredInventoryItems = inventoryItems.filter(item => item.quantityNow > 0);

    // Create a map for easy access to inventory quantities
    const inventoryMap = {};
    filteredInventoryItems.forEach(item => {
      inventoryMap[item._id] = item.quantityNow;
    });

    // Aggregate transaction quantities
    const transactionItems = await Transaction.aggregate([
      { $match: { date: { $gte: new Date(fromDate), $lte: new Date(toDate) } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "inventories",
          localField: "items.itemId",
          foreignField: "_id",
          as: "itemDetails"
        }
      },
      { $unwind: "$itemDetails" },
      { $match: { "itemDetails.location": locationObjectId } },
      {
        $group: {
          _id: { name: "$itemDetails.name", type: "$transactionType" },
          quantity: { $sum: "$items.quantity" }
        }
      }
    ]);

    // Initialize summary map for item details
    let summaryMap = {};
    filteredInventoryItems.forEach(item => {
      summaryMap[item._id] = {
        itemName: item._id,
        quantityNow: item.quantityNow,
        quantitySoldInRange: 0,
        transferQuantity: 0
      };
    });

    // Process the transaction aggregation results
    transactionItems.forEach(item => {
      const itemName = item._id.name;
      const itemType = item._id.type;

      if (!summaryMap[itemName]) {
        summaryMap[itemName] = {
          itemName: itemName,
          quantityNow: 0,
          quantitySoldInRange: 0,
          transferQuantity: 0
        };
      }

      if (itemType === 'sale' || itemType === 'direct sale') {
        summaryMap[itemName].quantitySoldInRange += item.quantity;
      } else if (itemType === 'transfer') {
        summaryMap[itemName].transferQuantity += item.quantity;
      }
    });

    // Calculate the final summary for each item
    Object.keys(summaryMap).forEach(key => {
      summaryMap[key].totalQuantity = summaryMap[key].quantityNow - summaryMap[key].quantitySoldInRange + summaryMap[key].transferQuantity;
    });

    res.json({
      items: Object.values(summaryMap).filter(item => item.totalQuantity > 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

router.get('/api/transaction2/:opNumber', async (req, res) => {
  try {
      const opNumber = req.params.opNumber;
      const regexPattern = new RegExp('.*' + opNumber + '$');

      // Find the transaction and populate the user and items
      const transaction = await Transaction.findOne({ opNumber: { $regex: regexPattern } })
        .populate({
          path: 'userId',
          select: 'username name role location email phone department hireDate -_id' // select fields you need, exclude sensitive data
        })
        .populate({
          path: 'items.itemId',
          select: 'name barcode quantity location price dateAdded group type -_id',
          populate: { path: 'location', select: 'name address -_id' } // nested populate for location in inventory
        }).exec();

      if (!transaction) {
          return res.status(404).send('Transaction not found');
      }

      res.json(transaction);
  } catch (error) {
      res.status(500).send('Server error');
  }
});





module.exports = router;