const express = require('express');
const jwt = require('jsonwebtoken');
const Cart = require('../model/Cart');
const { Customer } = require('../model/Users');

const router = express.Router();

// JWT Authentication Middleware
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization').replace('Bearer ', '');
console.log(token)
  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    console.log(decoded)
    const customer = await Customer.findById(decoded.id);
    console.log(customer)
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

// Add items to cart
router.post('/cart/add', authMiddleware, async (req, res) => {
    const { items } = req.body;
    const customerId = req.customer._id;
  
    try {
      let cart = await Cart.findOne({ customer: customerId });
  
      if (!cart) {
        cart = new Cart({ customer: customerId, items });
      } else {
        items.forEach(item => {
          const index = cart.items.findIndex(cartItem => cartItem.productId.toString() === item.productId);
  
          if (index >= 0) {
            cart.items[index].quantity += item.quantity;
          } else {
            cart.items.push(item);
          }
        });
      }
  
      cart.updatedAt = Date.now();
      await cart.save();
  
      res.status(200).json(cart);
    } catch (error) {
      res.status(500).json({ message: 'Failed to add items to cart', error });
    }
  });  

// Update cart in bulk
router.put('/cart/update', authMiddleware, async (req, res) => {
  const { items } = req.body;
  const customerId = req.customer._id;

  try {
    const cart = await Cart.findOne({ customer: customerId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.items = items;
    cart.updatedAt = Date.now();
    await cart.save();

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update cart', error });
  }
});

// Get all cart items for a customer
router.get('/cart', authMiddleware, async (req, res) => {
    const customerId = req.customer._id;
  
    try {
      const cart = await Cart.findOne({ customer: customerId }).populate('items.productId');
  
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found' });
      }
  
      res.status(200).json(cart);
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Failed to get cart items', error });
    }
  });

  // delete cart for user
router.delete('/cart/clear', authMiddleware, async (req, res) => {
    try {
      const customerId = req.customer._id;
  
      const cart = await Cart.findOneAndUpdate(
        { customer: customerId },
        { items: [] },
        { new: true }
      );
  
      if (!cart) {
        return res.status(404).json({ message: 'Cart not found.' });
      }
  
      res.status(200).json({ message: 'Cart cleared successfully.', cart });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error.', error });
    }
  });
  

module.exports = router;
