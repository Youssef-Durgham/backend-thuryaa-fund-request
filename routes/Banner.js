const express = require('express');
const Banner = require('../model/Banner');
const router = express.Router();
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const { Role } = require('../model/Role');

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

// Create a new banner
router.post('/banners', checkPermission('Add_Banner'), async (req, res) => {
  try {
    const { title, imageUrl, items, isPackage, type } = req.body;
    const banner = new Banner({ title, imageUrl, items, isPackage, type });
    await banner.save();
    res.status(201).json(banner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all banners
router.get('/banners', async (req, res) => {
  try {
    const banners = await Banner.find().populate('items', 'name productId price images mainImageUrl');
    res.status(200).json(banners);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get a single banner
router.get('/banners/:id', async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).populate('items', 'name productId price images mainImageUrl');
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }
    res.status(200).json(banner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a banner
router.put('/banners/:id', checkPermission('Edit_Banner'), async (req, res) => {
  try {
    const { title, imageUrl, items, isPackage, type } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { title, imageUrl, items, isPackage, type },
      { new: true, runValidators: true }
    ).populate('items', 'name productId price');
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }
    res.status(200).json(banner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a banner
router.delete('/banners/:id', checkPermission('Delete_Banner'), async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }
    res.status(200).json({ message: 'Banner deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add items to a banner
router.post('/banners/:id/items', checkPermission('Edit_Banner'), async (req, res) => {
  try {
    const { items } = req.body;
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }
    banner.items.push(...items);
    await banner.save();
    res.status(200).json(banner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove items from a banner
router.delete('/banners/:id/items', checkPermission('Edit_Banner'), async (req, res) => {
  try {
    const { items } = req.body;
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }
    banner.items = banner.items.filter(item => !items.includes(item.toString()));
    await banner.save();
    res.status(200).json(banner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
