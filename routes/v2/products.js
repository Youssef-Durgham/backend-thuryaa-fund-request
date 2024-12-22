// routes/products.js
const express = require('express');
const Product = require('../../model/v2/Product');
const logActivity = require('../../utils/activityLogger');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const jwt = require('jsonwebtoken');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);


const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate('roles');

      if (admin.type === 'System') {
        // System user has all permissions
        req.adminId = decoded.id;
        return next();
      }

      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id;
      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};


// إنشاء منتج جديد
router.post('/products', checkPermission('Create_Product'), async (req, res) => {
  try {
    const { name, sku, description, categoryId, subcategoryId, price, cost, stock, unit, reorderLevel, supplierId, currency, imageUrl } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const newProduct = new Product({
      name,
      sku,
      description,
      category: categoryId,
      subcategory: subcategoryId,
      price,
      cost,
      stock,
      unit,
      reorderLevel,
      supplier: supplierId,
      currency,
      imageUrl,
      entity: entityId
    });

    await newProduct.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Product',
      performedBy: req.adminId,
      targetItem: newProduct._id,
      itemType: 'Product',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Product created successfully', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// تحديث كمية منتج
router.put('/products/:id/stock', checkPermission('Update_Product_Stock'), async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity, action } = req.body; // action يمكن أن تكون 'increase' أو 'decrease'
      const entityId = req.entity._id; // Extract entity ID from request
  
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      if (action === 'increase') {
        product.stock += quantity;
      } else if (action === 'decrease') {
        if (product.stock < quantity) {
          return res.status(400).json({ message: 'Insufficient stock to decrease' });
        }
        product.stock -= quantity;
      } else {
        return res.status(400).json({ message: 'Invalid action. Use "increase" or "decrease"' });
      }
  
      await product.save();
  
      // تسجيل النشاط
      await logActivity({
        action: `${action}_stock_product`,
        performedBy: req.adminId,
        targetItem: product._id,
        itemType: 'Product',
        userType: 'Admin',
        description: `Stock ${action} by ${quantity}`,
        entity: entityId
      });
  
      res.status(200).json({ message: 'Product stock updated successfully', product });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // الحصول على جميع المنتجات مع تفاصيل الفئة والفئة الفرعية والمورد
router.get('/products', checkPermission('View_Products'), async (req, res) => {
    try {
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const products = await Product.find({ entity: entityId }) // Filter by entity
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('supplier', 'name phone');
  
      res.status(200).json(products);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });  

  // حذف منتج (تغيير الحالة إلى غير نشط)
router.delete('/products/:id', checkPermission('Delete_Product'), async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
  
      product.isActive = false;
      await product.save();
  
      // تسجيل النشاط
      await logActivity({
        action: 'Delete_Product',
        performedBy: req.adminId,
        targetItem: product._id,
        itemType: 'Product',
        userType: 'Admin',
        entity: entityId
      });
  
      res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // البحث عن منتجات بناءً على الفئة أو الفئة الفرعية أو المورد
router.get('/products/search', checkPermission('Search_Products'), async (req, res) => {
    try {
      const { categoryId, subcategoryId, supplierId, name } = req.query;
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const filter = { isActive: true, entity: entityId }; // Filter by isActive and entity
  
      if (categoryId) filter.category = categoryId;
      if (subcategoryId) filter.subcategory = subcategoryId;
      if (supplierId) filter.supplier = supplierId;
      if (name) filter.name = { $regex: name, $options: 'i' }; // Partial and case-insensitive search
  
      const products = await Product.find(filter)
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('supplier', 'name phone');
  
      res.status(200).json(products);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

module.exports = router;
