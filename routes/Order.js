const express = require('express');
const { Admin, Customer } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const Item = require('../model/Item');
const Order = require('../model/Order');
const Cashbox = require('../model/CashBox');
const HandoverLog = require('../model/HandoverLog');
const Wallet = require('../model/Wallet');
const Trash = require('../model/Trash');
const Counter = require('../model/Counter');
const mongoose = require('mongoose');
const TransactionOrder = require('../model/TransactionsOrder');
const TransBox = require('../model/TransBox');
const Box = require('../model/Box');

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




// Function to get the next order ID
const getNextOrderId = async (session) => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'orderId' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, session }
  );
  return counter.value;
};

// Create order
router.post('/create-order', checkPermission('create_order'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { phone, name, items } = req.body;

    // Find or create customer
    let customer = await Customer.findOne({ phone }).session(session);
    if (!customer) {
      customer = new Customer({ phone, name });
      await customer.save({ session });
    }

    // Check item quantities and calculate total amount
    let totalAmount = 0;
    const orderItems = [];
    for (const orderItem of items) {
      const item = await Item.findById(orderItem.item).session(session);
      if (!item) {
        throw new Error(`Item not found: ${orderItem.item}`);
      }
      const availableQuantity = Number(item.totalQuantity) - Number(item.reservedQuantity);
      if (availableQuantity < Number(orderItem.quantity)) {
        throw new Error(`Not enough quantity for item: ${item.name}`);
      }
      item.reservedQuantity = Number(item.reservedQuantity) + Number(orderItem.quantity);
      await item.save({ session });

      totalAmount += item.price * orderItem.quantity;
      orderItems.push({
        item: item._id,
        quantity: orderItem.quantity,
        price: item.price
      });
    }

    // Get next order ID
    const orderId = await getNextOrderId(session);

    // Create order
    const order = new Order({
      orderId,
      customer: customer._id,
      items,
      actions: [{
        action: 'Order Created',
        user: req.adminId,
        details: {
          items: orderItems,
          totalAmount
        }
      }]
    });

    await order.save({ session });

    await session.commitTransaction();
    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order creation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Edit order by ID
router.put('/edit-order/:id', checkPermission('edit_order'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { addItems, removeItems, updateItems } = req.body;
    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    let actionPerformed = false;
    let totalAmount = 0;
    const actionItems = [];

    // Add new items to the order
    if (addItems) {
      for (const addItem of addItems) {
        const item = await Item.findById(addItem.item).session(session);
        if (!item) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: `Item not found: ${addItem.item}` });
        }
        const availableQuantity = item.totalQuantity - item.reservedQuantity;
        if (availableQuantity < addItem.quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Not enough quantity for item: ${item.name}` });
        }
        item.reservedQuantity = Number(item.reservedQuantity) + Number(addItem.quantity);
        await item.save({ session });
        order.items.push(addItem);
        actionPerformed = true;
        totalAmount += item.price * addItem.quantity;
        actionItems.push({
          item: item._id,
          quantity: addItem.quantity,
          price: item.price
        });
      }
    }

    // Remove items from the order
    if (removeItems) {
      for (const removeItem of removeItems) {
        const orderItemIndex = order.items.findIndex(orderItem => orderItem.item.toString() === removeItem._id);
        if (orderItemIndex > -1) {
          const orderItem = order.items[orderItemIndex];
          const item = await Item.findById(orderItem.item).session(session);
          if (item) {
            item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity);
            await item.save({ session });
          }
          order.items.splice(orderItemIndex, 1);
          actionPerformed = true;
          totalAmount -= item.price * orderItem.quantity;
          actionItems.push({
            item: item._id,
            quantity: -orderItem.quantity,
            price: item.price
          });
        }
      }
    }

    // Update items in the order
    if (updateItems) {
      for (const updateItem of updateItems) {
        const orderItemIndex = order.items.findIndex(orderItem => orderItem.item.toString() === updateItem.item);
        if (orderItemIndex > -1) {
          const oldOrderItem = order.items[orderItemIndex];
          const item = await Item.findById(oldOrderItem.item).session(session);
          // Adjust reserved quantities
          item.reservedQuantity = Number(item.reservedQuantity) - Number(oldOrderItem.quantity) + Number(updateItem.quantity);
          const availableQuantity = item.totalQuantity - item.reservedQuantity;
          if (availableQuantity < 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Not enough quantity for item: ${item.name}` });
          }
          await item.save({ session });
          // Update order item
          order.items[orderItemIndex] = updateItem;
          actionPerformed = true;
          totalAmount += item.price * (updateItem.quantity - oldOrderItem.quantity);
          actionItems.push({
            item: item._id,
            quantity: updateItem.quantity - oldOrderItem.quantity,
            price: item.price
          });
        }
      }
    }

    if (actionPerformed) {
      // Add edit action to the order's actions array
      order.actions.push({
        action: 'Order Edited',
        user: req.adminId,
        details: {
          items: actionItems,
          totalAmount
        }
      });
    }

    await order.save({ session });

    await session.commitTransaction();

    // Populate fields as in the GET API response
    const updatedOrder = await Order.findById(id)
      .populate('customer')
      .populate({
        path: 'items.item',
        select: 'name price mainImageUrl productId'
      })
      .populate({
        path: 'actions.user',
        select: 'name phone'
      })
      .lean();

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Add the orderId to the updated order object
    updatedOrder.id = updatedOrder._id;
    updatedOrder.orderId = updatedOrder.orderId;

    res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order editing error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Activate order
