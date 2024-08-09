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

    // Check item quantities
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
    }

    // Get next order ID
    const orderId = await getNextOrderId(session);

    // Create order
    const order = new Order({
      orderId,
      customer: customer._id,
      items,
      actions: [{ action: 'Order Created', user: req.adminId }]
    });

    // Check if an order with this ID already exists
    const existingOrder = await Order.findOne({ orderId }).session(session);
    if (existingOrder) {
      throw new Error(`Order with ID ${orderId} already exists`);
    }

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
  try {
    const { id } = req.params;
    const { addItems, removeItems, updateItems } = req.body; // Arrays of items to add, remove, or update

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let actionPerformed = false;

    // Add new items to the order
    if (addItems) {
      for (const addItem of addItems) {
        const item = await Item.findById(addItem.item);
        if (!item) {
          return res.status(404).json({ message: `Item not found: ${addItem.item}` });
        }
        const availableQuantity = item.totalQuantity - item.reservedQuantity;
        if (availableQuantity < addItem.quantity) {
          return res.status(400).json({ message: `Not enough quantity for item: ${item.name}` });
        }
        item.reservedQuantity = Number(item.reservedQuantity) + Number(addItem.quantity);
        await item.save();
        order.items.push(addItem);
        actionPerformed = true;
      }
    }

    // Remove items from the order
    if (removeItems) {
      for (const removeItem of removeItems) {
        const orderItemIndex = order.items.findIndex(orderItem => orderItem.item.toString() === removeItem._id);
        if (orderItemIndex > -1) {
          const orderItem = order.items[orderItemIndex];
          const item = await Item.findById(orderItem.item);
          if (item) {
            item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity);
            await item.save();
          }
          order.items.splice(orderItemIndex, 1);
          actionPerformed = true;
        }
      }
    }

    // Update items in the order
    if (updateItems) {
      for (const updateItem of updateItems) {
        const orderItemIndex = order.items.findIndex(orderItem => orderItem.item.toString() === updateItem.item);
        if (orderItemIndex > -1) {
          const orderItem = order.items[orderItemIndex];
          const item = await Item.findById(orderItem.item);

          // Adjust reserved quantities
          item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity);
          const availableQuantity = item.totalQuantity - item.reservedQuantity;
          if (availableQuantity < updateItem.quantity) {
            return res.status(400).json({ message: `Not enough quantity for item: ${item.name}` });
          }
          item.reservedQuantity = Number(item.reservedQuantity) + Number(updateItem.quantity);
          await item.save();

          // Update order item
          order.items[orderItemIndex] = updateItem;
          actionPerformed = true;
        }
      }
    }

    if (actionPerformed) {
      // Add edit action to the order's actions array
      order.actions.push({ action: 'Order Edited', user: req.adminId });
    }

    await order.save();

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
      .lean();  // Convert to plain JavaScript object

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Add the orderId to the updated order object
    updatedOrder.id = updatedOrder._id;  // Ensure the id is also included if needed
    updatedOrder.orderId = updatedOrder.orderId;

    res.status(200).json({ message: 'Order updated successfully', order: updatedOrder });
  } catch (error) {
    console.error('Order editing error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Activate order
router.post('/activate-order/:id', checkPermission('activate_order'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be activated' });
    }
    order.status = 'Activated';
    order.workflowStatus = 'Casher';
    order.actions.push({ action: 'Order Activated', user: req.adminId });
    await order.save();

    res.status(200).json({ message: 'Order activated successfully', order });
  } catch (error) {
    console.error('Order activation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Cancel order by sales employee
router.post('/cancel-order-sales/:id', checkPermission('cancel_order_sales'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'Activated') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Activated orders cannot be cancelled by sales employees' });
    }

    // Return items to available quantity
    for (const orderItem of order.items) {
      const item = await Item.findById(orderItem.item).session(session);
      if (item) {
        item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity); // Convert to numbers before subtraction
        await item.save({ session });
      }
    }

    // Update order status
    order.status = 'Cancelled';
    order.actions.push({ action: 'Order Cancelled by Sales', user: req.adminId });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Order cancellation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
      .lean();  // Convert to plain JavaScript object

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Add the orderId to the order object
    order.id = order._id;  // Ensure the id is also included if needed
    order.workflowStatus =order.workflowStatus;
    order.orderId = order.orderId;

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
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const workflow = order.actions.map(action => ({
      action: action.action,
      date: action.date,
      employee: {
        name: action.user.name,
        phone: action.user.phone
      }
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
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Activated' || order.workflowStatus !== 'Casher') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Only activated orders in casher stage can be processed' });
    }

    // Calculate total order price
    const totalOrderPrice = order.items.reduce((total, orderItem) => {
      return total + (orderItem.item.price * orderItem.quantity);
    }, 0);

    // Update order workflow status
    order.workflowStatus = 'MaterialManagement';
    order.status = 'Posted';
    order.actions.push({ action: 'Order Posted', user: req.adminId });
    await order.save({ session });

    // Update cashbox
    let cashbox = await Cashbox.findOne({ employee: req.adminId }).session(session);
    if (!cashbox) {
      cashbox = new Cashbox({ employee: req.adminId });
    }
    cashbox.totalAmount += totalOrderPrice;
    await cashbox.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Order processed and cash updated successfully', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.log('Order processing error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Reject order by casher
router.post('/reject-order-casher/:id', checkPermission('reject_order_casher'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'Casher') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Only orders in casher stage can be rejected' });
    }

    // Update order status
    order.status = 'Pending';
    order.workflowStatus = 'Sales';
    order.actions.push({ action: 'Order Rejected', user: req.adminId });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Order rejected and returned to sales for editing', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Order rejection error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
    const { storageSelections } = req.body; // Expecting an object of storage selections
    console.log(req.body)

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'MaterialManagement') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Order is not in Material Management stage' });
    }

    for (const [itemId, storageId] of Object.entries(storageSelections)) {
      const orderItem = order.items.find(oi => oi.item.toString() === itemId);

      if (!orderItem) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Invalid selection for item: ${itemId}` });
      }

      const item = await Item.findById(itemId).session(session);
      if (!item) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Item not found: ${itemId}` });
      }

      // Update quantities
      item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity);
      item.totalQuantity = Number(item.totalQuantity) - Number(orderItem.quantity);

      const storageQuantity = item.storageQuantities.find(sq => sq.storage.toString() === storageId);
      if (!storageQuantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Storage not found for item: ${itemId}` });
      }

      if (Number(storageQuantity.quantity) < Number(orderItem.quantity)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Not enough quantity in the selected storage for item: ${item.name}` });
      }

      storageQuantity.quantity = Number(storageQuantity.quantity) - Number(orderItem.quantity);
      await item.save({ session });
    }

    // Update order status
    order.workflowStatus = 'Completed';
    order.status = 'Completed';
    order.actions.push({ action: 'Order Delivered', user: req.adminId });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Order processed and quantities updated successfully', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Order processing error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Cancel order by Material Management
