const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail, VerificationEmail, sendResetNotificationEmail, sendLoginNotificationEmail } = require('../emailUtility.js');
const crypto = require('crypto');
const UserSignIn = require("../model/usersignin.js");


// api for Registration
router.post('/register-user', async (req, res) => {
    const { username, email, password } = req.body;
  
    try {
      // Check if the email is already in use and the account is not verified
      const existingUser = await User.findOne({ email: email });
      if (existingUser && existingUser.isVerified) {
        return res.status(409).send({ error: 'Email already in use.' });
      }
  
      // Generate a new verification token
      const token = crypto.randomBytes(32).toString('hex');
  
      // Update existing user or create new one if not found
      const userData = {
        username,
        email,
        password: password,
        verificationCode: token,
        verificationCodeExpires: new Date(Date.now() + 3600000), // 1 hour from now
        isVerified: false
      };
  
      if (existingUser) {
        await User.updateOne({ email: email }, userData);
      } else {
        const user = new User(userData);
        await user.save();
      }
  
      // Send a verification email to the user
      await VerificationEmail(userData, token);
  
      res.status(201).send({ user: { username, email }, message: 'Verification email sent. Please check your email.' });
    } catch (error) {
      console.log('Registration Error:', error);
      res.status(500).send({ error: 'Internal server error. Please try again later.' });
    }
  });
  

  //api for verify acc
  router.post('/verify', async (req, res) => {
    try {
      const { verificationCode } = req.body;  // Retrieve the verification code from the request body
  
      // Validate the presence of the verification code in the request
      if (!verificationCode) {
        return res.status(400).send({ error: 'Verification code must be provided.' });
      }
  
      // Find the user by the verification code
      const user = await User.findOne({
        verificationCode: verificationCode,
        verificationCodeExpires: { $gte: Date.now() } // Ensures the code hasn't expired
      });
  
      if (!user) {
        return res.status(404).send({ error: 'Invalid or expired verification code.' });
      }
  
      // Update the user's email verification status
      user.isEmailVerified = true;
      user.verificationCode = undefined;  // Clear the verification code
      user.verificationCodeExpires = undefined;  // Clear the expiration date
      await user.save();
  
      // Send a welcome email after successful verification
      await sendWelcomeEmail(user);
  
      res.send({ message: 'Email successfully verified.' });
    } catch (error) {
      console.error('Error during email verification:', error);  // Log the error for debugging purposes
      res.status(500). send({ error: 'Internal server error during verification.' });
    }
  });
  
  
  // api for resend verify
  router.post('/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
  
      if (!user) {
        return res.status(404).send({ error: 'User not found.' });
      }
  
      if (user.isEmailVerified) {
        return res.status(400).send({ error: 'Email is already verified.' });
      }
  
      const token = crypto.randomBytes(32).toString('hex');
      user.verificationCode = token;
      user.verificationCodeExpires = Date.now() + 3600000; // 1 hour from now
  
      await user.save();
  
      await VerificationEmail(user, verificationCode);
  
      res.send({ message: 'Verification email resent. Please check your email.' });
    } catch (error) {
      res.status(500).send({ error: 'Error resending the verification email.' });
    }
  });
  

  // api for reset password request
  router.post('/requestReset', async (req, res) => {
    try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send('User not found');
    }
  
    const token = crypto.randomBytes(32).toString('hex');
    user.verificationCode = token;
    user.verificationCodeExpires = Date.now() + 3600000; // 1 hour from now
    await user.save();
  
    const resetLink = `https://zctk1nynq3.execute-api.me-south-1.amazonaws.com/dev/verifyreset/${token}`;
  
    await sendResetNotificationEmail(user, token);
  
    res.send({ message: 'reset email sent. Please check your email.' });
  } catch (error) {
    res.status(500).send({ error: 'Error resending the verification email.' });
  }
  
  });
  
  // api for reset password
  router.post('/resetPassword/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    const user = await User.findOne({
      verificationCode: token,
      verificationCodeExpires: { $gt: Date.now() }
    });
  
    if (!user) {
      return res.status(400).send('Password reset token is invalid or has expired');
    }
  
    user.password = password;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
  
    res.send('Your password has been successfully reset');
  });
  
  
  // api for login
  router.post('/login', async (req, res) => {
    const { email, password, userAgent } = req.body;
    const ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.connection.remoteAddress;
  
    try {
      // Attempt to find a verified user
      const user = await User.findOne({ email: email, isEmailVerified: true });
  
      // If no user found, treat as incorrect login attempt
      if (!user) {
        return res.status(401).send({ error: 'Incorrect email or password.' });
      }
  
      // Check password validity
      const passwordIsValid = await bcrypt.compare(password, user.password);
      console.log(passwordIsValid, password, user.password)
      if (!passwordIsValid) {
        logLoginAttempt(user._id, ip, userAgent);  // Log failed attempt
        await sendLoginNotificationEmail(user, ip, userAgent);
        return res.status(401).send({ error: 'Incorrect email or password.' });
      }
  
      // Generate JWT token
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '365d'
      });
  
      // Update last login
      user.lastLogin = new Date();
      await user.save();
  
      // Log successful attempt and send notification
      logLoginAttempt(user._id, ip, userAgent);
      await sendLoginNotificationEmail(user, ip, userAgent);
  
      // Send response
      res.send({
        user: { id: user._id, email: user.email, lastLogin: user.lastLogin },
        token,
        message: 'Login successful. Notification sent.'
      });
    } catch (error) {
      console.log('Login error:', error);
      res.status(400).send({ error: 'An error occurred while trying to log in.' });
    }
  });
  
  // func to send email for login attemp
  async function logLoginAttempt(userId, ip, userAgent) {
    const newLoginAttempt = new UserSignIn({
      userId: userId,  // It could be null if user not found
      ip: ip,
      userAgent: userAgent,
    });
  
    try {
      await newLoginAttempt.save();
    } catch (error) {
      console.error('Error saving login attempt:', error);
    }
  }


module.exports = router;