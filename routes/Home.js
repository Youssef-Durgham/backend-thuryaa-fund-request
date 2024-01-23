const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { body, validationResult } = require('express-validator');
const Location = require('../model/Location.js');
const Inventory = require("../model/Inventory.js");
const Order = require("../model/Order.js");

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
    const newItem = new Inventory(req.body);
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update Inventory Item
router.put('/inventory-edit/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete Inventory Item
router.delete('/inventory-delete/:id', async (req, res) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
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
    if (user.role !== 'admin') {
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
      invoiceNumber
    });

    await newOrder.save();
    res.status(201).json(newOrder);
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





module.exports = router;