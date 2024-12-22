// routes/bankStatements.js
const express = require('express');
const BankStatement = require('../../model/v2/BankStatement');
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


router.post('/bank-statements', checkPermission('Upload_BankStatement'), async (req, res) => {
  try {
    const { bankAccountId, statementDate, transactions } = req.body;
    const entityId = req.entity._id;

    const newStatement = new BankStatement({
      bankAccount: bankAccountId,
      statementDate,
      transactions,
      createdBy: req.adminId,
      entity: entityId
    });

    await newStatement.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Upload_BankStatement',
      performedBy: req.adminId,
      targetItem: newStatement._id,
      itemType: 'BankStatement',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Bank statement uploaded successfully', bankStatement: newStatement });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/bank-statements', checkPermission('View_BankStatements'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const statements = await BankStatement.find({ entity: entityId }) // Filter by entity
      .populate('bankAccount', 'name')
      .populate('createdBy', 'name');

    res.status(200).json(statements);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
