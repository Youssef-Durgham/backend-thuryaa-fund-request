const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
dotenv.config();
const home = require("./routes/Home");
const auth = require("./routes/Auth");
const cert = require("./routes/Certificate");
const comment = require("./routes/Comment");
const course = require("./routes/Course");
const progress = require("./routes/Progress");
const quiz = require("./routes/Quiz");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const serverless = require('serverless-http');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
// Use helmet to set HTTP headers that improve security
app.use(helmet());
// const rateLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 4000000000, // limit each IP to 400 requests per windowMs
// });

// // Apply the rate limiter to all routes
// app.use(rateLimiter);

// enable CORS and allow x-auth-token header
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
}); 

// Connect to MongoDB using async/await
async function connectToMongoDB() {
  try {
    const dbConnection = await mongoose.connect(process.env.MONGO_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      maxIdleTimeMS: 270000,
      minPoolSize: 2,
      maxPoolSize: 4,
    });
    console.log("MongoDB Connected");
    return dbConnection; // Return the connection object
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    throw err; // Rethrow the error to handle it later
  }
}

// Initialize MongoDB connection
let connectionPromise = connectToMongoDB();

// Middleware to attach the MongoDB connection to the request object
app.use(async (req, res, next) => {
  try {
    req.dbConnection = await connectionPromise;
    next();
  } catch (err) {
    res.status(500).json({ error: "Failed to connect to MongoDB" });
  }
});

//Route Middlewares
app.use("/", home);
app.use("/auth", auth);
app.use("/cert", cert);
app.use("/comment", comment);
app.use("/course", course);
app.use("/progress", progress);
app.use("/quiz", quiz);

// Lambda function handler
module.exports.handler = (event, context, callback) => {
  const handler = serverless(app);
  return handler(event, context, callback);
};
