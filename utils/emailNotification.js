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

const generateEmailTemplate = ({ recipientName, subject, message, actionUrl, actionText }) => {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" dir="rtl" lang="ar">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject}</title>
  <style type="text/css">
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
    /* Reset styles */
    body, table, td, div, p, a, span { 
      margin: 0; 
      padding: 0; 
      border: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    
    /* Base styles */
    body {
      width: 100% !important;
      min-width: 100%;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    
    /* Container styles */
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    
    /* Dark mode styles */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1a1a1a !important;
      }
      .container {
        background-color: #2d2d2d !important;
      }
      .content {
        background-color: #2d2d2d !important;
        color: #ffffff !important;
      }
      .header {
        background-color: #003366 !important;
      }
      .footer {
        background-color: #222222 !important;
        color: #ffffff !important;
      }
      h1, h2, h3, p {
        color: #ffffff !important;
      }
    }
    
    /* Header styles */
    .header {
      padding: 30px 20px;
      text-align: center;
      background: linear-gradient(135deg, #004d99 0%, #0073e6 100%);
      border-radius: 8px 8px 0 0;
    }
    
    /* Content styles */
    .content {
      padding: 40px 20px;
      background-color: #ffffff;
      border-radius: 0 0 8px 8px;
    }
    
    /* Button styles */
    .button {
      display: inline-block;
      padding: 14px 35px;
      background: linear-gradient(135deg, #004d99 0%, #0073e6 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 50px;
      font-weight: bold;
      margin: 20px 0;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .content {
        padding: 20px !important;
      }
      .header {
        padding: 20px 10px !important;
      }
      .button {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
    
    /* Typography */
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #004d99;
    }
    
    p {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 15px;
      color: #333333;
    }
    
    /* Section divider */
    .divider {
      height: 1px;
      background: linear-gradient(to right, rgba(0,77,153,0), rgba(0,77,153,0.5), rgba(0,77,153,0));
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" width="600">
          <!-- Header -->
          <tr>
            <td class="header">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">✨ شركة الثريا ✨</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0;"></p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding: 20px 0; text-align: right;">
                    <h2 style="margin: 0; color: #004d99;">👋 عزيزي ${recipientName}،</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 0; text-align: right;">
                    ${message}
                  </td>
                </tr>
                ${actionUrl ? `
                <tr>
                  <td style="padding: 20px 0; text-align: center;">
                    <a href="${actionUrl}" class="button">
                      ${actionText || 'عرض التفاصيل'} 📋
                    </a>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td class="divider"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f6f6f6; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #666666;">🏢 شركة الثريا </p>
              <p style="margin: 10px 0; color: #666666;">📍 Baghdad, Iraq</p>
              <p style="margin: 20px 0 0 0;">

              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const sendEmailNotification = async ({ to, subject, body, recipientName, actionUrl, attachments }) => {
  console.log(`[Email] Preparing to send email to: ${to}, Subject: "${subject}"`);
  
  try {
    const mailOptions = {
      from: '"شركة الثريا" <info@spc-it.com.iq>', // Sender address
      to,
      subject,
      text: body, // Plain text version
      html: generateEmailTemplate({
        recipientName,
        subject,
        message: body,
        actionUrl,
        actionText: 'عرض التفاصيل'
      }),
      attachments: attachments || []
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`[Email] Failed to send email to ${to}:`, error.message);
    throw new Error('Failed to send email notification.');
  }
};

module.exports = sendEmailNotification;