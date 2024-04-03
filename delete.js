const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
dotenv.config();
const home = require("./routes/Home");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const sslify = require("express-sslify");
const pm2 = require('pm2')
const readXlsxFile = require('read-excel-file/node');
const Inventory = require('./model/Inventory'); // Adjust path as needed
const Group = require('./model/Group');         // Adjust path as needed
const Type = require('./model/Type');           // Adjust path as needed
const Location = require('./model/Location');   // Adjust path as needed


// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
// Use helmet to set HTTP headers that improve security
app.use(helmet());
const rateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 400, // limit each IP to 400 requests per windowMs
});

// Apply the rate limiter to all routes
app.use(rateLimiter); 

// connect to mongodb
mongoose
  .connect(process.env.MONGO_URL, { useNewUrlParser: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
  



  const deleteITMItems = async () => {
    try {
      // Delete items with barcodes starting with 'ITM'
      const result = await Inventory.deleteMany({
        barcode: { $regex: '^ITM', $options: 'i' }
      });
  
      console.log('Deleted items count:', result.deletedCount);
    } catch (error) {
      console.error('Error during deletion:', error);
    } finally {
      // Close the MongoDB connection
      mongoose.connection.close();
    }
  };
  
  // Run the function
  deleteITMItems();
  

app.listen(3003, () => console.log("server running on port 3000"));

// Connect to PM2
pm2.connect((error) => {
    if (error) {
      console.error(error);
      process.exit(2);
    };
  
    // Start the server with PM2
    pm2.start({
      name: 'back-end', // name of the app
      script: 'server.js', // entry point of the app
      instances: 4, // number of instances to start
      max_memory_restart: '100M', // restart the app if it exceeds 100MB of memory
    }, (error, apps) => {
      pm2.disconnect(); // Disconnects from PM2
      if (error) throw error;
    });
  });
