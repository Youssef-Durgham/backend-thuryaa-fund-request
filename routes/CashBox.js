const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const ActivityLog = require('../model/ActivityLog');
const Category = require('../model/Category');
const Subcategory = require('../model/SubCategory');
const Cashbox = require('../model/CashBox');
const HandoverLog = require('../model/HandoverLog');
const { Role } = require('../model/Role');

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


// Get all admin users with 'activate_order_casher' permission and their cashbox balance
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
      const admins = await Admin.find({ roles: { $in: roleIds } }).populate('roles');
  
      // Get cashbox balance for each admin
      const adminBalances = await Promise.all(admins.map(async (admin) => {
        const cashbox = await Cashbox.findOne({ employee: admin._id });
        return {
          admin: {
            _id: admin._id,
            phone: admin.phone,
            name: admin.name,
            roles: admin.roles
          },
          totalAmount: cashbox ? cashbox.totalAmount : 0 // If no cashbox, return 0 balance
        };
      }));
  
      res.status(200).json(adminBalances);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });
  
  // Decrease the total amount for a given admin ID
  router.post('/cashbox/decrease', checkPermission('Edit_CashBox'), async (req, res) => {
    try {
      const { adminId, amount } = req.body;
  
      if (!adminId || !amount) {
        return res.status(400).json({ message: 'Admin ID and amount are required' });
      }
  
      const cashbox = await Cashbox.findOne({ employee: adminId });
  
      if (!cashbox) {
        return res.status(404).json({ message: 'Cashbox not found' });
      }
  
      const decreaseAmount = Number(amount);
  
      if (isNaN(decreaseAmount)) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
  
      if (cashbox.totalAmount < decreaseAmount) {
        return res.status(400).json({ message: 'Insufficient funds in cashbox' });
      }
  
      cashbox.totalAmount -= decreaseAmount;
      await cashbox.save();
  
      // Create a handover log
      const handoverLog = new HandoverLog({
        employee: adminId,
        amount: decreaseAmount,
        cashbox: cashbox._id,
        SysNote: "Close Box Amount"
      });
      await handoverLog.save();
  
      res.status(200).json({ totalAmount: cashbox.totalAmount });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error });
    }
  });


  module.exports = router;