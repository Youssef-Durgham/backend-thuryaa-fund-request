const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const Item = require('../model/Item');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');
const Supplier = require('../model/Supplier');
const Storage = require('../model/Storage'); // Make sure to import the Storage model
const AWS = require('aws-sdk');

const router = express.Router();

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


AWS.config.update({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION,
});

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET_NAME;

// Route for generating presigned URL
router.post('/generate-presigned-url', checkPermission('Upload_Opening_Balance'), async (req, res) => {
  const { fileName, contentType } = req.body;

  const params = {
    Bucket: BUCKET,
    Key: `uploads/${Date.now()}-${fileName}`,
    ContentType: contentType,
    Expires: 900,
  };

  try {
    const signedUrl = await s3.getSignedUrlPromise('putObject', params);
    res.json({ signedUrl, fileKey: params.Key });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

// Route for processing data chunk


router.post('/process-chunk', checkPermission('Upload_Opening_Balance'), async (req, res) => {
    const chunk = req.body;
    const errors = [];
  
    try {
      // Create or find a fake storage
      let fakeStorage = await Storage.findOne({ name: 'Fake Storage' });
      if (!fakeStorage) {
        fakeStorage = new Storage({
          name: 'Fake Storage',
          location: 'Virtual Location',
          partitions: [{ name: 'Default Partition', location: 'Virtual Location' }]
        });
        await fakeStorage.save();
      }
  
      const defaultPartition = fakeStorage.partitions[0]._id;
  
      for (const item of chunk) {
        try {
          // Check for required fields
          if (!item.ItemCode || !item['Category 1'] || !item.ItemName || !item.Picture) {
            throw new Error(`Missing required fields for item ${item.ItemCode}`);
          }
  
          // Check and create category
          let category = await Category.findOne({ name: item['Category 1'] });
          if (!category) {
            category = new Category({ name: item['Category 1'], imageUrl: item.Picture });
            await category.save();
          }
  
          // Check and create subcategory
          let subcategory = await Subcategory.findOne({ name: item['Category 2'] || 'Default Subcategory', category: category._id });
          if (!subcategory) {
            subcategory = new Subcategory({ name: item['Category 2'] || 'Default Subcategory', category: category._id, imageUrl: item.Picture });
            await subcategory.save();
          }
  
          // Check and create supplier
          let supplier = await Supplier.findOne({ name: item['Supplier Name'] || 'Default Supplier' });
          if (!supplier) {
            supplier = new Supplier({ name: item['Supplier Name'] || 'Default Supplier' });
            await supplier.save();
          }
  
          // Generate a random quantity for this update
          const newQuantity = Math.floor(Math.random() * 100) + 1;
  
          // Find existing item
          let existingItem = await Item.findOne({ productId: item.ItemCode });
  
          if (existingItem) {
            // Update existing item
            const updateData = {
              $set: {
                name: item.ItemName,
                mainImageUrl: item.Picture,
                UOM: item.UOM || '',
                Specification: item.Specifictation || '',
                Brand: item.Brand || '',
                category: category._id,
                subcategory: subcategory._id,
                supplier: supplier._id,
              },
              $inc: {
                totalQuantity: newQuantity
              },
              $push: {
                images: item.Picture,
                inventory: {
                  buyInvoiceId: `FAKE_INVOICE_${Date.now()}`,
                  quantity: newQuantity,
                  originalPrice: parseFloat(item.SalePrice) || Math.random() * 100 + 1,
                  originalCost: parseFloat(item.Cost) || Math.random() * 50 + 1,
                  storage: fakeStorage._id,
                  partition: defaultPartition,
                  note: 'Added during bulk upload'
                }
              }
            };
  
            // Update price and cost only if new values are provided
            if (item.SalePrice) updateData.$set.price = parseFloat(item.SalePrice);
            if (item.Cost) updateData.$set.cost = parseFloat(item.Cost);
  
            // Update or add storage quantity
            const storageQuantityIndex = existingItem.storageQuantities.findIndex(
              sq => sq.storage && sq.storage.toString() === fakeStorage._id.toString() &&
                   sq.partition && sq.partition.toString() === defaultPartition.toString()
            );
  
            if (storageQuantityIndex > -1) {
              updateData.$inc[`storageQuantities.${storageQuantityIndex}.quantity`] = newQuantity;
            } else {
              updateData.$push.storageQuantities = {
                storage: fakeStorage._id,
                partition: defaultPartition,
                quantity: newQuantity
              };
            }
  
            await Item.updateOne({ _id: existingItem._id }, updateData);
          } else {
            // Create new item
            const newItem = new Item({
              name: item.ItemName,
              productId: item.ItemCode,
              mainImageUrl: item.Picture,
              images: [item.Picture],
              price: parseFloat(item.SalePrice) || Math.random() * 100 + 1,
              cost: parseFloat(item.Cost) || Math.random() * 50 + 1,
              totalQuantity: newQuantity,
              reservedQuantity: 0,
              profitPercentage: Math.random() * 20 + 5,
              category: category._id,
              subcategory: subcategory._id,
              supplier: supplier._id,
              UOM: item.UOM || '',
              Specification: item.Specifictation || '',
              Brand: item.Brand || '',
              inventory: [{
                buyInvoiceId: `FAKE_INVOICE_${Date.now()}`,
                quantity: newQuantity,
                originalPrice: parseFloat(item.SalePrice) || Math.random() * 100 + 1,
                originalCost: parseFloat(item.Cost) || Math.random() * 50 + 1,
                storage: fakeStorage._id,
                partition: defaultPartition,
                note: 'Added during initial upload'
              }],
              storageQuantities: [{
                storage: fakeStorage._id,
                partition: defaultPartition,
                quantity: newQuantity
              }]
            });
  
            await newItem.save();
          }
  
          console.log(`Successfully processed item: ${item.ItemCode}`);
        } catch (itemError) {
          console.error(`Error processing item ${item.ItemCode}:`, itemError);
          errors.push(`Error processing item ${item.ItemCode}: ${itemError.message}`);
        }
      }
  
      if (errors.length > 0) {
        console.error('Errors during chunk processing:', errors);
        res.status(207).json({ message: 'Chunk processed with some errors', errors });
      } else {
        res.json({ message: 'Chunk processed successfully' });
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      res.status(500).json({ error: 'Failed to process chunk', details: error.message });
    }
  });

router.delete('/delete-s3-image', checkPermission('Upload_Opening_Balance'), async (req, res) => {
    const { fileKey } = req.body;
  
    const params = {
      Bucket: BUCKET,
      Key: fileKey
    };
  
    try {
      await s3.deleteObject(params).promise();
      res.json({ message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error deleting image from S3:', error);
      res.status(500).json({ error: 'Failed to delete image from S3' });
    }
  });

// Get a presigned URL to view a private S3 file
router.get('/get-image-url', async (req, res) => {
    const { key } = req.query;
    const params = {
      Bucket: BUCKET,
      Key: key,
      Expires: 3600,
    };

    try {
      const url = await s3.getSignedUrlPromise('getObject', params);
      res.json({ url });
    } catch (error) {
      console.error('Error generating view URL:', error);
      res.status(500).json({ error: 'Failed to generate view URL' });
    }
});

module.exports = router;