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

// ssl setting need an ssl to buy it after that i will setup

// // Read the SSL certificate and key
// const privateKey = fs.readFileSync("/path/to/private.key");
// const certificate = fs.readFileSync("/path/to/certificate.crt");
// const ca = fs.readFileSync("/path/to/ca_bundle.crt");

// // Set up the SSL certificate and key
// const credentials = {
//   key: privateKey,
//   cert: certificate,
//   ca: ca
// };

// // Use the express-sslify middleware to redirect all HTTP traffic to HTTPS
// app.use(sslify.HTTPS({ trustProtoHeader: true }));

// connect to mongodb
mongoose
  .connect(process.env.MONGO_URL, { useNewUrlParser: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));


  
  // // MongoDB connection
  // mongoose.connect('mongodb://localhost:27017/yourDatabase', {
  //   useNewUrlParser: true,
  //   useUnifiedTopology: true
  // }).then(() => {
  //   console.log("Connected to MongoDB");
  // }).catch(err => {
  //   console.error("Error connecting to MongoDB", err);
  // });
  
  // Utility function to find or create a model
  async function findOrCreateModel(Model, query, create) {
    let model = await Model.findOne(query);
    console.log(model)
    if (!model) {
      model = new Model(create);
      await model.save();
    }
    return model;
  }
  
  // Function to insert data from Excel
// Function to insert data from Excel
async function insertData(data) {
  // Define locations outside the loop
  const karadaLocation = await findOrCreateModel(Location, { name: 'MAARAD' }, { name: 'MAARAD', address: 'Address for Karada' });
  const zafaraniaLocation = await findOrCreateModel(Location, { name: 'Zafarania' }, { name: 'Zafarania', address: 'Address for Zafarania' });

  for (const row of data) {
    const [
      itemBarcode,       // Item No.
      zafaraniaQuantity,    // Quantity in Zafarania
      karadaQuantity, // Quantity in Karada
      itemName,          // Item Description
      groupName,         // Group Name
      _,                 // Additional Identifier (currently unused)
      typeName           // LV1 (Type Name)
    ] = row;

    if (!groupName) {
      console.error("Group name is missing for item:", itemName);
      continue; // Skip this row if groupName is missing
    }

    const group = await findOrCreateModel(Group, { name: groupName }, { name: groupName });

    if (!typeName) {
      console.error("Type name is missing for item:", itemName);
      continue; // Skip this row if typeName is missing
    }

    const type = await findOrCreateModel(Type, { name: typeName, group: group._id }, { name: typeName, group: group._id });

    // Link the type with the group
    if (!group.types.includes(type._id)) {
      group.types.push(type._id);
      await group.save();
    }

    // Check if an inventory item with the same barcode and location already exists in Karada
    let existingKaradaInventoryItem = await Inventory.findOne({ barcode: itemBarcode, location: karadaLocation._id });

    if (!existingKaradaInventoryItem) {
      // Create a new inventory item in Karada
      existingKaradaInventoryItem = new Inventory({
        name: itemName,
        barcode: itemBarcode,
        location: karadaLocation._id,
        quantity: 0, // Start with 0 quantity
        group: group._id,
        type: type._id,
      });
    }

    // Update the quantity of the existing inventory item in Karada
    existingKaradaInventoryItem.quantity += karadaQuantity;
    console.log(existingKaradaInventoryItem)
    await existingKaradaInventoryItem.save();

    // Check if an inventory item with the same barcode and location already exists in Zafarania
    let existingZafaraniaInventoryItem = await Inventory.findOne({ barcode: itemBarcode, location: zafaraniaLocation._id });

    if (!existingZafaraniaInventoryItem) {
      // Create a new inventory item in Zafarania
      existingZafaraniaInventoryItem = new Inventory({
        name: itemName,
        barcode: itemBarcode,
        location: zafaraniaLocation._id,
        quantity: 0, // Start with 0 quantity
        group: group._id,
        type: type._id,
      });
    }

    // Update the quantity of the existing inventory item in Zafarania
    existingZafaraniaInventoryItem.quantity += zafaraniaQuantity;
    await existingZafaraniaInventoryItem.save();
  }
}
  
  // Function to read data from Excel file
  async function readExcelData(filePath) {
    let rows = await readXlsxFile(filePath);
    return rows.slice(1); // Assuming the first row is headers
  }
  
  // Example usage
  const filePath = './lastdata4.xlsx'; // Replace with your file path
  readExcelData(filePath)
    .then(data => insertData(data))
    .then(() => console.log('Data inserted successfully'))
    .catch(err => console.error('Error processing data', err));
  

// // Start the HTTPS server for ssl
// https.createServer(credentials, app).listen(3000, () => {
//     console.log("Server listening on port 3000");
//   });

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
