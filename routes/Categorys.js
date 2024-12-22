const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');
const Item = require('../model/Item');
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



// Create Category Endpoint
router.post('/create-category', checkPermission('Category'), async (req, res) => {
  const { name, imageUrl } = req.body;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const newCategory = new Category({ name, imageUrl, entity: entityId }); // Include entity
    await newCategory.save();
    
    const activityLog = new ActivityLog({
      action: `add_category_${name}`,
      performedBy: req.adminId,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId // Log entity
    });
    await activityLog.save();
    res.status(201).json({ message: 'Category created successfully', category: newCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Subcategory Endpoint
router.post('/create-subcategory', checkPermission('Category'), async (req, res) => {
  const { name, categoryId, imageUrl } = req.body;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const category = await Category.findOne({ _id: categoryId, entity: entityId }); // Ensure category belongs to entity
    if (!category) {
      return res.status(404).json({ message: 'Category not found or does not belong to this entity' });
    }

    const newSubcategory = new Subcategory({ name, category: categoryId, imageUrl, entity: entityId }); // Include entity
    await newSubcategory.save();
    
    const activityLog = new ActivityLog({
      action: `add_subcategory_${name}`,
      performedBy: req.adminId,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId // Log entity
    });
    await activityLog.save();
    res.status(201).json({ message: 'Subcategory created successfully', subcategory: newSubcategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Retrieve Categories with Subcategories Endpoint
router.get('/categories-with-subcategories', checkPermission('Category'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract entity ID

    const categories = await Category.aggregate([
      { $match: { entity: entityId } }, // Filter by entity
      {
        $lookup: {
          from: 'subcategories', 
          localField: '_id', 
          foreignField: 'category', 
          as: 'subcategories'
        }
      }
    ]);

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Retrieve Categories
router.get('/categories', async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract entity ID

    const categories = await Category.find({ entity: entityId }); // Filter by entity
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Retrieve SubCategories
router.get('/subcategories', async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract entity ID

    const subcategories = await Subcategory.find({ entity: entityId }) // Filter by entity
      .populate('category', 'name imageUrl');

    res.status(200).json(subcategories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Edit category
router.put('/edit-category/:id', checkPermission('Edit_Category'), async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl } = req.body;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const updatedCategory = await Category.findOneAndUpdate(
      { _id: id, entity: entityId }, // Ensure category belongs to entity
      { name, imageUrl },
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found or does not belong to this entity' });
    }

    const activityLog = new ActivityLog({
      action: `edit_category_${name}`,
      performedBy: req.adminId,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId // Log entity
    });
    await activityLog.save();
    res.status(200).json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Edit SubCategory
router.put('/edit-subcategory/:id', checkPermission('Edit_SubCategory'), async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl } = req.body;

  try {
    const entityId = req.entity._id; // Extract entity ID

    const updatedSubcategory = await Subcategory.findOneAndUpdate(
      { _id: id, entity: entityId }, // Ensure subcategory belongs to entity
      { name, imageUrl },
      { new: true, runValidators: true }
    );
    
    if (!updatedSubcategory) {
      return res.status(404).json({ message: 'Subcategory not found or does not belong to this entity' });
    }

    const activityLog = new ActivityLog({
      action: `edit_subcategory_${name}`,
      performedBy: req.adminId,
      userType: 'System',
      itemType: 'Admin-Activitys',
      entity: entityId // Log entity
    });
    await activityLog.save();
    res.status(200).json({ message: 'Subcategory updated successfully', subcategory: updatedSubcategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subcategories and items for a given category for mobile app
router.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const entityId = req.entity._id; // Extract entity ID

    const subcategories = await Subcategory.find({ category: categoryId, entity: entityId }); // Filter by category and entity

    const data = await Promise.all(subcategories.map(async (subcategory) => {
      const items = await Item.find({
        subcategory: subcategory._id,
        $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] }
      })
      .sort({ 'inventory.dateAdded': -1 })
      .limit(20)
      .select('_id name productId mainImageUrl images price totalQuantity reservedQuantity');

      if (items.length > 0) {
        return {
          subcategoryId: subcategory._id,
          subcategoryName: subcategory.name,
          subcategoryImageUrl: subcategory.imageUrl,
          items
        };
      }
    }));

    res.status(200).json(data.filter(Boolean)); // Filter out empty results
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Get items for a given subcategory with pagination for mobile app
router.get('/subcategory/:subcategoryId/items', async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const totalItems = await Item.countDocuments({
      subcategory: subcategoryId,
      $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] }
    });

    const items = await Item.find({
      subcategory: subcategoryId,
      $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] }
    })
    .sort({ 'inventory.dateAdded': -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('_id name productId mainImageUrl images price totalQuantity reservedQuantity');

    res.status(200).json({
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalItems / limit),
      items
    });
  } catch (error) {
    res.status(500).send('Server error');
  }
});


  module.exports = router;