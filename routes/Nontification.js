const express = require('express');
const { Admin } = require('../model/Users'); // Adjust the path as needed
const nodemailer = require('nodemailer');
const axios = require('axios');
const Order = require('../model/Order');
const Item = require('../model/Item');
const Storage = require('../model/Storage');
const { Role } = require('../model/Role');
const router = express.Router();
const mongoose = require('mongoose');

// Function to send WhatsApp message
async function sendWhatsApp(phone, message) {
  const ultramsgApiUrl = process.env.ULTRAMSG_API_URL;
  const ultramsgToken = process.env.ULTRAMSG_TOKEN;
  try {
    await axios.post(ultramsgApiUrl, {
      token: ultramsgToken,
      to: `964${phone}`,
      body: message
    });
    console.log(`WhatsApp message sent to ${phone}`);
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${phone}:`, error);
  }
}

// Updated function to send email with HTML support
async function sendEmail(to, subject, text, html) {
  const transporter = nodemailer.createTransport({
    host: 'smtpout.secureserver.net',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  try {
    await transporter.sendMail({
      from: '"Spc" <info@spc-it.com.iq>',
      to,
      subject,
      text,
      html
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

// Optimized function to format admin reminder message for WhatsApp
function formatAdminReminderMessage(orders) {
  const emoji = {
    reminder: '🔔',
    order: '📦',
    customer: '👤',
    phone: '📱',
    items: '🛍️',
    date: '📅',
    link: '🔗'
  };

  let message = `${emoji.reminder} *تذكير هام: طلبات تحتاج للاهتمام اليوم* ${emoji.reminder}\n\n`;
  message += `السلام عليكم ورحمة الله وبركاته،\n\n`;
  message += `نود لفت انتباهكم إلى الطلبات التالية المستحقة التسليم اليوم:\n\n`;
  
  orders.forEach((order, index) => {
    message += `${emoji.order} *الطلب رقم ${index + 1}:*\n`;
    message += `┌─────────────────────\n`;
    message += `│ رقم الطلب: *#${order.orderId}*\n`;
    message += `│ ${emoji.customer} العميل: ${order.customer.name}\n`;
    message += `│ ${emoji.phone} رقم الهاتف: ${order.customer.phone}\n`;
    message += `│ ${emoji.items} إجمالي المواد: ${order.items.length}\n`;
    message += `│ ${emoji.date} تاريخ التسليم: ${new Date(order.remainingDeliveryDate).toLocaleDateString('ar-EG')}\n`;
    message += `│ ${emoji.link} رابط الطلب: https://rida-funds.spc-it.com.iq/OrderDetailsMm/${order._id}\n`;
    message += `└─────────────────────\n\n`;
  });
  
  message += `*ملاحظات هامة:*\n`;
  message += `• يرجى التأكد من معالجة هذه الطلبات وتجهيزها للتسليم في أقرب وقت ممكن.\n`;
  message += `• انقر على الروابط المقدمة للوصول إلى التفاصيل الكاملة للطلبات في النظام.\n\n`;
  message += `شكرًا لاهتمامكم العاجل بهذه الأمور.\n\n`;
  message += `مع أطيب التحيات،\n`;
  message += `فريق إدارة الطلبات 🌟`;
  
  return message;
}

