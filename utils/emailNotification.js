const nodemailer = require('nodemailer');

// Configure the email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.example.com', // Replace with your SMTP host
  port: 587, // Replace with your SMTP port
  secure: false, // Use true for 465 (SSL), false for other ports
  auth: {
    user: 'your-email@example.com', // Replace with your SMTP username
    pass: 'your-email-password', // Replace with your SMTP password
  },
});


const sendEmailNotification = async ({ to, subject, body }) => {
  try {
    const mailOptions = {
      from: '"Your App Name" <your-email@example.com>', // Replace with your app's email
      to,
      subject,
      text: body,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email notification.');
  }
};

module.exports = sendEmailNotification;
