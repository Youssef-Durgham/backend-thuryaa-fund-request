//  Dependencies
const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const request = require('request');
const router = require("express").Router();
require('dotenv').config();

//  If the environment if it was on production or on testing mode
let initUrl = 'https://test.zaincash.iq/transaction/init';
let requestUrl = 'https://test.zaincash.iq/transaction/pay?id=';

// if (process.env.PRODUCTION === "true") {
//   initUrl = 'https://api.zaincash.iq/transaction/init';
//   requestUrl = 'https://api.zaincash.iq/transaction/pay?id=';
// }

//  Set the serviceType (Any text you like such as your website name)
const serviceType = "book";

//after a successful or failed order, the user will redirect to this url
const redirectUrl = 'https://codeklab.com/subscription/verify';

/* ------------------------------------------------------------------------------
Notes about redirectionUrl:
in this url, the api will add a new parameter (token) to its end like:
https://example.com/redirect?token=XXXXXXXXXXXXXX
------------------------------------------------------------------------------  */

//  Handeling the payment request
router.get('/request', (req, res) => {
  //  Set the amount to 250 if there is no amount in the request (For testing)
  //  it has to be more that 250 IQD
  const amount = 449000;

  //  Set an order id (This is usualy should be the order id in your sys DB)
  const orderId = "1999";

  //  Set the token expire time
  const time = Date.now();

  //  Building the transaction data to be encoded in a JWT token
  const data = {
    'amount': amount,
    'serviceType': serviceType,
    'msisdn': "9647835077893",
    'orderId': orderId,
    'redirectUrl': redirectUrl,
    'iat': time,
    'exp': time + 60 * 60 * 4
  };

  //  Encoding the datd
  const token = jwt.sign(data, "$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS");

  //  Preparing the payment data to be sent to ZC api
  const postData = {
    'token': token,
    'merchantId': "5ffacf6612b5777c6d44266f",
    'lang': "ar"
  };

  console.log(postData);

  //  Request Option
  const requestOptions = {
    uri: initUrl,
    body: JSON.stringify(postData),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  //  Initilizing a ZC order by sending a request with the tokens
  request(requestOptions, function (error, response) {
    //  Getting the operation id
    const OperationId = JSON.parse(response.body).id;
    console.log(JSON.parse(response.body));
    //  Redirect the user to ZC payment Page
    res.writeHead(302, {
      'Location': requestUrl + OperationId
    });
    res.end();
  });
});


//  Handeling the redierct
const secret = "$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS";

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



module.exports = router;