router.post('/activate-order/:id', checkPermission('activate_order'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only pending orders can be activated' });
    }

    // Calculate total amount and prepare items details
    let totalAmount = 0;
    const itemsDetails = order.items.map(orderItem => {
      const itemAmount = orderItem.item.price * orderItem.quantity;
      totalAmount += itemAmount;
      return {
        item: orderItem.item._id,
        quantity: orderItem.quantity,
        price: orderItem.item.price,
        amount: itemAmount
      };
    });

    order.status = 'Activated';
    order.workflowStatus = 'Casher';
    order.actions.push({
      action: 'Order Activated',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: itemsDetails,
        totalAmount: totalAmount
      }
    });

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({ message: 'Order activated successfully', order });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order activation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Cancel order by sales employee
router.post('/cancel-order-sales/:id', checkPermission('cancel_order_sales'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status === 'Activated') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Activated orders cannot be cancelled by sales employees' });
    }

    let totalAmount = 0;
    const itemsDetails = [];

    // Return items to available quantity
    for (const orderItem of order.items) {
      const item = await Item.findById(orderItem.item._id).session(session);
      if (item) {
        item.reservedQuantity = Math.max(0, Number(item.reservedQuantity) - Number(orderItem.quantity));
        await item.save({ session });

        const itemAmount = orderItem.item.price * orderItem.quantity;
        totalAmount += itemAmount;
        itemsDetails.push({
          item: item._id,
          quantity: orderItem.quantity,
          price: orderItem.item.price,
          amount: itemAmount
        });
      }
    }

    // Update order status
    order.status = 'Cancelled';
    order.actions.push({
      action: 'Order Cancelled by Sales',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: itemsDetails,
        totalAmount: totalAmount
      }
    });

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order cancellation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Paginated order listing with search and filters
router.get('/orders', checkPermission('Search_order'), async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', orderId, status, dateFrom, dateTo } = req.query;

    const query = {};

    // Search by customer name or phone
    if (search) {
      query.$or = [
        { 'customer.name': new RegExp(search, 'i') },
        { 'customer.phone': new RegExp(search, 'i') }
      ];
    }

    // Filter by order ID
    if (orderId) {
      query.orderId = parseInt(orderId, 10);
    }

    // Filter by order status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    const orders = await Order.find(query)
      .populate('customer')
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.status(200).json({
      currentPage: parseInt(page, 10),
      totalPages,
      totalOrders,
      orders
    });
  } catch (error) {
    console.error('Order listing error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Get order details by ID
router.get('/order/:id', checkPermission('Search_order'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate('customer')
      .populate({
        path: 'items.item',
        select: 'name price mainImageUrl productId'
      })
      .populate({
        path: 'actions.user',
        select: 'name phone'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.id = order._id;
    order.workflowStatus = order.workflowStatus;
    order.orderId = order.orderId;
    order.items = order.items.map(item => ({
      ...item,
      deliveredQuantity: item.deliveredQuantity || 0,
      cancelledQuantity: item.cancelledQuantity || 0,
      remainingQuantity: item.quantity - (item.deliveredQuantity || 0) - (item.cancelledQuantity || 0),
      remainingDeliveryDate: item.remainingDeliveryDate // Ensure this is returned
    }));

    const transactionOrder = await TransactionOrder.findOne({ order: order._id })
      .populate({
        path: 'transactions.items.item',
        select: 'name price mainImageUrl productId'
      })
      .lean();

    if (transactionOrder) {
      // Populate performedBy for each transaction
      for (let transaction of transactionOrder.transactions) {
        if (transaction.performedByType === 'Admin') {
          transaction.performedBy = await Admin.findById(transaction.performedBy).select('name phone').lean();
        } else if (transaction.performedByType === 'Customer') {
          transaction.performedBy = await Customer.findById(transaction.performedBy).select('name phone').lean();
        }
        // If it's neither Admin nor Customer, leave it as is
      }
    }

    order.transactionHistory = transactionOrder ? transactionOrder.transactions : [];

    // Create a map of item IDs to names for quick lookup
    const itemNameMap = order.items.reduce((map, item) => {
      map[item.item._id.toString()] = item.item.name;
      return map;
    }, {});

    // Function to process items in actions or transactions
    const processItems = (items) => {
      return items.map(item => ({
        ...item,
        item: {
          _id: item.item._id || item.item,
          name: itemNameMap[item.item._id || item.item] || 'Unknown Item'
        },
        remainingDeliveryDate: item.remainingDeliveryDate // Ensure this is returned in the action details as well
      }));
    };

    // Process items in actions
    order.actions = order.actions.map(action => ({
      ...action,
      details: action.details ? {
        ...action.details,
        items: processItems(action.details.items)
      } : undefined
    }));

    // Merge transaction data into actions
    order.actions = order.actions.map(action => {
      const matchingTransaction = order.transactionHistory.find(
        t => t.date.getTime() === action.date.getTime() &&
        t.performedByType === action.userType
      );
      if (matchingTransaction) {
        return {
          ...action,
          transactionType: matchingTransaction.transactionType,
          transactionAmount: matchingTransaction.amount,
          transactionItems: processItems(matchingTransaction.items),
          transactionNotes: matchingTransaction.notes,
          performedBy: matchingTransaction.performedBy // This now includes name and phone
        };
      }
      return action;
    });

    const totalAmounts = order.transactionHistory.reduce((acc, transaction) => {
      if (['FullDelivery', 'PartialDelivery'].includes(transaction.transactionType)) {
        acc.totalDelivered += transaction.amount;
      } else if (['FullCancellation', 'PartialCancellation'].includes(transaction.transactionType)) {
        acc.totalCancelled += transaction.amount;
      } else if (transaction.transactionType === 'Refund') {
        acc.totalRefunded += transaction.amount;
      }
      return acc;
    }, { totalDelivered: 0, totalCancelled: 0, totalRefunded: 0 });

    order.totalDelivered = totalAmounts.totalDelivered;
    order.totalCancelled = totalAmounts.totalCancelled;
    order.totalRefunded = totalAmounts.totalRefunded;

    res.status(200).json({ order });
  } catch (error) {
    console.error('Get order details error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Get order workflow by order ID
router.get('/order-workflow/:id', checkPermission('view_order_workflow'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate({
        path: 'actions.user',
        select: 'name phone'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const transactionOrder = await TransactionOrder.findOne({ order: order._id })
      .populate({
        path: 'transactions.items.item',
        select: 'name price mainImageUrl productId'
      })
      .lean();

    const workflow = await Promise.all(order.actions.map(async (action) => {
      let actionDetails = {
        action: action.action,
        date: action.date,
        employee: {
          name: action.user ? action.user.name : `${action.userType} User`,
          phone: action.user ? action.user.phone : 'N/A'
        }
      };

      // Find corresponding transaction in TransactionOrder
      if (transactionOrder) {
        const matchingTransaction = transactionOrder.transactions.find(t => 
          t.date.getTime() === action.date.getTime() && 
          t.performedByType === action.userType
        );

        if (matchingTransaction) {
          actionDetails.transactionType = matchingTransaction.transactionType;
          actionDetails.amount = matchingTransaction.amount;
          actionDetails.notes = matchingTransaction.notes;
          actionDetails.items = matchingTransaction.items.map(item => ({
            name: item.item.name,
            productId: item.item.productId,
            quantity: item.quantity,
            price: item.price,
            mainImageUrl: item.item.mainImageUrl
          }));
        }
      }

      return actionDetails;
    }));

    res.status(200).json({ workflow });
  } catch (error) {
    console.error('Get order workflow error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


  // casher employees apis //
// Activate order by casher
router.post('/activate-order-casher/:id', checkPermission('activate_order_casher'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Activated' || order.workflowStatus !== 'Casher') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only activated orders in casher stage can be processed' });
    }

    // Calculate total order price and prepare items details
    let totalOrderPrice = 0;
    const itemsDetails = order.items.map(orderItem => {
      const itemAmount = orderItem.item.price * orderItem.quantity;
      totalOrderPrice += itemAmount;
      return {
        item: orderItem.item._id,
        quantity: orderItem.quantity,
        price: orderItem.item.price,
        amount: itemAmount
      };
    });

    // Create transaction
    const transaction = new TransactionOrder({
      order: order._id,
      type: 'Post',
      items: itemsDetails,
      amount: totalOrderPrice,
      performedBy: req.adminId,
      performedByType: 'Admin',
      usertype: 'Casher'
    });
    await transaction.save({ session });

    // Update order workflow status
    order.workflowStatus = 'MaterialManagement';
    order.status = 'Posted';
    order.actions.push({
      action: 'Order Posted',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: itemsDetails,
        totalAmount: totalOrderPrice
      }
    });
    await order.save({ session });

    // Update cashbox
 // Find or create the admin's box
 let adminBox = await Box.findOne({ owner: req.adminId, type: 'admin' }).session(session);
 if (!adminBox) {
   adminBox = new Box({
     name: `${req.adminName}'s Box`,
     description: 'Personal admin box',
     type: 'admin',
     createdBy: req.adminId,
     owner: req.adminId,
     balance: 0
   });
   await adminBox.save({ session });
 }

  // Update admin's box balance
  adminBox.balance += totalOrderPrice;
  await adminBox.save({ session });

  // Create a TransBox record for this transaction
  const transBox = new TransBox({
    fromBox: null, // No source box for this transaction
    toBox: adminBox._id,
    amount: totalOrderPrice,
    performedBy: req.adminId,
    description: `Order ${order._id} posted`,
    type: 'deposit'
  });
  await transBox.save({ session });

    await session.commitTransaction();

    res.status(200).json({ message: 'Order processed and cash updated successfully', order, transaction });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order processing error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Reject order by casher
router.post('/reject-order-casher/:id', checkPermission('reject_order_casher'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.workflowStatus !== 'Casher') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only orders in casher stage can be rejected' });
    }

    // Prepare items details
    const itemsDetails = order.items.map(orderItem => ({
      item: orderItem.item._id,
      quantity: orderItem.quantity,
      price: orderItem.item.price,
      amount: orderItem.item.price * orderItem.quantity
    }));

    // Calculate total order amount
    const totalOrderAmount = itemsDetails.reduce((total, item) => total + item.amount, 0);

    // Update order status
    order.status = 'Pending';
    order.workflowStatus = 'Sales';
    order.actions.push({
      action: 'Order Rejected',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: itemsDetails,
        totalAmount: totalOrderAmount
      }
    });
    await order.save({ session });

    await session.commitTransaction();

    res.status(200).json({ message: 'Order rejected and returned to sales for editing', order });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order rejection error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Hand over cashbox
router.post('/handover-cashbox', checkPermission('handover_cashbox'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminId, amount } = req.body;

    const cashbox = await Cashbox.findOne({ employee: adminId }).session(session);
    if (!cashbox) {
      return res.status(404).json({ message: 'Cashbox not found' });
    }

    // Check if the amount to hand over is valid
    if (amount > cashbox.totalAmount) {
      return res.status(400).json({ message: 'Amount exceeds total in cashbox' });
    }

    // Log the handover action
    const handoverLog = new HandoverLog({
      employee: adminId,
      amount,
      cashbox: cashbox._id
    });
    await handoverLog.save({ session });

    // Reference the handover log in the cashbox
    cashbox.handoverLogs.push(handoverLog._id);

    // Perform the handover
    cashbox.totalAmount -= amount;
    await cashbox.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Cashbox handed over successfully', remainingAmount: cashbox.totalAmount });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Cashbox handover error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


 // mm employees apis //
// Activate order by Material Management
router.post('/activate-order-mm/:id', checkPermission('activate_order_mm'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { storageSelections, items, type, remainingDeliveryDate } = req.body;

    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'MaterialManagement') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Order is not in Material Management stage' });
    }

    const deliveredItems = [];
    let totalAmount = 0;
    let isFullDelivery = type === 'full';

    for (const { itemId, quantity } of items) {
      const orderItem = order.items.find(oi => oi.item._id.toString() === itemId);
      if (!orderItem) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid item: ${itemId}` });
      }

      const remainingQuantity = orderItem.quantity - (orderItem.deliveredQuantity || 0) - (orderItem.cancelledQuantity || 0);
      if (Number(quantity) > remainingQuantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Delivery quantity exceeds remaining quantity for item: ${itemId}` });
      }

      const { storageId, partitionId } = storageSelections[itemId] || {};
      if (!storageId) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Storage not selected for item: ${itemId}` });
      }

      let storageQuantity = orderItem.item.storageQuantities.find(sq =>
        sq.storage.toString() === storageId &&
        (!partitionId && !sq.partition || (sq.partition && sq.partition.toString() === partitionId))
      );

      if (!storageQuantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Storage/Partition not found for item: ${itemId}` });
      }

      if (Number(storageQuantity.quantity) < Number(quantity)) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Not enough quantity in the selected storage/partition for item: ${orderItem.item.name}` });
      }

      // Deduct the quantity from the storage/partition
      storageQuantity.quantity = Math.max(0, Number(storageQuantity.quantity) - Number(quantity));
      orderItem.item.reservedQuantity = Math.max(0, Number(orderItem.item.reservedQuantity) - Number(quantity));
      
      if (isNaN(storageQuantity.quantity) || isNaN(orderItem.item.reservedQuantity)) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid quantity calculation for item: ${itemId}` });
      }

      await orderItem.item.save({ session });

      // Update order item delivered quantity and delivery dates
      orderItem.deliveredQuantity = (orderItem.deliveredQuantity || 0) + Number(quantity);
      orderItem.deliveryDate = new Date(); // Set current date as delivery date for delivered items

      if (orderItem.deliveredQuantity + (orderItem.cancelledQuantity || 0) < orderItem.quantity) {
        isFullDelivery = false;
      }

      deliveredItems.push({
        item: orderItem.item._id,
        quantity: Number(quantity),
        price: orderItem.item.price,
        storage: storageId,
        partition: partitionId,
        amount: Number(orderItem.item.price) * Number(quantity),
        deliveryDate: orderItem.deliveryDate
      });
      totalAmount += Number(orderItem.item.price) * Number(quantity);
    }

    // Find or create TransactionOrder
    let transactionOrder = await TransactionOrder.findOne({ order: order._id }).session(session);
    if (!transactionOrder) {
      transactionOrder = new TransactionOrder({ order: order._id, transactions: [] });
    }

    // Add new transaction
    transactionOrder.transactions.push({
      transactionType: isFullDelivery ? 'FullDelivery' : 'PartialDelivery',
      items: deliveredItems,
      amount: totalAmount,
      performedBy: req.adminId,
      performedByType: 'Admin',
      usertype: 'Mm',
      notes: `Order ${isFullDelivery ? 'fully' : 'partially'} delivered`
    });

    await transactionOrder.save({ session });

    // Update order status and set remainingDeliveryDate for partial delivery
    if (isFullDelivery) {
      order.workflowStatus = 'Completed';
      order.status = 'Completed';
    } else {
      order.status = 'PartiallyDelivered';
      order.remainingDeliveryDate = remainingDeliveryDate; // Set remaining delivery date for partial delivery
    }

    order.actions.push({
      action: isFullDelivery ? 'Order Fully Delivered' : 'Order Partially Delivered',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: deliveredItems,
        totalAmount: totalAmount
      }
    });

    await order.save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: `Order ${isFullDelivery ? 'fully' : 'partially'} delivered and quantities updated successfully`, 
      order, 
      transactionOrder 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order processing error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// Cancel order by Material Management