// New function to format admin reminder message as HTML for email
function formatAdminReminderMessageHTML(orders) {
  let html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; direction: rtl; text-align: right;">
        <h2 style="color: #4a4a4a;">🔔 تذكير هام: طلبات تحتاج للاهتمام اليوم 🔔</h2>
        <p>السلام عليكم ورحمة الله وبركاته،</p>
        <p>نود لفت انتباهكم إلى الطلبات التالية المستحقة التسليم اليوم:</p>
  `;

  orders.forEach((order, index) => {
    html += `
      <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3 style="color: #2c3e50; margin-top: 0;">📦 الطلب رقم ${index + 1}</h3>
        <p><strong>رقم الطلب:</strong> #${order.orderId}</p>
        <p>👤 <strong>العميل:</strong> ${order.customer.name}</p>
        <p>📱 <strong>رقم الهاتف:</strong> ${order.customer.phone}</p>
        <p>🛍️ <strong>إجمالي المواد:</strong> ${order.items.length}</p>
        <p>📅 <strong>تاريخ التسليم:</strong> ${new Date(order.remainingDeliveryDate).toLocaleDateString('ar-EG')}</p>
        <p>🔗 <strong>رابط الطلب:</strong> <a href="https://rida-funds.spc-it.com.iq/OrderDetailsMm/${order._id}">اضغط هنا</a></p>
      </div>
    `;
  });

  html += `
        <h3 style="color: #2c3e50;">ملاحظات هامة:</h3>
        <ul>
          <li>يرجى التأكد من معالجة هذه الطلبات وتجهيزها للتسليم في أقرب وقت ممكن.</li>
          <li>انقر على الروابط المقدمة للوصول إلى التفاصيل الكاملة للطلبات في النظام.</li>
        </ul>
        <p>شكرًا لاهتمامكم العاجل بهذه الأمور.</p>
        <p>مع أطيب التحيات،<br>فريق إدارة الطلبات 🌟</p>
      </body>
    </html>
  `;

  return html;
}

async function checkOrdersAndSendReminders() {
  try {
    // Get the current date in UTC
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Find orders with remainingDeliveryDate less than or equal to today and reminders not sent
    const orders = await Order.find({
      remainingDeliveryDate: {
        $lte: today
      },
      reminderSent: false
    }).populate('customer');

    if (orders.length === 0) {
      console.log('No orders found for reminder.');
      return { message: 'No orders requiring reminders found' };
    }

    // Query for admin role
    const activateOrderMmRole = await Role.findOne({ permissions: 'sendOrderReminderDelivery' });

    if (!activateOrderMmRole) {
      console.error('No role with sendOrderReminderDelivery permission found');
      return { error: 'No role with sendOrderReminderDelivery permission found' };
    }

    const adminUsers = await Admin.find({ roles: activateOrderMmRole._id });

    if (adminUsers.length === 0) {
      console.error('No admin users with the required role found');
      return { error: 'No admin users with the required role found' };
    }

    // Send reminders via email and WhatsApp to admin users
    const reminderTextMessage = formatAdminReminderMessage(orders);
    const reminderHTMLMessage = formatAdminReminderMessageHTML(orders);
    for (const admin of adminUsers) {
      await sendEmail(admin.email, 'طلبات تحتاج للاهتمام', reminderTextMessage, reminderHTMLMessage);
      await sendWhatsApp(admin.phone, reminderTextMessage);
    }

    // Mark orders as reminder sent
    for (const order of orders) {
      order.reminderSent = true;
      await order.save();
    }

    return { message: `Reminders sent for ${orders.length} orders to ${adminUsers.length} admin users` };
  } catch (error) {
    console.error('Error in checkOrdersAndSendReminders:', error);
    return { error: 'Failed to send reminders' };
  }
}

router.get('/check-orders-notification', async (req, res) => {
  try {
    const result = await checkOrdersAndSendReminders();
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    res.status(200).json({ message: result.message });
  } catch (error) {
    console.error('خطأ في التحقق من الطلبات وإرسال التذكيرات:', error);
    res.status(500).json({ error: 'فشل في التحقق من الطلبات وإرسال التذكيرات' });
  }
});



async function checkItemsAndSendReminders(dbConnection) {
  console.log('Starting checkItemsAndSendReminders function');
  
  try {
    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB connection is not ready. Current state:', mongoose.connection.readyState);
      if (!dbConnection) {
        throw new Error('No database connection provided');
      }
      mongoose.connection = dbConnection.connection;
    }

    console.log('Fetching items from database');
    const items = await Item.find().lean();
    console.log(`Found ${items.length} items`);

    const itemsWithZeroQty = [];

    for (const item of items) {
      // Check if totalQuantity is 0 or if all storageQuantities are 0
      if (item.totalQuantity === 0 || 
          (item.storageQuantities && item.storageQuantities.every(sq => sq.quantity === 0))) {
        itemsWithZeroQty.push(item);
      }
    }

    console.log(`Found ${itemsWithZeroQty.length} items with zero quantity`);

    if (itemsWithZeroQty.length === 0) {
      console.log('No items with zero quantity found.');
      return { message: 'No items with zero quantity found' };
    }

    console.log('Querying for admin role');
    const activateOrderMmRole = await Role.findOne({ permissions: 'sendReminderZeroitemqty' });

    if (!activateOrderMmRole) {
      console.error('No role with sendReminderZeroitemqty permission found');
      return { error: 'No role with sendReminderZeroitemqty permission found' };
    }

    console.log('Fetching admin users');
    const adminUsers = await Admin.find({ roles: activateOrderMmRole._id });

    if (adminUsers.length === 0) {
      console.error('No admin users with the required role found');
      return { error: 'No admin users with the required role found' };
    }

    console.log(`Found ${adminUsers.length} admin users to notify`);

    // Send alerts via email and WhatsApp to admin users
    const alertTextMessage = formatItemsAlertMessage(itemsWithZeroQty);
    const alertHTMLMessage = formatItemsAlertMessageHTML(itemsWithZeroQty);
    for (const admin of adminUsers) {
      await sendEmail(admin.email, 'تنبيه: مواد بكمية صفرية', alertTextMessage, alertHTMLMessage);
      await sendWhatsApp(admin.phone, alertTextMessage);
    }

    console.log('Alerts sent successfully');
    return { message: `Alerts sent for ${itemsWithZeroQty.length} items with zero quantity to ${adminUsers.length} admin users` };
  } catch (error) {
    console.error('Error in checkItemsAndSendReminders:', error);
    return { error: 'Failed to send item alerts', details: error.message };
  }
}

function formatItemsAlertMessage(items) {
  let message = `🚨 *تنبيه هام: مواد بكمية صفرية* 🚨\n\n`;
  message += `السلام عليكم ورحمة الله وبركاته،\n\n`;
  message += `نود إعلامكم بوجود المواد التالية بكمية صفرية في جميع المخازن:\n\n`;

  items.forEach((item, index) => {
    message += `📦 *المادة ${index + 1}:*\n`;
    message += `┌─────────────────────\n`;
    message += `│ اسم المادة: *${item.name}*\n`;
    message += `│ رمز المنتج: ${item.productId}\n`;
    message += `│ الكمية الإجمالية: ${item.totalQuantity}\n`;
    message += `└─────────────────────\n\n`;
  });

  message += `يرجى اتخاذ الإجراءات اللازمة لتجديد مخزون هذه المواد في أقرب وقت ممكن.\n\n`;
  message += `شكرًا لاهتمامكم العاجل بهذه المسألة.\n\n`;
  message += `مع أطيب التحيات،\n`;
  message += `فريق إدارة المخزون 🏭`;

  return message;
}

function formatItemsAlertMessageHTML(items) {
  let html = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; direction: rtl; text-align: right;">
        <h2 style="color: #4a4a4a;">🚨 تنبيه هام: مواد بكمية صفرية 🚨</h2>
        <p>السلام عليكم ورحمة الله وبركاته،</p>
        <p>نود إعلامكم بوجود المواد التالية بكمية صفرية في جميع المخازن:</p>
  `;

  items.forEach((item, index) => {
    html += `
      <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
        <h3 style="color: #2c3e50; margin-top: 0;">📦 المادة ${index + 1}</h3>
        <p><strong>اسم المادة:</strong> ${item.name}</p>
        <p><strong>رمز المنتج:</strong> ${item.productId}</p>
        <p><strong>الكمية الإجمالية:</strong> ${item.totalQuantity}</p>
      </div>
    `;
  });

  html += `
        <p>يرجى اتخاذ الإجراءات اللازمة لتجديد مخزون هذه المواد في أقرب وقت ممكن.</p>
        <p>شكرًا لاهتمامكم العاجل بهذه المسألة.</p>
        <p>مع أطيب التحيات،<br>فريق إدارة المخزون 🏭</p>
      </body>
    </html>
  `;

  return html;
}

module.exports = { router, checkOrdersAndSendReminders, checkItemsAndSendReminders };