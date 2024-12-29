const nodemailer = require('nodemailer');

// Configure the email transporter
const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: "info@spc-it.com.iq",
    pass: "AltShiftDel123" // Ensure this password is correct and has necessary permissions
  }
});

// Verify transporter configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error configuring email transporter:', error);
  } else {
    console.log('Email transporter is configured and ready to send emails.');
  }
});

const sendEmailNotification = async ({ to, subject, body }) => {
  console.log(`[Email] Preparing to send email to: ${to}, Subject: "${subject}"`);
  try {
    const mailOptions = {
      from: '"Spc" <info@spc-it.com.iq>',
      to,
      subject,
      text: body,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log(`[Email] Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`[Email] Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email notification.');
  }
};

module.exports = sendEmailNotification;