router.post('/cancel-order-mm/:id', checkPermission('cancel_order_mm'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { items, type } = req.body;

    console.log('Cancellation request:', { id, items, type });

    const order = await Order.findById(id).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'MaterialManagement') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Order is not in Material Management stage' });
    }

    let totalAmount = 0;
    const cancelledItems = [];
    let isFullCancellation = type === 'full';

    for (const { itemId, quantity, storageId, partitionId } of items) {
      console.log('Processing item:', { itemId, quantity, storageId, partitionId });

      const orderItem = order.items.find(oi => oi.item._id.toString() === itemId);
      if (!orderItem) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid selection for item: ${itemId}` });
      }

      const remainingQuantity = orderItem.quantity - (orderItem.deliveredQuantity || 0) - (orderItem.cancelledQuantity || 0);
      const cancelQuantity = Number(quantity);

      console.log('Item quantities:', { 
        itemId, 
        totalQuantity: orderItem.quantity, 
        deliveredQuantity: orderItem.deliveredQuantity, 
        cancelledQuantity: orderItem.cancelledQuantity, 
        remainingQuantity, 
        requestedCancelQuantity: cancelQuantity 
      });

      if (isNaN(cancelQuantity) || cancelQuantity <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid cancellation quantity for item: ${itemId}` });
      }

      if (cancelQuantity > remainingQuantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Cancellation quantity exceeds remaining quantity for item: ${itemId}` });
      }

      const storageQuantity = orderItem.item.storageQuantities.find(sq =>
        sq.storage.toString() === storageId && (!partitionId || sq.partition?.toString() === partitionId)
      );

      if (!storageQuantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Storage/Partition not found for item: ${itemId}` });
      }

      const itemPrice = Number(orderItem.item.price);
      if (isNaN(itemPrice)) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid price for item: ${itemId}` });
      }

      totalAmount += itemPrice * cancelQuantity;
      cancelledItems.push({
        item: orderItem.item._id,
        quantity: cancelQuantity,
        price: itemPrice,
        storage: storageId,
        partition: partitionId,
        amount: itemPrice * cancelQuantity
      });

      // Update item quantities
      const newReservedQuantity = Math.max(0, Number(orderItem.item.reservedQuantity) - cancelQuantity);
      const newTotalQuantity = Number(orderItem.item.totalQuantity) + cancelQuantity;
      const newStorageQuantity = Number(storageQuantity.quantity) + cancelQuantity;

      console.log('Updated quantities:', { 
        itemId, 
        newReservedQuantity, 
        newTotalQuantity, 
        newStorageQuantity 
      });

      if (isNaN(newReservedQuantity) || isNaN(newTotalQuantity) || isNaN(newStorageQuantity)) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid quantity calculation for item: ${itemId}` });
      }

      orderItem.item.reservedQuantity = newReservedQuantity;
      orderItem.item.totalQuantity = newTotalQuantity;
      storageQuantity.quantity = newStorageQuantity;
      await orderItem.item.save({ session });

      // Update order item cancelled quantity
      orderItem.cancelledQuantity = (orderItem.cancelledQuantity || 0) + cancelQuantity;

      // Move to trash
      const trash = new Trash({
        item: orderItem.item._id,
        quantity: cancelQuantity,
        reason: 'Cancelled Order - Bad Item'
      });
      await trash.save({ session });

      if (orderItem.deliveredQuantity + orderItem.cancelledQuantity < orderItem.quantity) {
        isFullCancellation = false;
      }
    }

    // Refund the money to the user's wallet
    let wallet = await Wallet.findOne({ user: order.customer }).session(session);
    if (!wallet) {
      wallet = new Wallet({ user: order.customer });
    }
    wallet.balance = Number(wallet.balance) + totalAmount;
    await wallet.save({ session });

    // Find or create TransactionOrder
    let transactionOrder = await TransactionOrder.findOne({ order: order._id }).session(session);
    if (!transactionOrder) {
      transactionOrder = new TransactionOrder({ order: order._id, transactions: [] });
    }

    // Add new transaction
    transactionOrder.transactions.push({
      transactionType: isFullCancellation ? 'FullCancellation' : 'PartialCancellation',
      items: cancelledItems,
      amount: totalAmount,
      performedBy: req.adminId,
      performedByType: 'Admin',
      usertype: 'Mm',
      notes: `Order ${isFullCancellation ? 'fully' : 'partially'} cancelled and refunded`
    });

    await transactionOrder.save({ session });

    // Update order status
    if (isFullCancellation) {
      order.status = 'Cancelled';
      order.workflowStatus = 'Cancelled';
    } else {
      order.status = 'PartiallyCancelled';
    }
    order.actions.push({
      action: isFullCancellation ? 'Order Fully Cancelled' : 'Order Partially Cancelled',
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: cancelledItems,
        totalAmount: totalAmount
      }
    });
    await order.save({ session });

    await session.commitTransaction();

    console.log('Cancellation successful:', { 
      orderId: order._id, 
      isFullCancellation, 
      totalAmount, 
      cancelledItems 
    });

    res.status(200).json({ 
      message: `Order ${isFullCancellation ? 'fully' : 'partially'} cancelled, refund processed, and items moved to trash`, 
      order, 
      transactionOrder 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order cancellation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// request refund for mm user for an items or fully refund
router.post('/request-refund/:orderId', checkPermission('request_refund'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { items, reason } = req.body;

    const order = await Order.findById(orderId).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'Completed' || order.status !== 'Completed') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only completed orders can be refunded' });
    }

    let totalRefundAmount = 0;
    let totalOrderAmount = 0;
    const refundItems = [];

    for (const orderItem of order.items) {
      totalOrderAmount += orderItem.quantity * orderItem.item.price;
    }

    for (const { itemId, quantity } of items) {
      const orderItem = order.items.find(oi => oi.item._id.toString() === itemId);
      if (!orderItem) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid item: ${itemId}` });
      }

      if (Number(quantity) > orderItem.deliveredQuantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Refund quantity exceeds delivered quantity for item: ${itemId}` });
      }

      const refundAmount = Number(orderItem.item.price) * Number(quantity);
      totalRefundAmount += refundAmount;

      refundItems.push({
        item: orderItem.item._id,
        quantity: Number(quantity),
        price: orderItem.item.price,
        amount: refundAmount
      });
    }

    // Determine if it's a full or partial refund
    const isFullRefund = Math.abs(totalRefundAmount - totalOrderAmount) < 0.01; // Using a small epsilon for float comparison

    // Update order status and workflowStatus
    order.status = isFullRefund ? 'Refund' : 'PartialRefund';
    order.workflowStatus = 'Casher';

    // Find or create TransactionOrder
    let transactionOrder = await TransactionOrder.findOne({ order: order._id }).session(session);
    if (!transactionOrder) {
      transactionOrder = new TransactionOrder({ order: order._id, transactions: [] });
    }

    // Add new transaction for refund request
    transactionOrder.transactions.push({
      transactionType: 'RefundRequested',
      items: refundItems,
      amount: totalRefundAmount,
      performedBy: req.adminId,
      performedByType: 'Admin',
      usertype: 'Mm',
      notes: `${isFullRefund ? 'Full' : 'Partial'} refund requested: ${reason}`
    });

    await transactionOrder.save({ session });

    order.actions.push({
      action: `${isFullRefund ? 'Full' : 'Partial'} Refund Requested`,
      user: req.adminId,
      userType: 'Admin',
      details: {
        items: refundItems,
        totalAmount: totalRefundAmount,
        reason: reason
      }
    });

    await order.save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: `${isFullRefund ? 'Full' : 'Partial'} refund request submitted successfully`, 
      order,
      transactionOrder 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Refund request error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// approve refund by casher
