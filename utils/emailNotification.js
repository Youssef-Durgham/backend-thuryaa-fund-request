const nodemailer = require('nodemailer');

// Configure the email transporter
const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: {
    user: "info@spc-it.com.iq",
    pass: "AltShiftDel123"
  }
});


const sendEmailNotification = async ({ to, subject, body }) => {
  console.log(to, subject, body)
  try {
    const mailOptions = {
      from: '"Spc" <info@spc-it.com.iq>',
      to,
      subject,
      text: body,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.log(`Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email notification.');
  }
};

module.exports = sendEmailNotification;
