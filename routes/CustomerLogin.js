const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOtpViaSms, sendOtpViaWhatsApp } = require('../utils/otpService'); // Implement these utility functions
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');
const { Customer } = require('../model/Users');

const router = express.Router();

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret'); // Replace 'your_jwt_secret' with your actual secret
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

const otpExpiryTime = 10 * 60 * 1000; // 10 minutes

// Function to handle OTP sending logic
const sendOtp = async (phone, otp) => {
  if (phone.startsWith('964770')) {
    await sendOtpViaWhatsApp(phone, otp);
  } else if (phone.startsWith('9640770')) {
    const modifiedPhone = '964' + phone.slice(4);
    await sendOtpViaWhatsApp(modifiedPhone, otp);
  } else if (phone.startsWith('96478')) {
    await sendOtpViaSms(phone, otp);
  } else if (phone.startsWith('964078')) {
    const modifiedPhone = '964' + phone.slice(4);
    await sendOtpViaSms(modifiedPhone, otp);
  } else {
    throw new Error('Invalid phone number format');
  }
};

// Register customer and send OTP
router.post('/register', async (req, res) => {
  const { phone, name, password, location } = req.body;
  console.log(req.body);
  let formattedPhone = phone;
  if (formattedPhone.startsWith('9640')) {
    formattedPhone = '964' + formattedPhone.slice(4);
  }
  console.log(formattedPhone)
  try {
    let customer = await Customer.findOne({ phone: formattedPhone });
    console.log(customer)
    const otp = generateOtp();

    if (customer) {
      if (!customer.isActivated) {
        // Update customer data
        customer.name = name;
        customer.password = password;
        customer.location = location;
        customer.otp = otp;
        customer.otpExpiresAt = Date.now() + otpExpiryTime;
        await customer.save();
        
        await sendOtp(phone, otp);

        return res.status(200).json({ message: 'Customer data updated, OTP sent' });
      } else {
        return res.status(400).json({ message: 'Customer already exists' });
      }
    } else {
      // If customer does not exist, create a new one
      // Ensure phone number format is correct
      
      customer = new Customer({
        phone: formattedPhone,
        name,
        password,
        location,
        otp,
        otpExpiresAt: Date.now() + otpExpiryTime
      });
      await customer.save();
      
      await sendOtp(phone, otp);

      res.status(201).json({ message: 'Customer registered successfully, OTP sent' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Verify OTP for activation
router.post('/verify-otp', async (req, res) => {
  let { phone, otp } = req.body;

  let formatedphone = phone;
  if (phone.startsWith('9640')) {
    formatedphone = phone.replace(/^9640/, '964');
  }

  try {
    const customer = await Customer.findOne({ phone: formatedphone });
    console.log(customer, req.body);
    if (!customer || customer.otp !== otp || customer.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    customer.isActivated = true;
    customer.otp = undefined;
    customer.otpExpiresAt = undefined;
    await customer.save();
    const token = jwt.sign({ id: customer._id, userType: 'customer' }, 'your_jwt_secret', { expiresIn: '365d' });
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  let { phone, password } = req.body;
  
  // Add the 964 prefix and handle specific prefixes
  if (phone.startsWith('0770')) {
    phone = `96477${phone.slice(3)}`;
  } else if (phone.startsWith('0780')) {
    phone = `96478${phone.slice(3)}`;
  } else if (!phone.startsWith('964')) {
    phone = `964${phone}`;
  }

  try {
    const customer = await Customer.findOne({ phone });
    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      return res.status(400).json({ message: 'Invalid phone or password' });
    }
    if (!customer.isActivated) {
      return res.status(400).json({ message: 'Account not activated. Please verify OTP.' });
    }
    const token = jwt.sign({ id: customer._id, userType: 'customer' }, 'your_jwt_secret', { expiresIn: '365d' });

    // Log the login
    const loginHistory = new LoginHistory({
      userId: customer._id,
      ipAddress: req.ip
    });
    await loginHistory.save();

    // Log the activity
    const activityLog = new ActivityLog({
      action: 'login',
      performedBy: customer._id,
      targetUser: customer._id,
      userType: 'Customer'
    });
    await activityLog.save();

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Reset password and send OTP
router.post('/reset-password', async (req, res) => {
  const { phone } = req.body;
  let customer;

  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, 'your_jwt_secret'); // Replace 'your_jwt_secret' with your actual secret
      customer = await Customer.findById(decoded.id);
    }

    if (!customer && phone) {
      customer = await Customer.findOne({ phone });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const otp = generateOtp();
    customer.otp = otp;
    customer.otpExpiresAt = Date.now() + otpExpiryTime;
    await customer.save();

        await sendOtp(customer.phone, otp);

    res.status(200).json({ message: 'OTP sent for password reset' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Verify OTP for password reset and set new password
router.post('/verify-otp-reset-password', async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  let customer;

  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, 'your_jwt_secret'); // Replace 'your_jwt_secret' with your actual secret
      customer = await Customer.findById(decoded.id);
    }

    if (!customer && phone) {
      customer = await Customer.findOne({ phone });
    }

    if (!customer || customer.otp !== otp || customer.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    customer.password = newPassword;
    customer.otp = undefined;
    customer.otpExpiresAt = undefined;
    await customer.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// delete user account
router.post('/deactivate', verifyToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const customer = await Customer.findByIdAndUpdate(customerId, { isActivated: false }, { new: true });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    res.json({ message: 'Customer deactivated successfully.', customer });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error });
  }
});

// Get customer information
router.get('/customer/info', verifyToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const customer = await Customer.findById(customerId).select('name phone');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error });
  }
});

// Update customer name
router.put('/customer/updateName', verifyToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const { name } = req.body;
    const customer = await Customer.findByIdAndUpdate(customerId, { name }, { new: true });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }
    res.json({ message: 'Customer name updated successfully.', customer });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error });
  }
});

module.exports = router;
