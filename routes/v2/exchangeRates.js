// routes/exchangeRates.js
const express = require('express');
const ExchangeRate = require('../../model/v2/ExchangeRate');
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


// تحديث سعر صرف عملة معينة
router.post('/exchange-rates', checkPermission('Update_ExchangeRates'), async (req, res) => {
    const { currency, rate } = req.body;
    const entityId = req.entity._id;
    try {
      let exchangeRate = await ExchangeRate.findOne({ currency });
      if (exchangeRate) {
        exchangeRate.rate = rate;
        exchangeRate.updatedAt = new Date();
      } else {
        exchangeRate = new ExchangeRate({ currency, rate, entity: entityId });
      }
      await exchangeRate.save();
  
      // تسجيل النشاط
      await logActivity({
        action: 'Update_ExchangeRate',
        performedBy: req.adminId,
        targetItem: exchangeRate._id,
        itemType: 'ExchangeRate',
        userType: 'Admin',
        entity: entityId
      });
  
      res.status(200).json({ message: 'Exchange rate updated successfully', exchangeRate });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
  // الحصول على جميع أسعار الصرف
  router.get('/exchange-rates', checkPermission('View_ExchangeRates'), async (req, res) => {
    try {
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const exchangeRates = await ExchangeRate.find({ entity: entityId }); // Filter by entity
  
      res.status(200).json(exchangeRates);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  
module.exports = router;
