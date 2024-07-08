const axios = require('axios');


const sendOtpViaWhatsApp = async (phone, otp) => {
  // Implement WhatsApp sending logic using UltraMsg
  const response = await axios.post('https://api.ultramsg.com/instance87136/messages/chat', {
    token: '2i9r14uumbiddwpb',
    to: phone,
    body: `Your OTP is: ${otp}`
  });
  if (response.data.error) {
    throw new Error('WhatsApp sending failed');
  }
};

const sendOtpViaSms = async (phone, otp) => {
  try {
    // Encode the client_id and client_secret to Base64
    const authHeader = `Basic ${Buffer.from(`180:EpCYEZU49qregUsR1UqSW2ckG2PCRfZuhQA1kmbc`).toString('base64')}`;

    // Prepare the request headers
    const headers = {
      Authorization: authHeader,
      Accept: 'application/json',
    };

    // Prepare the request body
    const body = {
      phone_num: phone,
      content: `Your OTP is: ${otp}`,
    };

    // Make the API request
    const response = await axios.post('https://ur.gov.iq/api/client/mobile_message/send/basic', body, { headers });

    // Handle the response
    if (response.status === 200) {
      console.log('SMS sent successfully');
    } else if (response.status === 401) {
      console.log('Access token expired. Please refresh the token.');
      throw new Error('SMS sending failed');
    } else if (response.status === 500) {
      console.log('Server error. Please try again later.');
      throw new Error('SMS sending failed');
    }
  } catch (error) {
    console.log(error)
    sendOtpViaWhatsApp(phone, otp)
  }
};



module.exports = {
  sendOtpViaSms,
  sendOtpViaWhatsApp
};
