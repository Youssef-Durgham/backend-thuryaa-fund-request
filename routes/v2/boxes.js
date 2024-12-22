// routes/boxes.js
const express = require('express');
const Box = require('../../model/Box');
const CashBox = require('../../model/CashBox');
const ActivityLog = require('../../model/ActivityLog');
const logActivity = require('../../utils/activityLogger');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const Transaction = require('../../model/Transactions')
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


// إنشاء صندوق جديد
router.post('/boxes', checkPermission('Create_Box'), async (req, res) => {
  try {
    const { name, description, type, ownerId } = req.body;
    const entityId = req.entity._id;

    const newBox = new Box({
      name,
      description,
      type,
      createdBy: req.adminId,
      owner: ownerId,
      entity: entityId
    });

    await newBox.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Box',
      performedBy: req.adminId,
      targetItem: newBox._id,
      itemType: 'Box',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Box created successfully', box: newBox });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// الحصول على جميع الصناديق
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

// تحديث صندوق
router.put('/boxes/:id', checkPermission('Edit_Box'), async (req, res) => {
  try {
    const { name, description, type, isActive } = req.body;
    const entityId = req.entity._id;
    const updatedBox = await Box.findByIdAndUpdate(
      req.params.id,
      { name, description, type, isActive },
      { new: true }
    );

    if (!updatedBox) {
      return res.status(404).json({ message: 'Box not found' });
    }

    // تسجيل النشاط
    await logActivity({
      action: 'Edit_Box',
      performedBy: req.adminId,
      targetItem: updatedBox._id,
      itemType: 'Box',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Box updated successfully', box: updatedBox });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// حذف صندوق (تغيير الحالة إلى غير نشط بدلاً من الحذف الفعلي)
router.delete('/boxes/:id', checkPermission('Delete_Box'), async (req, res) => {
  const entityId = req.entity._id;
  try {
    const box = await Box.findById(req.params.id);
    if (!box) {
      return res.status(404).json({ message: 'Box not found' });
    }

    box.isActive = false;
    await box.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Delete_Box',
      performedBy: req.adminId,
      targetItem: box._id,
      itemType: 'Box',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Box deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// فتح صندوق نقدي
router.post('/cashbox/open', checkPermission('Open_CashBox'), async (req, res) => {
  try {
    const { boxId, employeeId, initialAmount } = req.body;
    const entityId = req.entity._id;

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
      currentAmount: initialAmount,
      entity: entityId
    });

    await newCashBox.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Open_CashBox',
      performedBy: req.adminId,
      targetUser: employeeId,
      targetItem: newCashBox._id,
      userType: 'Admin',
      itemType: 'CashBox',
      entity: entityId
    });

    res.status(201).json({ message: 'Cash box opened successfully', cashBox: newCashBox });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// إغلاق صندوق نقدي
router.post('/cashbox/close', checkPermission('Close_CashBox'), async (req, res) => {
  try {
    const { cashBoxId, finalAmount } = req.body;
    const entityId = req.entity._id;

    const cashBox = await CashBox.findById(cashBoxId);
    if (!cashBox || !cashBox.isOpen) {
      return res.status(404).json({ message: 'Open cash box not found' });
    }

    const difference = finalAmount - cashBox.currentAmount;

    cashBox.isOpen = false;
    cashBox.closedAt = new Date();
    cashBox.currentAmount = finalAmount;

    if (difference !== 0) {
      const transaction = new Transaction({
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

    // تسجيل النشاط
    await logActivity({
      action: 'Close_CashBox',
      performedBy: req.adminId,
      targetItem: cashBox._id,
      itemType: 'CashBox',
      userType: 'Admin',
      entity: entityId
    });

    res.status(200).json({ message: 'Cash box closed successfully', cashBox });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// تحويل الأموال بين الصناديق
router.post('/boxes/transfer', checkPermission('Transfer_Money'), async (req, res) => {
  try {
    const { fromBoxId, toBoxId, amount, description } = req.body;
    const entityId = req.entity._id;
    if (!fromBoxId || !toBoxId || !amount) {
      return res.status(400).json({ message: 'From Box ID, To Box ID, and amount are required' });
    }

    const fromBox = await Box.findById(fromBoxId);
    const toBox = await Box.findById(toBoxId);

    if (!fromBox || !toBox) {
      return res.status(404).json({ message: 'One or both boxes not found' });
    }

    // تحقق من أن الصندوق المصدر نشط
    if (!fromBox.isActive) {
      return res.status(400).json({ message: 'Source box is closed' });
    }

    // تحقق من أن الصندوق الوجهة نشط
    if (!toBox.isActive) {
      return res.status(400).json({ message: 'Destination box is closed' });
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    if (fromBox.balance < transferAmount) {
      return res.status(400).json({ message: 'Insufficient funds in source box' });
    }

    // إنشاء معاملة جديدة
    const transaction = new Transaction({
      fromBox: fromBoxId,
      toBox: toBoxId,
      amount: transferAmount,
      performedBy: req.adminId,
      description,
      type: 'transfer',
      entity: entityId
    });

    // تحديث أرصدة الصناديق
    fromBox.balance -= transferAmount;
    toBox.balance += transferAmount;

    await Promise.all([
      transaction.save(),
      fromBox.save(),
      toBox.save()
    ]);

    // تسجيل النشاط
    await logActivity({
      action: 'Transfer_Money',
      performedBy: req.adminId,
      targetItem: transaction._id,
      itemType: 'Transaction',
      userType: 'Admin',
      entity: entityId
    });

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

module.exports = router;
