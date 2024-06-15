const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');

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


// Create Category Endpoint
router.post('/create-category', checkPermission('Category'), async (req, res) => {
  const { name, imageUrl } = req.body;

  try {
    const newCategory = new Category({ name, imageUrl });
    await newCategory.save();
    
    const activityLog = new ActivityLog({
      action: `add_category_${name}`,
      performedBy: req.adminId,
      userType: 'Admin'
    });
    await activityLog.save();
    res.status(201).json({ message: 'Category created successfully', category: newCategory });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
  }
});

// Create Subcategory Endpoint
router.post('/create-subcategory', checkPermission('Category'), async (req, res) => {
  const { name, categoryId, imageUrl } = req.body;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const newSubcategory = new Subcategory({ name, category: categoryId, imageUrl });
    await newSubcategory.save();
    
    const activityLog = new ActivityLog({
      action: `add_subcategory_${name}`,
      performedBy: req.adminId,
      userType: 'Admin'
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
      const categories = await Category.aggregate([
        {
          $lookup: {
            from: 'subcategories', // The name of the subcategory collection
            localField: '_id', // Field from the Category schema
            foreignField: 'category', // Field from the Subcategory schema
            as: 'subcategories' // The name of the array to store the joined data
          }
        }
      ]);
      
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
});

// Edit category
router.put('/edit-category/:id', checkPermission('Edit_Category'), async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl } = req.body;

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name, imageUrl },
      { new: true, runValidators: true }
    );
    
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const activityLog = new ActivityLog({
      action: `edit_category_${name}`,
      performedBy: req.adminId,
      userType: 'Admin'
    });
    await activityLog.save();
    res.status(200).json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
  }
});

// Edit SubCategory
router.put('/edit-subcategory/:id', checkPermission('Edit_SubCategory'), async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl } = req.body;

  try {
    const updatedSubcategory = await Subcategory.findByIdAndUpdate(
      id,
      { name, imageUrl },
      { new: true, runValidators: true }
    );
    
    if (!updatedSubcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    const activityLog = new ActivityLog({
      action: `edit_subcategory_${name}`,
      performedBy: req.adminId,
      userType: 'Admin'
    });
    await activityLog.save();
    res.status(200).json({ message: 'Subcategory updated successfully', subcategory: updatedSubcategory });
  } catch (error) {
      console.log(error);
      res.status(500).json({ message: error.message });
  }
});


  module.exports = router;