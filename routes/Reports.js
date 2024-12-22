const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Admin } = require('../model/Users');
const Order = require('../model/Order');
const TransactionOrder = require('../model/TransactionsOrder');
const jwt = require('jsonwebtoken');
const TransBox = require('../model/TransBox');
const Box = require('../model/Box');

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


// 1. Enhanced Sales Report API
router.get('/api/reports/sales', checkPermission('Sales_Report'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    console.log('Query parameters:', { startDate, endDate, groupBy });

    const groupByFormat = {
      day: "%Y-%m-%d",
      week: "%Y-W%V",
      month: "%Y-%m"
    };

    const pipeline = [
      {
        $match: {
          'transactions.transactionType': { $in: ['Post', 'PartialDelivery', 'FullDelivery'] },
          'transactions.date': { 
            $gte: new Date(startDate), 
            $lte: new Date(new Date(endDate).setHours(23, 59, 59)) 
          }
        }
      },
      { $unwind: '$transactions' },
      { $unwind: '$transactions.items' },
      {
        $lookup: {
          from: 'items',
          localField: 'transactions.items.item',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupByFormat[groupBy], date: "$transactions.date" } },
            category: '$itemDetails.category',
            subcategory: '$itemDetails.subcategory'
          },
          transactions: {
            $push: {
              id: "$transactions._id",
              type: "$transactions.transactionType",
              amount: "$transactions.amount",
              items: "$transactions.items"
            }
          },
          totalSales: { $sum: { $multiply: ["$transactions.items.quantity", "$itemDetails.price"] } },
          totalCost: { $sum: { $multiply: ["$transactions.items.quantity", "$itemDetails.cost"] } },
          orderCount: { $sum: 1 },
          itemsSold: { $sum: "$transactions.items.quantity" }
        }
      },
      {
        $addFields: {
          grossProfit: { $subtract: ["$totalSales", "$totalCost"] }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: '_id.subcategory',
          foreignField: '_id',
          as: 'subcategoryDetails'
        }
      },
      {
        $project: {
          date: "$_id.date",
          category: { $arrayElemAt: ['$categoryDetails.name', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryDetails.name', 0] },
          transactions: 1,
          totalSales: 1,
          totalCost: 1,
          orderCount: 1,
          itemsSold: 1,
          grossProfit: 1
        }
      },
      { $sort: { date: 1, category: 1, subcategory: 1 } }
    ];

    console.log('Aggregation pipeline:', JSON.stringify(pipeline, null, 2));

    const TransactionOrder = mongoose.model('TransactionOrder');
    const salesData = await TransactionOrder.aggregate(pipeline);

    console.log('Sales data length:', salesData.length);
    if (salesData.length > 0) {
      console.log('First item of sales data:', salesData[0]);
    }

    res.json(salesData);
  } catch (error) {
    console.error('Error in sales report API:', error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// 2. Enhanced Inventory Movement Report API
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
        $lookup: {
          from: 'items',
          localField: 'items.item',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            type: "$type",
            storage: "$items.storage"
          },
          transactions: {
            $push: {
              id: "$_id",
              quantity: "$items.quantity",
              price: "$items.price"
            }
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalValue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          averageCost: { $avg: { $arrayElemAt: ['$itemDetails.cost', 0] } }
        }
      },
      {
        $lookup: {
          from: 'storages',
          localField: '_id.storage',
          foreignField: '_id',
          as: 'storageDetails'
        }
      },
      {
        $project: {
          date: "$_id.date",
          type: "$_id.type",
          storage: { $arrayElemAt: ['$storageDetails.name', 0] },
          transactions: 1,
          totalQuantity: 1,
          totalValue: 1,
          averageCost: 1,
          profitMargin: {
            $subtract: [
              1,
              { $divide: ["$averageCost", { $avg: "$transactions.price" }] }
            ]
          }
        }
      },
      { $sort: { date: 1, type: 1, storage: 1 } }
    ]);
    res.json(inventoryMovement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Enhanced Customer Order History API
router.get('/api/reports/customer-order-history/:customerId', checkPermission('Customer_Report'), async (req, res) => {
  try {
    const { customerId } = req.params;
    const orderHistory = await Order.aggregate([
      { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
      {
        $lookup: {
          from: 'items',
          localField: 'items.item',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  {
                    itemDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$itemDetails',
                            as: 'detail',
                            cond: { $eq: ['$$detail._id', '$$item.item'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $addFields: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                item: '$$item.item',
                quantity: '$$item.quantity',
                deliveredQuantity: '$$item.deliveredQuantity',
                cancelledQuantity: '$$item.cancelledQuantity',
                itemName: '$$item.itemDetails.name',
                price: '$$item.itemDetails.price'
              }
            }
          },
          totalAmount: {
            $sum: {
              $map: {
                input: '$items',
                as: 'item',
                in: { $multiply: ['$$item.quantity', '$$item.itemDetails.price'] }
              }
            }
          }
        }
      },
      {
        $project: {
          orderId: 1,
          status: 1,
          workflowStatus: 1,
          createdAt: 1,
          customerName: { $arrayElemAt: ['$customerDetails.name', 0] },
          items: 1,
          actions: 1,
          totalAmount: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(orderHistory);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Enhanced Order Fulfillment Report API
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
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      {
        $addFields: {
          lastAction: { $arrayElemAt: ['$actions', -1] },
          totalOrderValue: {
            $reduce: {
              input: '$actions',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $reduce: {
                      input: '$$this.details.items',
                      initialValue: 0,
                      in: { $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.price'] }] }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$status',
          orders: {
            $push: {
              id: "$_id",
              orderId: "$orderId",
              customer: { $arrayElemAt: ['$customerDetails.name', 0] },
              items: "$items",
              createdAt: "$createdAt",
              lastActionDate: '$lastAction.date',
              workflowStatus: "$workflowStatus",
              totalValue: '$totalOrderValue'
            }
          },
          count: { $sum: 1 },
          averageFulfillmentTime: {
            $avg: {
              $subtract: ['$lastAction.date', '$createdAt']
            }
          },
          totalValue: { $sum: '$totalOrderValue' }
        }
      },
      {
        $project: {
          status: "$_id",
          orders: 1,
          count: 1,
          averageFulfillmentTime: { $divide: ['$averageFulfillmentTime', 3600000] }, // Convert to hours
          totalValue: 1,
          averageOrderValue: { $divide: ["$totalValue", "$count"] }
        }
      },
      { $sort: { status: 1 } }
    ]);
    res.json(fulfillmentData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Enhanced Financial Summary Report API
router.get('/api/reports/financial-summary', checkPermission('Financial_Report'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const groupByFormat = {
      day: "%Y-%m-%d",
      week: "%Y-W%V",
      month: "%Y-%m"
    };

    const financialSummary = await TransactionOrder.aggregate([
      {
        $match: {
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $lookup: {
          from: 'items',
          localField: 'items.item',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupByFormat[groupBy], date: "$date" } },
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
          transactionCount: { $sum: 1 },
          costOfGoodsSold: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $multiply: [
                        "$$this.quantity",
                        { $arrayElemAt: ["$itemDetails.cost", 0] }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          date: "$_id.date",
          type: "$_id.type",
          transactions: 1,
          totalAmount: 1,
          transactionCount: 1,
          costOfGoodsSold: 1,
          grossProfit: { $subtract: ["$totalAmount", "$costOfGoodsSold"] },
          grossMargin: {
            $cond: [
              { $eq: ["$totalAmount", 0] },
              0,
              {
                $multiply: [
                  { $divide: [{ $subtract: ["$totalAmount", "$costOfGoodsSold"] }, "$totalAmount"] },
                  100
                ]
              }
            ]
          }
        }
      },
      { $sort: { date: 1, type: 1 } }
    ]);
    res.json(financialSummary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Enhanced Refund Report API
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
        $lookup: {
          from: 'admins',
          localField: 'performedBy',
          foreignField: '_id',
          as: 'adminDetails'
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'performedBy',
          foreignField: '_id',
          as: 'customerDetails'
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
              performedBy: {
                $cond: [
                  { $eq: ["$performedByType", "Admin"] },
                  { $arrayElemAt: ["$adminDetails.name", 0] },
                  { $arrayElemAt: ["$customerDetails.name", 0] }
                ]
              },
              performedByType: "$performedByType",
              reason: "$notes"
            }
          },
          totalRefundAmount: { $sum: "$amount" },
          refundCount: { $sum: 1 }
        }
      },
      {
        $project: {
          date: "$_id",
          refunds: 1,
          totalRefundAmount: 1,
          refundCount: 1,
          averageRefundAmount: { $divide: ["$totalRefundAmount", "$refundCount"] }
        }
      },
      { $sort: { date: 1 } }
    ]);
    res.json(refundData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 7. New API: Inventory Valuation Report
router.get('/api/reports/inventory-valuation', checkPermission('Inventory_Report'), async (req, res) => {
  try {
    const inventoryValuation = await Item.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategory',
          foreignField: '_id',
          as: 'subcategoryDetails'
        }
      },
      {
        $project: {
          name: 1,
          productId: 1,
          category: { $arrayElemAt: ['$categoryDetails.name', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryDetails.name', 0] },
          totalQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: { $subtract: ['$totalQuantity', '$reservedQuantity'] },
          averageCost: { $avg: '$inventory.originalCost' },
          totalValue: { $multiply: ['$totalQuantity', { $avg: '$inventory.originalCost' }] },
          storageDetails: '$storageQuantities'
        }
      },
      {
        $lookup: {
          from: 'storages',
          localField: 'storageDetails.storage',
          foreignField: '_id',
          as: 'storageInfo'
        }
      },
      {
        $project: {
          name: 1,
          productId: 1,
          category: 1,
          subcategory: 1,
          totalQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          averageCost: 1,
          totalValue: 1,
          storageDetails: {
            $map: {
              input: '$storageDetails',
              as: 'storage',
              in: {
                storageName: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$storageInfo',
                        as: 'info',
                        cond: { $eq: ['$$info._id', '$$storage.storage'] }
                      }
                    },
                    0
                  ].name
                },
                quantity: '$$storage.quantity'
              }
            }
          }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);
    res.json(inventoryValuation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 8. New API: Supplier Performance Report
router.get('/api/reports/supplier-performance', checkPermission('Supplier_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const supplierPerformance = await Item.aggregate([
      {
        $lookup: {
          from: 'transactionorders',
          let: { itemId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$type', ['Post', 'PartialDelivery', 'FullDelivery']] },
                    { $gte: ['$date', new Date(startDate)] },
                    { $lte: ['$date', new Date(endDate)] },
                    { $in: ['$$itemId', '$items.item'] }
                  ]
                }
              }
            }
          ],
          as: 'transactions'
        }
      },
      {
        $unwind: '$inventory'
      },
      {
        $group: {
          _id: '$supplier',
          totalPurchaseValue: { $sum: { $multiply: ['$inventory.quantity', '$inventory.originalCost'] } },
          totalSaleValue: {
            $sum: {
              $reduce: {
                input: '$transactions',
                initialValue: 0,
                in: {
                  $add: [
                    '$$value',
                    {
                      $sum: {
                        $map: {
                          input: {
                            $filter: {
                              input: '$$this.items',
                              as: 'item',
                              cond: { $eq: ['$$item.item', '$$ROOT._id'] }
                            }
                          },
                          as: 'filteredItem',
                          in: { $multiply: ['$$filteredItem.quantity', '$$filteredItem.price'] }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          itemCount: { $addToSet: '$_id' },
          averageLeadTime: { $avg: { $subtract: ['$inventory.dateAdded', new Date('$inventory.buyInvoiceId')] } }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: '_id',
          foreignField: '_id',
          as: 'supplierDetails'
        }
      },
      {
        $project: {
          supplier: { $arrayElemAt: ['$supplierDetails.name', 0] },
          totalPurchaseValue: 1,
          totalSaleValue: 1,
          itemCount: { $size: '$itemCount' },
          averageLeadTime: 1,
          profitMargin: {
            $multiply: [
              {
                $divide: [
                  { $subtract: ['$totalSaleValue', '$totalPurchaseValue'] },
                  '$totalSaleValue'
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { totalPurchaseValue: -1 } }
    ]);
    res.json(supplierPerformance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 9. New API: Customer Segmentation Report
router.get('/api/reports/customer-segmentation', checkPermission('Customer_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const customerSegmentation = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      {
        $group: {
          _id: '$customer',
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $reduce: {
                input: '$items',
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.price'] }] }
              }
            }
          },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          customer: { $arrayElemAt: ['$customerDetails.name', 0] },
          totalOrders: 1,
          totalSpent: 1,
          lastOrderDate: 1,
          averageOrderValue: { $divide: ['$totalSpent', '$totalOrders'] },
          daysSinceLastOrder: {
            $divide: [
              { $subtract: [new Date(), '$lastOrderDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $addFields: {
          segment: {
            $switch: {
              branches: [
                { case: { $gte: ['$totalSpent', 1000] }, then: 'High Value' },
                { case: { $and: [{ $gte: ['$totalSpent', 500] }, { $lt: ['$totalSpent', 1000] }] }, then: 'Medium Value' },
                { case: { $lt: ['$totalSpent', 500] }, then: 'Low Value' }
              ],
              default: 'New Customer'
            }
          },
          status: {
            $cond: [
              { $lte: ['$daysSinceLastOrder', 90] },
              'Active',
              'Inactive'
            ]
          }
        }
      },
      {
        $group: {
          _id: { segment: '$segment', status: '$status' },
          customerCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalSpent' },
          averageOrderValue: { $avg: '$averageOrderValue' }
        }
      },
      {
        $project: {
          segment: '$_id.segment',
          status: '$_id.status',
          customerCount: 1,
          totalRevenue: 1,
          averageOrderValue: 1,
          percentageOfTotal: {
            $multiply: [
              { $divide: ['$customerCount', { $sum: '$customerCount' }] },
              100
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
    res.json(customerSegmentation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 10. New API: Product Performance Report
router.get('/api/reports/product-performance', checkPermission('Sales_Report'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const productPerformance = await TransactionOrder.aggregate([
      {
        $match: {
          type: { $in: ['Post', 'PartialDelivery', 'FullDelivery'] },
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.item',
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orderCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      {
        $project: {
          productName: { $arrayElemAt: ['$itemDetails.name', 0] },
          productId: { $arrayElemAt: ['$itemDetails.productId', 0] },
          category: { $arrayElemAt: ['$itemDetails.category', 0] },
          subcategory: { $arrayElemAt: ['$itemDetails.subcategory', 0] },
          totalQuantitySold: 1,
          totalRevenue: 1,
          orderCount: 1,
          averagePrice: { $divide: ['$totalRevenue', '$totalQuantitySold'] },
          totalCost: { $multiply: ['$totalQuantitySold', { $arrayElemAt: ['$itemDetails.cost', 0] }] }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryDetails'
        }
      },
      {
        $lookup: {
          from: 'subcategories',
          localField: 'subcategory',
          foreignField: '_id',
          as: 'subcategoryDetails'
        }
      },
      {
        $project: {
          productName: 1,
          productId: 1,
          category: { $arrayElemAt: ['$categoryDetails.name', 0] },
          subcategory: { $arrayElemAt: ['$subcategoryDetails.name', 0] },
          totalQuantitySold: 1,
          totalRevenue: 1,
          orderCount: 1,
          averagePrice: 1,
          totalCost: 1,
          grossProfit: { $subtract: ['$totalRevenue', '$totalCost'] },
          profitMargin: {
            $multiply: [
              { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] },
              100
            ]
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);
    res.json(productPerformance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function for pagination
const paginateResults = (page, limit) => {
  const skip = (page - 1) * limit;
  return [
    { $skip: skip },
    { $limit: parseInt(limit) }
  ];
};

// 1. Transaction Summary Report
router.get('/reports/transaction-summary-box', checkPermission('Box_Reports'), async (req, res) => {
  try {
    const { startDate, endDate, boxId, type, page = 1, limit = 10 } = req.query;

    let matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (boxId) {
      matchStage.$or = [{ fromBox: mongoose.Types.ObjectId(boxId) }, { toBox: mongoose.Types.ObjectId(boxId) }];
    }
    if (type) {
      matchStage.type = type;
    }

    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'boxes',
          localField: 'fromBox',
          foreignField: '_id',
          as: 'fromBoxDetails'
        }
      },
      {
        $lookup: {
          from: 'boxes',
          localField: 'toBox',
          foreignField: '_id',
          as: 'toBoxDetails'
        }
      },
      {
        $lookup: {
          from: 'admins',
          localField: 'performedBy',
          foreignField: '_id',
          as: 'performedByDetails'
        }
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          type: 1,
          description: 1,
          createdAt: 1,
          fromBox: { $arrayElemAt: ['$fromBoxDetails.name', 0] },
          toBox: { $arrayElemAt: ['$toBoxDetails.name', 0] },
          performedBy: { $arrayElemAt: ['$performedByDetails.name', 0] }
        }
      }
    ];

    const totalCount = await TransBox.aggregate([...aggregationPipeline, { $count: 'total' }]);
    
    aggregationPipeline.push(...paginateResults(page, limit));

    const transactions = await TransBox.aggregate(aggregationPipeline);

    res.json({
      total: totalCount.length > 0 ? totalCount[0].total : 0,
      page: parseInt(page),
      limit: parseInt(limit),
      transactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

// 2. Box Balance Report
router.get('/reports/box-balances', checkPermission('Box_Reports'), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const aggregationPipeline = [
      {
        $lookup: {
          from: 'admins',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByDetails'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          type: 1,
          balance: 1,
          isActive: 1,
          createdAt: 1,
          createdBy: { $arrayElemAt: ['$createdByDetails.name', 0] }
        }
      },
      { $sort: { balance: -1 } }
    ];

    const totalCount = await Box.aggregate([...aggregationPipeline, { $count: 'total' }]);
    
    aggregationPipeline.push(...paginateResults(page, limit));

    const boxes = await Box.aggregate(aggregationPipeline);

    res.json({
      total: totalCount.length > 0 ? totalCount[0].total : 0,
      page: parseInt(page),
      limit: parseInt(limit),
      boxes
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

// 3. User Activity Report
router.get('/reports/user-activity-box', checkPermission('Box_Reports'), async (req, res) => {
  try {
    const { startDate, endDate, userId, page = 1, limit = 10 } = req.query;

    let matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (userId) {
      matchStage.performedBy = mongoose.Types.ObjectId(userId);
    }

    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$performedBy',
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          lastActivity: { $max: '$createdAt' },
          transactions: { $push: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'admins',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $project: {
          _id: 1,
          totalTransactions: 1,
          totalAmount: 1,
          lastActivity: 1,
          userName: { $arrayElemAt: ['$userDetails.name', 0] },
          userPhone: { $arrayElemAt: ['$userDetails.phone', 0] },
          recentTransactions: { $slice: ['$transactions', 5] }
        }
      }
    ];

    const totalCount = await TransBox.aggregate([...aggregationPipeline, { $count: 'total' }]);
    
    aggregationPipeline.push(...paginateResults(page, limit));

    const userActivity = await TransBox.aggregate(aggregationPipeline);

    res.json({
      total: totalCount.length > 0 ? totalCount[0].total : 0,
      page: parseInt(page),
      limit: parseInt(limit),
      userActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

// 4. Daily Transaction Summary
router.get('/reports/daily-summary-box', checkPermission('Box_Reports'), async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    let matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const aggregationPipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          deposits: {
            $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
          },
          withdrawals: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] }
          },
          transfers: {
            $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] }
          }
        }
      },
      { $sort: { _id: -1 } }
    ];

    const totalCount = await TransBox.aggregate([...aggregationPipeline, { $count: 'total' }]);
    
    aggregationPipeline.push(...paginateResults(page, limit));

    const dailySummary = await TransBox.aggregate(aggregationPipeline);

    res.json({
      total: totalCount.length > 0 ? totalCount[0].total : 0,
      page: parseInt(page),
      limit: parseInt(limit),
      dailySummary
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating report', error: error.message });
  }
});

module.exports = router;