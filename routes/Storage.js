const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
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





// Create Storage
router.post('/create-storage', checkPermission('Create_Storage'), async (req, res) => {
  const { name, location } = req.body;

  if (!name || !location) {
    return res.status(400).json({ message: 'Name and location are required' });
  }

  try {
    const newStorage = new Storage({ name, location });
    await newStorage.save();
    res.status(201).json({ message: 'Storage created successfully', storage: newStorage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List Storages
router.get('/list-storages', checkPermission('List_Storages'), async (req, res) => {
  try {
    const storages = await Storage.find().lean();

    const storageDetails = storages.map(storage => ({
      storageId: storage._id,
      storageName: storage.name,
      storageLocation: storage.location,
      partitions: (storage.partitions || []).map(partition => ({
        partitionId: partition._id,
        partitionName: partition.name,
        partitionLocation: partition.location
      }))
    }));

    res.status(200).json(storageDetails);
  } catch (error) {
    console.error('Error fetching storages:', error.message);
    res.status(500).json({ message: error.message });
  }
});

//add partition to storage
router.post('/add-partition', checkPermission('Add_Partition'), async (req, res) => {
  const { storageId, name, location, capacity } = req.body;

  if (!storageId || !name || !location) {
    return res.status(400).json({ message: 'Storage ID, name, and location are required' });
  }

  try {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      return res.status(404).json({ message: 'Storage not found' });
    }

    const newPartition = {
      name,
      location,
      capacity: capacity || 0  // optional
    };

    storage.partitions.push(newPartition);
    await storage.save();

    res.status(201).json({ message: 'Partition added successfully', storage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
