const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Item = require('../model/Item');
const Trash = require('../model/Trash');
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



// Get all items in the trash with populated fields
router.get('/trash', checkPermission('Show_Trash'), async (req, res) => {
    try {
      const trashItems = await Trash.find()
        .populate({
          path: 'item',
          select: '-inventory', // Exclude the inventory field
          populate: [
            { path: 'category', select: 'name' },
            { path: 'subcategory', select: 'name' },
            { path: 'supplier' }
          ]
        });
  
      res.status(200).json(trashItems);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });

// Transfer specified quantity from trash to item and update storage
router.post('/trash/transfer', checkPermission('Transfer_Trash'), async (req, res) => {
    try {
      const { trashId, storageId, adminId, quantity } = req.body;
  
      if (!trashId || !storageId || !adminId || !quantity) {
        return res.status(400).json({ message: 'Trash ID, Storage ID, Admin ID, and Quantity are required' });
      }
  
      const trashItem = await Trash.findById(trashId).populate('item');
      const storage = await Storage.findById(storageId);
  
      if (!trashItem) {
        return res.status(404).json({ message: 'Trash item not found' });
      }
  
      if (!storage) {
        return res.status(404).json({ message: 'Storage not found' });
      }
  
      const item = await Item.findById(trashItem.item._id);
  
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }
  
      const transferQuantity = Number(quantity);
  
      if (isNaN(transferQuantity) || transferQuantity <= 0) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
  
      if (trashItem.quantity < transferQuantity) {
        return res.status(400).json({ message: 'Not enough quantity in trash' });
      }
  
      // Update the total quantity of the item
      item.totalQuantity = Number(item.totalQuantity) + transferQuantity;
  
      // Update the storage quantity
      const storageIndex = item.storageQuantities.findIndex(sq => sq.storage.equals(storageId));
      if (storageIndex >= 0) {
        item.storageQuantities[storageIndex].quantity = Number(item.storageQuantities[storageIndex].quantity) + transferQuantity;
      } else {
        item.storageQuantities.push({ storage: storageId, quantity: transferQuantity });
      }
  
      // Save the updated item
      await item.save();
  
      // Update the quantity in trash or remove the trash item if all quantity is transferred
      if (trashItem.quantity === transferQuantity) {
        await Trash.findByIdAndDelete(trashId);
      } else {
        trashItem.quantity -= transferQuantity;
        await trashItem.save();
      }
  
      // Log the activity
      const activityLog = new ActivityLog({
        action: 'transfer_quantity_Trash',
        performedBy: adminId,
        targetItem: item._id.toString(),
        userType: 'Admin',
        timestamp: new Date()
      });
      await activityLog.save();
  
      res.status(200).json({ message: 'Quantity transferred successfully', item });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });


  module.exports = router;