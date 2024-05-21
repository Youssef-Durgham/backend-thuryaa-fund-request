//  Dependencies
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const request = require('request');
const Order = require('../model/order');
const router = require("express").Router();
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

//  If the environment if it was on production or on testing mode
let initUrl = 'https://test.zaincash.iq/transaction/init';
let requestUrl = 'https://test.zaincash.iq/transaction/pay?id=';

// if (process.env.PRODUCTION === "true") {
//   initUrl = 'https://api.zaincash.iq/transaction/init';
//   requestUrl = 'https://api.zaincash.iq/transaction/pay?id=';
// }

//after a successful or failed order, the user will redirect to this url
const redirectUrl = 'https://codeklab.com/subscription/verify';

//  Handeling the redierct
const secret = "$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS";

//  Handeling the payment request
router.get('/request', async (req, res) => {
  const { amount, serviceType } = req.query;

  if (!amount || amount <= 250) {
    return res.status(400).send("Amount must be greater than 250 IQD");
  }

  if (!serviceType) {
    return res.status(400).send("Service type is required");
  }

  // Generate an order id
  const orderId = uuidv4();

  // Set the token expire time
  const time = Date.now();

  // Building the transaction data to be encoded in a JWT token
  const data = {
    amount,
    serviceType,
    msisdn: "9647835077893",
    orderId,
    redirectUrl: redirectUrl,
    iat: time,
    exp: time + 60 * 60 * 4
  };

  // Encoding the data
  const token = jwt.sign(data, secret);

  // Preparing the payment data to be sent to ZC API
  const postData = {
    token,
    merchantId: "5ffacf6612b5777c6d44266f",
    lang: "ar"
  };

  console.log(postData);

  // Request Options
  const requestOptions = {
    uri: initUrl,
    body: JSON.stringify(postData),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    // Initializing a ZC order by sending a request with the tokens
    request(requestOptions, async function (error, response) {
      if (error) {
        return res.status(500).send("Error initializing ZC order");
      }
      const responseBody = JSON.parse(response.body);
      const OperationId = responseBody.id;

      // Save order to MongoDB
      const order = new Order({
        amount,
        serviceType,
        orderId,
        OperationId,
        createdAt: new Date()
      });

      await order.save();

      console.log(responseBody);
      // Redirect the user to ZC payment Page
      res.writeHead(302, {
        'Location': requestUrl + OperationId
      });
      res.end();
    });
  } catch (error) {
    console.log(error)
    res.status(500).send("Internal Server Error");
  }
});

// Endpoint to decode the JWT token
router.post('/decode-token', (req, res) => {
    const { token } = req.body;

    try {
        const decoded = jwt.verify(token, secret);
        res.json({ decoded });
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
});

//  Handeling the redierct
router.get('redirect', (req, res) => {
    const token = req.body.token;
    if (token) {
      try {
        var decoded = jwt.verify(token, "$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS");
      } catch (err) {
        // err
      }
      if (decoded.status == 'success') {
        // Do whatever you like
      } else {
        //  Do other things
      }
    }
});

router.post('/transaction', async (req, res) => {
    const { id } = req.body;
  
    const data = {
      id: id,
      msisdn: "9647835077893",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
    };
  
    const newtoken = jwt.sign(data, "$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS", { algorithm: 'HS256' });
  
    const data_to_post = {
      token: newtoken,
      merchantId: "5ffacf6612b5777c6d44266f",
    };
  
    try {
      const response = await axios.post('https://test.zaincash.iq/transaction/get', data_to_post, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});



module.exports = router;