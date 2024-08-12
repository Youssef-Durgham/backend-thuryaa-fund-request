const axios = require('axios');
const express = require('express');
const Transaction = require('../model/Transactions');
const { Customer } = require('../model/Users'); // Adjust the path as needed
const jwt = require('jsonwebtoken');
const Cart = require('../model/Cart');
const Item = require('../model/Item');
const Order = require('../model/Order');
const Counter = require('../model/Counter');
const mongoose = require('mongoose');

const router = express.Router();

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization').replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, 'your_jwt_secret');
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

router.post('/create-transaction', authMiddleware, async (req, res) => {
    const { amount, currency, orderId } = req.body;
    const callbackUrlScheme = 'mustaqbalalemar';

    const data = {
        "order": {
            "amount": amount,
            "currency": currency,
            "orderId": orderId
        },
        "timestamp": new Date().toISOString(),
        "successUrl": `${callbackUrlScheme}://payment-success?orderId=${orderId}`,
        "failureUrl": `${callbackUrlScheme}://payment-failure?orderId=${orderId}`,
        "cancelUrl": `${callbackUrlScheme}://payment-cancel?orderId=${orderId}`
    };

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.uat.pay.qi.iq/api/v0/transactions/business/token',
        headers: { 
            'Authorization': '39cd434c94fa49e99646b58f31bbdb88',
            'Content-Type': 'application/json'
        },
        data: data
    };

    try {
        // Fetch the customer's cart
        const cart = await Cart.findOne({ customer: req.customer._id }).populate('items.productId');
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }
        // Check each item's quantity in the cart against available quantity
        const itemsToRemove = [];
        for (const item of cart.items) {
            // Fetch the item details directly from the Item schema
            const product = await Item.findById(item.productId._id);
            if (!product) {
                itemsToRemove.push({
                    productId: item.productId._id.toString(),
                    name: item.productId.name,
                    price: item.productId.price,
                    quantity: 0,
                    reservedQuantity: 0
                });
                continue;
            }

            const availableQuantity = product.totalQuantity - product.reservedQuantity;
            if (item.quantity > availableQuantity || availableQuantity === 0) {
                itemsToRemove.push({
                    productId: product._id.toString(),
                    name: product.name,
                    price: product.price,
                    quantity: product.totalQuantity,
                    reservedQuantity: product.reservedQuantity
                });
            }
        }

        // If there are items with insufficient quantity, remove them from the cart and return an error
        if (itemsToRemove.length > 0) {
            cart.items = cart.items.filter(item => !itemsToRemove.find(i => i.productId === item.productId._id.toString()));
            await cart.save();
            return res.status(220).json({ message: 'Some items have insufficient quantity', items: itemsToRemove });
        }

        // Clone the cart items
        const clonedCartItems = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price
        }));

        // Generate the transaction
        const response = await axios(config);

        // Save the transaction details to the database, including the cloned cart items
        const transaction = new Transaction({
            orderId,
            customerId: req.customer._id,
            amount,
            currency,
            transactionId: response.data.data.transactionId,
            token: response.data.data.token,
            link: response.data.data.link,
            clonedCartItems
        });

        await transaction.save();
        
        res.json(response.data);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});





const getNextOrderId = async (session) => {
    const counter = await Counter.findOneAndUpdate(
      { name: 'orderId' },
      { $inc: { value: 1 } },
      { new: true, upsert: true, session }
    );
    return counter.value;
  };

const sendWhatsAppMessage = async (phone, message) => {
    try {
      const response = await axios.post('https://api.ultramsg.com/instance87136/messages/chat', {
        token: '2i9r14uumbiddwpb',
        to:`${phone}`,
        body: message
      });
      console.log(response.data.error)
      if (response.data.error) {
        throw new Error('WhatsApp sending failed');
      }
      
      console.log('WhatsApp message sent successfully');
    } catch (error) {
      console.error('Error sending WhatsApp message:', error.message);
      throw error;
    }
  };
  
  const generateOrderInvoiceMessage = (order) => {
    console.log(order)
    let message = `Order Invoice\n\nOrder ID: ${order.orderId}\n\nItems:\n`;
  
    order.items.forEach(item => {
      message += `- ${item.name}: ${item.quantity}\n`;
    });
  
    message += `\nTotal Items: ${order.items.length}\nStatus: ${order.status}\n\nThank you for your order!`;
  
    return message;
  };
  

// Get Transaction Details API
router.get('/transaction/:orderId', authMiddleware, async (req, res) => {
    const { orderId } = req.params;

    try {
        const transaction = await Transaction.findOne({ orderId }).populate('clonedCartItems.productId');

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        // Check if the transaction is already done
        if (transaction.status === 'done') {
            return res.status(400).json({ message: 'Order has already been created for this transaction.' });
        }

        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.uat.pay.qi.iq/api/v0/transactions/business/${transaction.transactionId}/${transaction.orderId}`,
            headers: { 
                'Authorization': '39cd434c94fa49e99646b58f31bbdb88',
                'Content-Type': 'application/json'
            },
        };

        const response = await axios(config);

        const { QIGatewayResponse } = response.data.data;

        if (QIGatewayResponse === "SUCCESS") {
            // Start a session for transaction
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                transaction.status = 'done';
                await transaction.save({ session });

                const items = transaction.clonedCartItems;

                // Check item quantities
                for (const orderItem of items) {
                    const item = await Item.findById(orderItem.productId).session(session);
                    if (!item) {
                        await session.abortTransaction();
                        session.endSession();
                        return res.status(404).json({ message: `Item not found: ${orderItem.productId}` });
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
                const newOrderId = await getNextOrderId(session);

                // Create order
                const order = new Order({
                    orderId: newOrderId,
                    customer: req.customer._id,
                    items: items.map(orderItem => ({
                        item: orderItem.productId,
                        quantity: orderItem.quantity
                    })),
                    workflowStatus: 'MaterialManagement',
                    status: 'Posted',
                    actions: [{ action: 'Order Created', user: req.customer._id, userType: 'Customer' }]
                });

                await order.save({ session });

                // Empty the cart after saving the transaction and creating the order
                const cart = await Cart.findOne({ customer: req.customer._id }).session(session);
                if (cart) {
                    cart.items = [];
                    await cart.save({ session });
                }

                // Fetch customer details to get the phone number
                const customer = await Customer.findById(req.customer._id);

                // Generate the order invoice message
                const message = generateOrderInvoiceMessage(order);

                // Send WhatsApp message
                await sendWhatsAppMessage(customer.phone, message);

                await session.commitTransaction();
                session.endSession();

                res.json(response.data);
            } catch (error) {
                await session.abortTransaction();
                session.endSession();

                console.log('Order creation error:', error.message);
                return res.status(500).json({ message: 'Internal server error', error: error.message });
            }
        } else {
            res.json(response.data);
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
