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

router.post('/banners', checkPermission('Add_Banner'), async (req, res) => {
    try {
      const { imageUrl, itemId } = req.body;
      const banner = new Banner({ imageUrl, itemId });
      await banner.save();
      res.status(201).json(banner);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

router.delete('/banners/:id', checkPermission('Delete_Banner'), async (req, res) => {
    try {
      const { id } = req.params;
      const banner = await Banner.findByIdAndDelete(id);
      if (!banner) {
        return res.status(404).json({ error: 'Banner not found' });
      }
      res.status(200).json({ message: 'Banner deleted' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

router.get('/banners', async (req, res) => {
    try {
      const banners = await Banner.find().populate('itemId', 'name productId'); // Populate with item details
      res.status(200).json(banners);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

module.exports = router;
