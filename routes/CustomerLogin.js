const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOtpViaSms, sendOtpViaWhatsApp } = require('../utils/otpService'); // Implement these utility functions
const { Customer } = require('../model/Users');
const LoginHistory = require('../model/LoginHistory');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();

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
  try {
    let customer = await Customer.findOne({ phone });
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
      customer = new Customer({ phone, name, password, location, otp, otpExpiresAt: Date.now() + otpExpiryTime });
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
  const { phone, otp } = req.body;
  try {
    const customer = await Customer.findOne({ phone });
    if (!customer || customer.otp !== otp || customer.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    customer.isActivated = true;
    customer.otp = undefined;
    customer.otpExpiresAt = undefined;
    await customer.save();
    res.status(200).json({ message: 'Customer activated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Login customer
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const customer = await Customer.findOne({ phone });
    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      return res.status(400).json({ message: 'Invalid phone or password' });
    }
    if (!customer.isActivated) {
      return res.status(403).json({ message: 'Account not activated. Please verify OTP.' });
    }
    const token = jwt.sign({ id: customer._id, userType: 'customer' }, 'your_jwt_secret', { expiresIn: '1h' });

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
  try {
    const customer = await Customer.findOne({ phone });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const otp = generateOtp();
    customer.otp = otp;
    customer.otpExpiresAt = Date.now() + otpExpiryTime;
    await customer.save();
    // try {
    //   await sendOtpViaSms(phone, otp);
    // } catch (smsError) {
      await sendOtpViaWhatsApp(phone, otp);
    // }
    res.status(200).json({ message: 'OTP sent for password reset' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Verify OTP for password reset and set new password
router.post('/verify-otp-reset-password', async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  try {
    const customer = await Customer.findOne({ phone });
    if (!customer || customer.otp !== otp || customer.otpExpiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    customer.password = await bcrypt.hash(newPassword, 10);
    customer.otp = undefined;
    customer.otpExpiresAt = undefined;
    await customer.save();
    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