router.post('/approve-refund/:orderId', checkPermission('approve_refund'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { approve } = req.body;

    const order = await Order.findById(orderId).populate('items.item').session(session);
    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'Casher' || (order.status !== 'Refund' && order.status !== 'PartialRefund')) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid order status for refund approval' });
    }

    const transactionOrder = await TransactionOrder.findOne({ order: order._id }).session(session);
    if (!transactionOrder) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Transaction order not found' });
    }

    // Find the most recent RefundRequested transaction
    const refundTransaction = transactionOrder.transactions
      .filter(t => t.transactionType === 'RefundRequested')
      .sort((a, b) => b.date - a.date)[0];

    if (!refundTransaction) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending refund request found' });
    }

    const isFullRefund = order.status === 'Refund';

    if (approve) {
      // Update item quantities
      for (const refundItem of refundTransaction.items) {
        const item = await Item.findById(refundItem.item).session(session);
        if (!item) {
          await session.abortTransaction();
          return res.status(404).json({ message: `Item not found: ${refundItem.item}` });
        }

        item.totalQuantity += refundItem.quantity;
        item.reservedQuantity = Math.max(0, item.reservedQuantity - refundItem.quantity);
        await item.save({ session });

        // Update order item quantities
        const orderItem = order.items.find(oi => oi.item._id.toString() === refundItem.item.toString());
        if (orderItem) {
          orderItem.deliveredQuantity -= refundItem.quantity;
        }
      }

      // Add new transaction for approved refund
      transactionOrder.transactions.push({
        transactionType: 'Refund',
        items: refundTransaction.items,
        amount: refundTransaction.amount,
        performedBy: req.adminId,
        performedByType: 'Admin',
        usertype: 'Casher',
        notes: `${isFullRefund ? 'Full' : 'Partial'} refund approved for order ${order._id}`
      });

      // Update cashbox
      const adminBox = await Box.findOne({ owner: req.adminId, type: 'admin' }).session(session);
      if (adminBox) {
        adminBox.balance -= refundTransaction.amount;
        await adminBox.save({ session });

        // Create a TransBox record for this transaction
        const transBox = new TransBox({
          fromBox: adminBox._id,
          toBox: null,
          amount: refundTransaction.amount,
          performedBy: req.adminId,
          description: `${isFullRefund ? 'Full' : 'Partial'} refund for order ${order._id}`,
          type: 'withdrawal'
        });
        await transBox.save({ session });
      }

      order.actions.push({
        action: `${isFullRefund ? 'Full' : 'Partial'} Refund Approved`,
        user: req.adminId,
        userType: 'Admin',
        details: {
          items: refundTransaction.items,
          totalAmount: refundTransaction.amount
        }
      });

      // Update order status and workflowStatus
      order.status = isFullRefund ? 'Refunded' : 'PartiallyRefunded';
      order.workflowStatus = 'Completed';
    } else {
      // Add new transaction for rejected refund
      transactionOrder.transactions.push({
        transactionType: 'RefundRejected',
        items: refundTransaction.items,
        amount: refundTransaction.amount,
        performedBy: req.adminId,
        performedByType: 'Admin',
        usertype: 'Casher',
        notes: `${isFullRefund ? 'Full' : 'Partial'} refund rejected for order ${order._id}`
      });

      order.actions.push({
        action: `${isFullRefund ? 'Full' : 'Partial'} Refund Rejected`,
        user: req.adminId,
        userType: 'Admin',
        details: {
          items: refundTransaction.items,
          totalAmount: refundTransaction.amount
        }
      });

      // Revert order status and set workflowStatus to Completed
      order.status = 'Completed';
      order.workflowStatus = 'Completed';
    }

    // Mark the original refund request as processed
    refundTransaction.notes += ` | Processed: ${approve ? 'Approved' : 'Rejected'}`;

    await order.save({ session });
    await transactionOrder.save({ session });

    await session.commitTransaction();

    res.status(200).json({ 
      message: `${isFullRefund ? 'Full' : 'Partial'} refund ${approve ? 'approved' : 'rejected'} successfully`, 
      order,
      transactionOrder 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Refund approval error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});

