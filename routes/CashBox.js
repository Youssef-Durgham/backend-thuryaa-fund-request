const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');
const Cashbox = require('../model/CashBox');
const HandoverLog = require('../model/HandoverLog');
const { Role } = require('../model/Role');
const Box = require('../model/Box');
const TransBox = require('../model/TransBox');
const CashBox = require('../model/CashBox');
const mongoose = require('mongoose');

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


// Create a new box
router.post('/boxes', checkPermission('Create_Box'), async (req, res) => {
  try {
    const { name, description, type } = req.body;

    const newBox = new Box({
      name,
      description,
      type,
      createdBy: req.adminId
    });

    await newBox.save();

    res.status(201).json({
      message: 'Box created successfully',
      box: newBox
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all boxes
router.get('/boxes', checkPermission('View_Boxes'), async (req, res) => {
  try {
    const boxes = await Box.find({ isActive: true }).populate('createdBy', 'name');
    res.status(200).json(boxes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a box
router.put('/boxes/:id', checkPermission('Edit_Box'), async (req, res) => {
  try {
    const { name, description, type, isActive } = req.body;
    const updatedBox = await Box.findByIdAndUpdate(
      req.params.id,
      { name, description, type, isActive },
      { new: true }
    );

    if (!updatedBox) {
      return res.status(404).json({ message: 'Box not found' });
    }

    res.status(200).json({
      message: 'Box updated successfully',
      box: updatedBox
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Transfer money between boxes
router.post('/boxes/transfer', checkPermission('Transfer_Money'), async (req, res) => {
  try {
    const { fromBoxId, toBoxId, amount, description } = req.body;
    if (!fromBoxId || !toBoxId || !amount) {
      return res.status(400).json({ message: 'From Box ID, To Box ID, and amount are required' });
    }

    const fromBox = await Box.findById(fromBoxId);
    const toBox = await Box.findById(toBoxId);

    if (!fromBox || !toBox) {
      return res.status(404).json({ message: 'One or both boxes not found' });
    }

    // Check if fromBox is active
    if (!fromBox.isActive) {
      const closedCashBox = await CashBox.findOne({ box: fromBoxId, isOpen: false }).sort({ closedAt: -1 });
      return res.status(400).json({ 
        message: 'Source box is closed', 
        closedDate: closedCashBox ? closedCashBox.closedAt : 'Unknown' 
      });
    }

    // Check if toBox is active
    if (!toBox.isActive) {
      const closedCashBox = await CashBox.findOne({ box: toBoxId, isOpen: false }).sort({ closedAt: -1 });
      return res.status(400).json({ 
        message: 'Destination box is closed', 
        closedDate: closedCashBox ? closedCashBox.closedAt : 'Unknown' 
      });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (fromBox.balance < transferAmount) {
      return res.status(400).json({ message: 'Insufficient funds in source box' });
    }

    // Create a new transaction
    const transaction = new TransBox({
      fromBox: fromBoxId,
      toBox: toBoxId,
      amount: transferAmount,
      performedBy: req.adminId,
      description,
      type: 'transfer'
    });

    // Update box balances
    fromBox.balance -= transferAmount;
    toBox.balance += transferAmount;

    // Save all changes
    await Promise.all([
      transaction.save(),
      fromBox.save(),
      toBox.save()
    ]);

    res.status(200).json({
      message: 'Transfer successful',
      transaction: transaction,
      fromBox: { id: fromBox._id, newBalance: fromBox.balance },
      toBox: { id: toBox._id, newBalance: toBox.balance }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all admins with 'activate_order_casher' permission and their cashbox balance
router.get('/admins/activate_order_casher/balance', checkPermission('Show_CashBox'), async (req, res) => {
  try {
    // Find all roles that include the 'activate_order_casher' permission
    const rolesWithPermission = await Role.find({ permissions: 'activate_order_casher' });
    if (!rolesWithPermission.length) {
      return res.status(404).json({ message: 'No roles with the specified permission found' });
    }

    // Extract role IDs
    const roleIds = rolesWithPermission.map(role => role._id);

    // Find all admins with these roles
    const admins = await Admin.find({ roles: { $in: roleIds } }, 'name phone');

    // Get box information for each admin
    const adminBoxes = await Promise.all(admins.map(async (admin) => {
      const box = await Box.findOne({ owner: admin._id, type: 'admin' });
      
      return {
        userId: admin._id,
        userName: admin.name,
        userPhone: admin.phone,
        box: box ? {
          _id: box._id,
          name: box.name,
          type: box.type,
          balance: box.balance,
          isActive: box.isActive,
          createdAt: box.createdAt
        } : null
      };
    }));

    res.status(200).json(adminBoxes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Decrease the total amount for a given admin's open cashbox
router.post('/box/decrease', checkPermission('Edit_CashBox'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminId, amount, description, toBoxId } = req.body;

    if (!adminId || !amount || !toBoxId) {
      return res.status(400).json({ message: 'Admin ID, amount, and destination box ID are required' });
    }

    const admin = await Admin.findById(adminId).session(session);
    if (!admin) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Admin not found' });
    }

    const fromBox = await Box.findOne({ owner: adminId, type: 'admin' }).session(session);
    if (!fromBox) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Box not found for this admin' });
    }

    const toBox = await Box.findById(toBoxId).session(session);
    if (!toBox) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Destination box not found' });
    }

    if (!fromBox.isActive || !toBox.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'One or both boxes are inactive' });
    }

    const decreaseAmount = Number(amount);
    if (isNaN(decreaseAmount) || decreaseAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (fromBox.balance < decreaseAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Insufficient funds in box' });
    }

    // Create a transaction
    const transaction = new TransBox({
      fromBox: fromBox._id,
      toBox: toBox._id,
      amount: decreaseAmount,
      performedBy: req.adminId,
      description: description || "Transfer between boxes",
      type: 'transfer'
    });

    // Update box balances
    fromBox.balance -= decreaseAmount;
    toBox.balance += decreaseAmount;

    // Save all changes
    await Promise.all([
      transaction.save({ session }),
      fromBox.save({ session }),
      toBox.save({ session })
    ]);

    await session.commitTransaction();

    res.status(200).json({
      message: 'Amount transferred successfully',
      fromBox: { id: fromBox._id, newBalance: fromBox.balance },
      toBox: { id: toBox._id, newBalance: toBox.balance },
      transaction: transaction
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Open a cash box
router.post('/cashbox/open', checkPermission('Open_CashBox'), async (req, res) => {
  try {
    const { boxId, employeeId, initialAmount } = req.body;

    const box = await Box.findById(boxId);
    if (!box) {
      return res.status(404).json({ message: 'Box not found' });
    }

    const existingOpenCashBox = await CashBox.findOne({ employee: employeeId, isOpen: true });
    if (existingOpenCashBox) {
      return res.status(400).json({ message: 'Employee already has an open cash box' });
    }

    const newCashBox = new CashBox({
      box: boxId,
      employee: employeeId,
      isOpen: true,
      openedAt: new Date(),
      initialAmount,
      currentAmount: initialAmount
    });

    await newCashBox.save();

    res.status(201).json({
      message: 'Cash box opened successfully',
      cashBox: newCashBox
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Close a cash box
router.post('/cashbox/close', checkPermission('Close_CashBox'), async (req, res) => {
  try {
    const { cashBoxId, finalAmount } = req.body;

    const cashBox = await CashBox.findById(cashBoxId);
    if (!cashBox || !cashBox.isOpen) {
      return res.status(404).json({ message: 'Open cash box not found' });
    }

    const difference = finalAmount - cashBox.currentAmount;

    cashBox.isOpen = false;
    cashBox.closedAt = new Date();
    cashBox.currentAmount = finalAmount;

    if (difference !== 0) {
      const transaction = new TransBox({
        fromBox: difference < 0 ? cashBox.box : null,
        toBox: difference > 0 ? cashBox.box : null,
        amount: Math.abs(difference),
        performedBy: req.adminId,
        description: `Cash box closure adjustment`,
        type: difference > 0 ? 'deposit' : 'withdrawal'
      });
      await transaction.save();
      cashBox.transactions.push(transaction._id);
    }

    await cashBox.save();

    res.status(200).json({
      message: 'Cash box closed successfully',
      cashBox: cashBox
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


  module.exports = router;