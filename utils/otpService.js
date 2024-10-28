const axios = require('axios');

const sendOtpViaWhatsApp = async (phone, otp) => {
  try {
    const response = await axios.post('https://api.ultramsg.com/instance87136/messages/chat', {
      token: '2i9r14uumbiddwpb',
      to: phone,
      body: `Your OTP is: ${otp}`
    });
    
    if (response.data.error) {
      throw new Error('WhatsApp sending failed');
    }
    
    console.log('WhatsApp OTP sent successfully');
  } catch (error) {
    console.error('Error sending WhatsApp OTP:', error.message);
    throw error;
  }
};

const sendOtpViaSms = async (phone, otp) => {
  try {
    const authHeader = `Basic ${Buffer.from('180:EpCYEZU49qregUsR1UqSW2ckG2PCRfZuhQA1kmbc').toString('base64')}`;
    
    const headers = {
      Authorization: authHeader,
      Accept: 'application/json',
    };
    
    const body = {
      phone_num: phone,
      content: `Your OTP is: ${otp}`,
    };
    
    const response = await axios.post('https://ur.gov.iq/api/client/mobile_message/send/basic', body, { headers });
    
    if (response.status === 200) {
      console.log('SMS sent successfully');
      return 'sms';
    } else {
      throw new Error(`SMS sending failed: Unexpected status ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending SMS:', error.message);
    console.log('Attempting to send OTP via WhatsApp...');
    try {
      await sendOtpViaWhatsApp(phone, otp);
      console.log('OTP sent successfully via WhatsApp after SMS failure');
      return 'whatsapp';
    } catch (whatsappError) {
      console.error('Failed to send OTP via both SMS and WhatsApp');
      throw whatsappError;
    }
  }
};


module.exports = {
  sendOtpViaSms,
  sendOtpViaWhatsApp
};