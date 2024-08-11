const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');
const Item = require('../model/Item');

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

// Retrieve Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({});
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

// Get subcategories and items for a given category for mobile app
router.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Fetch all subcategories of the given category
    const subcategories = await Subcategory.find({ category: categoryId });

    // Prepare the response data
    const data = [];

    // Iterate over each subcategory
    for (const subcategory of subcategories) {
      // Fetch the newest 20 items for the subcategory
      const items = await Item.find({
        subcategory: subcategory._id,
        $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] } // Ensure items have available quantity
      })
      .sort({ 'inventory.dateAdded': -1 }) // Sort by newest items
      .limit(20)
      .select('_id name productId mainImageUrl images price totalQuantity reservedQuantity') // Return only necessary fields
      .lean();

      // Only add the subcategory if there are items available
      if (items.length > 0) {
        data.push({
          subcategoryId: subcategory._id,
          subcategoryName: subcategory.name,
          subcategoryImageUrl: subcategory.imageUrl, // Include the imageUrl for the subcategory
          items
        });
      }
    }

    return res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Get items for a given subcategory with pagination for mobile app
router.get('/subcategory/:subcategoryId/items', async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 50 } = req.query; // Default to page 1 and limit 50

    // Convert page and limit to numbers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    // Get the total count of items in the subcategory
    const totalItems = await Item.countDocuments({
      subcategory: subcategoryId,
      $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] } // Ensure items have available quantity
    });

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalItems / limitNumber);

    // Fetch items for the subcategory with pagination
    const items = await Item.find({
      subcategory: subcategoryId,
      $expr: { $gt: ["$totalQuantity", "$reservedQuantity"] } // Ensure items have available quantity
    })
    .sort({ 'inventory.dateAdded': -1 }) // Sort by newest items
    .skip((pageNumber - 1) * limitNumber) // Skip the previous pages
    .limit(limitNumber) // Limit the number of items returned
    .select('_id name productId mainImageUrl images price totalQuantity reservedQuantity') // Return only necessary fields
    .lean();

    // Prepare the response
    const response = {
      currentPage: pageNumber,
      totalPages,
      items
    };

    return res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


  module.exports = router;