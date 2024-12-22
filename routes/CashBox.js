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
const ExchangeRate = require('../model/v2/ExchangeRate');
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



// Create a new box
router.post('/boxes', checkPermission('Create_Box'), async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const newBox = new Box({
      name,
      description,
      type,
      createdBy: req.adminId,
      entity: entityId
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
    const entityId = req.entity._id; // Extract the entity ID from the request

    const boxes = await Box.find({ isActive: true, entity: entityId }) // Filter by isActive and entity
      .populate('createdBy', 'name');

    res.status(200).json(boxes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a box
router.put('/boxes/:id', checkPermission('Edit_Box'), async (req, res) => {
  try {
    const { name, description, type, isActive } = req.body;
    const entityId = req.entity._id;

    const box = await Box.findOneAndUpdate(
      { _id: req.params.id, entity: entityId }, // Ensure the box belongs to the entity
      { name, description, type, isActive },
      { new: true }
    );

    if (!box) {
      return res.status(404).json({ message: 'Box not found or does not belong to this entity' });
    }

    res.status(200).json({
      message: 'Box updated successfully',
      box
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Transfer money between boxes
router.post('/boxes/transfer', checkPermission('Transfer_Money'), async (req, res) => {
  try {
    const { fromBoxId, toBoxId, amount, description } = req.body;
    const entityId = req.entity._id;

    const [fromBox, toBox] = await Promise.all([
      Box.findOne({ _id: fromBoxId, entity: entityId }),
      Box.findOne({ _id: toBoxId, entity: entityId })
    ]);

    if (!fromBox || !toBox) {
      return res.status(404).json({ message: 'One or both boxes not found or do not belong to this entity' });
    }

    if (!fromBox.isActive || !toBox.isActive) {
      return res.status(400).json({ message: 'One or both boxes are inactive' });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0 || fromBox.balance < transferAmount) {
      return res.status(400).json({ message: 'Invalid amount or insufficient funds in source box' });
    }

    const transaction = new TransBox({
      fromBox: fromBoxId,
      toBox: toBoxId,
      amount: transferAmount,
      performedBy: req.adminId,
      description,
      type: 'transfer',
      entity: entityId
    });

    fromBox.balance -= transferAmount;
    toBox.balance += transferAmount;

    await Promise.all([transaction.save(), fromBox.save(), toBox.save()]);

    res.status(200).json({
      message: 'Transfer successful',
      transaction,
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
    const entityId = req.entity._id;

    const rolesWithPermission = await Role.find({ permissions: 'activate_order_casher', entity: entityId });
    if (!rolesWithPermission.length) {
      return res.status(404).json({ message: 'No roles with the specified permission found' });
    }

    const roleIds = rolesWithPermission.map(role => role._id);
    const admins = await Admin.find({ roles: { $in: roleIds }, entity: entityId }, 'name phone');

    const adminBoxes = await Promise.all(admins.map(async (admin) => {
      const box = await Box.findOne({ owner: admin._id, type: 'admin', entity: entityId });
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
    const entityId = req.entity._id;

    const [fromBox, toBox] = await Promise.all([
      Box.findOne({ owner: adminId, type: 'admin', entity: entityId }).session(session),
      Box.findOne({ _id: toBoxId, entity: entityId }).session(session)
    ]);

    if (!fromBox || !toBox) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'One or both boxes not found or do not belong to this entity' });
    }

    const decreaseAmount = Number(amount);
    if (isNaN(decreaseAmount) || decreaseAmount <= 0 || fromBox.balance < decreaseAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount or insufficient funds' });
    }

    const transaction = new TransBox({
      fromBox: fromBox._id,
      toBox: toBox._id,
      amount: decreaseAmount,
      performedBy: req.adminId,
      description: description || 'Transfer between boxes',
      type: 'transfer',
      entity: entityId
    });

    fromBox.balance -= decreaseAmount;
    toBox.balance += decreaseAmount;

    await Promise.all([
      transaction.save({ session }),
      fromBox.save({ session }),
      toBox.save({ session })
    ]);

    await session.commitTransaction();

    res.status(200).json({
      message: 'Amount transferred successfully',
      transaction,
      fromBox: { id: fromBox._id, newBalance: fromBox.balance },
      toBox: { id: toBox._id, newBalance: toBox.balance }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Open a cash box
// تحديث فتح صندوق نقدي ليشمل العملة
router.post('/cashbox/open', checkPermission('Open_CashBox'), async (req, res) => {
  try {
    const { boxId, employeeId, initialAmount, currency } = req.body; // إضافة حقل العملة

    // الحصول على سعر الصرف إذا كانت العملة ليست العملة الأساسية
    let exchangeRate = 1320;
    if (currency !== 'IQD') { // افتراض أن 'USD' هي العملة الأساسية
      const rateDoc = await ExchangeRate.findOne({ currency });
      if (!rateDoc) {
        return res.status(400).json({ message: `Exchange rate for currency ${currency} not found` });
      }
      exchangeRate = rateDoc.rate;
    }

    const amountInBaseCurrency = initialAmount * exchangeRate;

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
      currency, // إضافة العملة
      exchangeRate, // إضافة سعر الصرف
      amountInBaseCurrency, // إضافة المبلغ المحول للعملة الأساسية
      currentAmount: initialAmount
    });

    await newCashBox.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Open_CashBox',
      performedBy: req.adminId,
      targetUser: employeeId,
      targetItem: newCashBox._id,
      userType: 'Admin',
      itemType: 'CashBox'
    });

    res.status(201).json({ message: 'Cash box opened successfully', cashBox: newCashBox });
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