const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Admin } = require('../model/Users');
const Order = require('../model/Order');
const TransactionOrder = require('../model/TransactionsOrder');
const jwt = require('jsonwebtoken');

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

// 1. Sales Report API
router.get('/api/reports/sales', checkPermission('Sales_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const salesData = await TransactionOrder.aggregate([
      {
        $match: {
          type: { $in: ['Post', 'PartialDelivery', 'FullDelivery'] },
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          transactions: {
            $push: {
              id: "$_id",
              type: "$type",
              amount: "$amount",
              items: "$items"
            }
          },
          totalSales: { $sum: "$amount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(salesData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Inventory Movement Report API
router.get('/api/reports/inventory-movement', checkPermission('Inventory_Report'), async (req, res) => {
  try {
    const { startDate, endDate, itemId } = req.query;
    const inventoryMovement = await TransactionOrder.aggregate([
      {
        $match: {
          date: { $gte: new Date(startDate), $lte: new Date(endDate) },
          'items.item': mongoose.Types.ObjectId(itemId)
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            type: "$type"
          },
          transactions: {
            $push: {
              id: "$_id",
              quantity: "$items.quantity",
              price: "$items.price"
            }
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalValue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { '_id.date': 1, '_id.type': 1 } }
    ]);
    res.json(inventoryMovement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Customer Order History API
router.get('/api/reports/customer-order-history/:customerId', checkPermission('Customer_Report'), async (req, res) => {
  try {
    const { customerId } = req.params;
    const orderHistory = await Order.find({ customer: customerId })
      .populate('items.item')
      .populate('actions.user')
      .sort('-createdAt');
    res.json(orderHistory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Order Fulfillment Report API
router.get('/api/reports/order-fulfillment', checkPermission('Fulfillment_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const fulfillmentData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: '$status',
          orders: {
            $push: {
              id: "$_id",
              customer: "$customer",
              items: "$items",
              createdAt: "$createdAt",
              lastActionDate: { $arrayElemAt: ['$actions.date', -1] }
            }
          },
          count: { $sum: 1 },
          averageFulfillmentTime: {
            $avg: {
              $subtract: [
                { $arrayElemAt: ['$actions.date', -1] },
                '$createdAt'
              ]
            }
          }
        }
      }
    ]);
    res.json(fulfillmentData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Financial Summary Report API (excluding Refunds)
router.get('/api/reports/financial-summary', checkPermission('Financial_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const financialSummary = await TransactionOrder.aggregate([
      {
        $match: {
          date: { $gte: new Date(startDate), $lte: new Date(endDate) },
          type: { $ne: 'Refund' }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            type: "$type"
          },
          transactions: {
            $push: {
              id: "$_id",
              amount: "$amount",
              items: "$items"
            }
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.type': 1 } }
    ]);
    res.json(financialSummary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Refund Report API
router.get('/api/reports/refunds', checkPermission('Refund_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const refundData = await TransactionOrder.aggregate([
      {
        $match: {
          type: 'Refund',
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          refunds: {
            $push: {
              id: "$_id",
              amount: "$amount",
              items: "$items",
              performedBy: "$performedBy",
              performedByType: "$performedByType"
            }
          },
          totalRefundAmount: { $sum: "$amount" },
          refundCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(refundData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;