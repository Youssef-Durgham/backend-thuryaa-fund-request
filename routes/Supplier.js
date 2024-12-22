const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Item = require('../model/Item');
const Supplier = require('../model/Supplier');
const checkEntityAccess = require('../utils/entityAccess');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);

const checkPermission = (permission) => {
  return async (req, res, next) => {
    console.log(req.headers.authorization, "by func");
    try {
      const token = req.headers.authorization.split(' ')[1];
      console.log(token);

      const decoded = jwt.verify(token, 'your_jwt_secret');
      console.log(decoded);

      // Find the admin user
      const admin = await Admin.findById(decoded.id).populate('roles');

      if (!admin) {
        return res.status(401).json({ message: 'Unauthorized: User not found' });
      }

      // If the user is a System user, bypass permission checks
      if (admin.type === 'System') {
        console.log('System user detected. Bypassing permission checks.');
        req.adminId = decoded.id; // Store the admin ID in the request object
        return next();
      }

      // Check permissions in directly assigned roles
      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      console.log(permission, token, decoded, admin, hasPermission);

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
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




// Create Supplier Endpoint
router.post('/create-supplier', checkPermission('Create_supplier'), async (req, res) => {
  const { name, phone, location, note } = req.body;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const newSupplier = new Supplier({
      name,
      phone,
      location,
      note,
      entity: entityId // Include entity
    });

    await newSupplier.save();

    const activityLog = new ActivityLog({
      action: 'Add_supplier',
      performedBy: req.adminId,
      targetItem: newSupplier._id.toString(),
      userType: 'Admin',
      itemType: 'items',
      entity: entityId, // Log entity
      timestamp: new Date()
    });

    await activityLog.save();

    res.status(200).json({ message: 'Supplier created successfully', supplier: newSupplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search Supplier by Name or Phone Number Endpoint
router.get('/search-supplier', checkPermission('Search_supplier'), async (req, res) => {
  const { query, page = 1, pageSize = 10 } = req.query;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const searchCriteria = {
      entity: entityId, // Filter by entity
      $or: [
        { name: new RegExp(query, 'i') },
        { phone: new RegExp(query, 'i') }
      ]
    };

    const totalSuppliers = await Supplier.countDocuments(searchCriteria);
    const suppliers = await Supplier.find(searchCriteria)
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize));

    const totalPages = Math.ceil(totalSuppliers / pageSize);

    res.status(200).json({ suppliers, totalPages, currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
  
// Get Suppliers Based on Item Quantities Endpoint
router.get('/suppliers-by-quantity', checkPermission('View_suppliers_by_quantity'), async (req, res) => {
  const { page = 1, pageSize = 10 } = req.query;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const totalSupplierCount = await Supplier.countDocuments({ entity: entityId }); // Count only suppliers for the entity
    const totalPages = Math.ceil(totalSupplierCount / pageSize);

    const suppliersWithQuantity = await Supplier.aggregate([
      {
        $match: { entity: entityId } // Match suppliers for the entity
      },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: 'supplier',
          as: 'items'
        }
      },
      {
        $addFields: {
          totalQuantity: { $sum: '$items.inventory.quantity' }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $skip: (page - 1) * pageSize
      },
      {
        $limit: parseInt(pageSize)
      }
    ]);

    res.status(200).json({ suppliers: suppliersWithQuantity, totalPages, currentPage: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
  
  
  

  module.exports = router;