router.post('/cancel-order-mm/:id', checkPermission('cancel_order_mm'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { storageSelections } = req.body; // Expecting an object of storage selections

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.workflowStatus !== 'MaterialManagement') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Order is not in Material Management stage' });
    }

    // Calculate the total amount of the order by summing the price * quantity for each item
    let totalAmount = 0;
    for (const orderItem of order.items) {
      const item = await Item.findById(orderItem.item).session(session);
      if (item) {
        const storageId = storageSelections[orderItem.item.toString()];
        if (!storageId) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Storage not selected for item: ${orderItem.item}` });
        }

        const storageQuantity = item.storageQuantities.find(sq => sq.storage.toString() === storageId);
        if (!storageQuantity || storageQuantity.quantity < orderItem.quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Not enough quantity in storage for item: ${item.name}` });
        }

        totalAmount += Number(item.price) * Number(orderItem.quantity);
      } else {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Item not found: ${orderItem.item}` });
      }
    }

    // Refund the money to the user's wallet
    let wallet = await Wallet.findOne({ user: order.customer }).session(session);
    if (!wallet) {
      wallet = new Wallet({ user: order.customer });
    }
    wallet.balance = Number(wallet.balance) + totalAmount; // Use the calculated totalAmount
    await wallet.save({ session });

    // Move items to the trash schema and update item quantities
    for (const orderItem of order.items) {
      const storageId = storageSelections[orderItem.item.toString()];

      const trash = new Trash({
        item: orderItem.item,
        quantity: orderItem.quantity,
        reason: 'Cancelled Order - Bad Item'
      });
      await trash.save({ session });

      const item = await Item.findById(orderItem.item).session(session);
      if (item) {
        item.reservedQuantity = Number(item.reservedQuantity) - Number(orderItem.quantity); // Convert to numbers before subtraction
        item.totalQuantity = Number(item.totalQuantity) - Number(orderItem.quantity); // Convert to numbers before subtraction
        const storageQuantity = item.storageQuantities.find(sq => sq.storage.toString() === storageId);
        if (storageQuantity) {
          storageQuantity.quantity = Number(storageQuantity.quantity) - Number(orderItem.quantity); // Convert to numbers before subtraction
        } else {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: `Storage not found for item: ${orderItem.item}` });
        }
        await item.save({ session });
      }
    }

    // Update order status
    order.status = 'Cancelled';
    order.actions.push({ action: 'Order Cancelled', user: req.adminId });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Order cancelled, refund processed, and items moved to trash', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Order cancellation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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

    // Check item quantities
    for (const orderItem of items) {
      const item = await Item.findById(orderItem.item).session(session);
      if (!item) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Item not found: ${orderItem.item}` });
      }
      const availableQuantity = Number(item.totalQuantity) - Number(item.reservedQuantity);
      if (availableQuantity < Number(orderItem.quantity)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(420).json({ message: `Not enough quantity for item: ${item.name}` });
      }
      item.reservedQuantity = Number(item.reservedQuantity) + Number(orderItem.quantity); // Convert to numbers before addition
      await item.save({ session });
    }

    // Get next order ID
    const orderId = await getNextOrderId(session);

    // Create order
    const order = new Order({
      orderId,
      customer: req.customer._id,
      items,
      workflowStatus: 'MaterialManagement',
      status: 'Posted',
      actions: [{ action: 'Order Created', user: req.customer._id }]
    });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Order creation error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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