// create order for mobile //

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    console.log(decoded, token)
    const customer = await Customer.findById(decoded.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

// Create order
router.post('/create-order-mobile', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items } = req.body;
    let totalOrderPrice = 0;
    const orderItems = [];

    // Check item quantities and prepare order items
    for (const orderItem of items) {
      const item = await Item.findById(orderItem.item).session(session);
      if (!item) {
        await session.abortTransaction();
        return res.status(404).json({ message: `Item not found: ${orderItem.item}` });
      }
      const availableQuantity = Number(item.totalQuantity) - Number(item.reservedQuantity);
      if (availableQuantity < Number(orderItem.quantity)) {
        await session.abortTransaction();
        return res.status(420).json({ message: `Not enough quantity for item: ${item.name}` });
      }
      item.reservedQuantity = Number(item.reservedQuantity) + Number(orderItem.quantity);
      await item.save({ session });

      const itemTotal = Number(item.price) * Number(orderItem.quantity);
      totalOrderPrice += itemTotal;

      orderItems.push({
        item: item._id,
        quantity: Number(orderItem.quantity),
        price: Number(item.price),
        amount: itemTotal
      });
    }

    // Get next order ID
    const orderId = await getNextOrderId(session);

    // Create order
    const order = new Order({
      orderId,
      customer: req.customer._id,
      items: orderItems,
      workflowStatus: 'MaterialManagement',
      status: 'Posted',
      actions: [{
        action: 'Order Created',
        user: req.customer._id,
        userType: 'Customer',
        details: {
          items: orderItems,
          totalAmount: totalOrderPrice
        }
      }]
    });
    await order.save({ session });

    // Create transaction
    const transaction = new TransactionOrder({
      order: order._id,
      type: 'Post',
      items: orderItems,
      amount: totalOrderPrice,
      performedBy: req.customer._id,
      performedByType: 'Customer'
    });
    await transaction.save({ session });

    await session.commitTransaction();

    res.status(201).json({ 
      message: 'Order created successfully', 
      order: {
        ...order.toObject(),
        actions: order.actions.map(action => ({
          ...action.toObject(),
          user: req.customer._id
        }))
      }, 
      transaction 
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Order creation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    session.endSession();
  }
});


// return order user details
router.get('/orders/user/get', authMiddleware, async (req, res) => {
  try {
    const userId = req.customer._id; // This will be available after JWT verification
    const orders = await Order.find({ customer: userId })
      .populate('customer')
      .populate('items.item')
      .populate('actions.user');
console.log(orders, userId)
    res.json(orders);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;