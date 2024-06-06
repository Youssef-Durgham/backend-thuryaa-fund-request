const axios = require('axios');

const sendOtpViaSms = async (phone, otp) => {
  // Implement SMS sending logic using your preferred SMS provider
  // Example using UltraMsg:
  const response = await axios.post('https://api.ultramsg.com/instanceXXXX/messages/chat', {
    token: 'your_ultramsg_token',
    to: phone,
    body: `Your OTP is: ${otp}`
  });
  if (response.data.error) {
    throw new Error('SMS sending failed');
  }
};

const sendOtpViaWhatsApp = async (phone, otp) => {
  // Implement WhatsApp sending logic using UltraMsg
  const response = await axios.post('https://api.ultramsg.com/instanceXXXX/messages/chat', {
    token: 'your_ultramsg_token',
    to: phone,
    body: `Your OTP is: ${otp}`
  });
  if (response.data.error) {
    throw new Error('WhatsApp sending failed');
  }
};

module.exports = {
  sendOtpViaSms,
  sendOtpViaWhatsApp
};
