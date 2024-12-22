const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const dns = require('dns').promises;
dotenv.config();
const AdminAssignRole = require("./routes/AdminAssignRole");
const AdminLogin = require("./routes/AdminLogin");
const AdminRoleList = require("./routes/AdminRole");
const AdminUsersList = require("./routes/AdminUsersList");
const CustomerLogin = require("./routes/CustomerLogin");
const CustomerUsersList = require("./routes/CustomerUsersList");
const Item = require("./routes/Items");
const Categorys = require("./routes/Categorys");
const AwsLink = require("./routes/AwsLink");
const Supplier = require("./routes/Supplier");
const Storage = require("./routes/Storage");
const Invoice = require("./routes/Invoices");
const Order = require("./routes/Order");
const CashBox = require("./routes/CashBox");
const Trash = require("./routes/Trash");
const Cart = require("./routes/Cart");
const Keycard = require("./routes/Keycard");
const Banner = require("./routes/Banner");
const Reports = require("./routes/Reports");
const Uploadbulk = require("./routes/UploadBulk");
const { router: Notification, checkOrdersAndSendReminders, checkItemsAndSendReminders } = require("./routes/Nontification");
const boxRoutes = require('./routes/v2/boxes');
const accountsRoutes = require('./routes/v2/accounts');
const salesRoutes = require('./routes/v2/sales');
const purchasesRoutes = require('./routes/v2/purchases');
const ledgerRoutes = require('./routes/v2/generalLedger');
const exchangeRateRoutes = require('./routes/v2/exchangeRates');
const productsRoutes = require('./routes/v2/products');
const expensesRoutes = require('./routes/v2/expenses');
const accountsPayableReceivableRoutes = require('./routes/v2/accountsPayableReceivable');
const taxesRoutes = require('./routes/v2/taxes');
const reportsRoutes = require('./routes/v2/reports');
const financialReporting = require('./routes/v2/financialReporting');
const budgetManagement = require('./routes/v2/budgetManagement');
const assetManagement = require('./routes/v2/assetManagement');
const taxManagement = require('./routes/v2/taxManagement');
const costAccounting = require('./routes/v2/costAccounting');
// const reconciliationRoutes = require('./routes/v2/reconciliation'); // استيراد المسار الجديد
const bankStatementRoutes = require('./routes/v2/bankStatements'); // استيراد مسار كشف الحساب البنكي
const payrollRoutes = require('./routes/v2/payroll'); // استيراد مسار الرواتب
const employeeRoutes = require('./routes/v2/employees'); // استيراد مسار الموظفين
const currencyRevaluationRoutes = require('./routes/v2/currencyRevaluation'); // استيراد المسار الجديد
const activityLogRoutes = require('./routes/v2/activityLogs'); // استيراد المسار الجديد
const approvalWorkflowsRouter = require('./routes/v2/approvalWorkflows');
const approvalsRouter = require('./routes/v2/approvals');
const journalTemplatesRoutes = require('./routes/v2/journalTemplates');
const entityManagments = require('./routes/v2/entityManagement');
const FundReq = require('./routes/v2/FundReq');


const serverless = require('serverless-http');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

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
    return dbConnection;
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    throw err;
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
app.use("/AdminAssignRole", AdminAssignRole);
app.use("/AdminLogin", AdminLogin);
app.use("/AdminRoleList", AdminRoleList);
app.use("/AdminUsersList", AdminUsersList);
app.use("/CustomerLogin", CustomerLogin);
app.use("/CustomerUsersList", CustomerUsersList);
app.use("/Category", Categorys);
app.use("/Item", Item);
app.use("/AwsLink", AwsLink);
app.use("/Supplier", Supplier);
app.use("/Invoice", Invoice);
app.use("/Storage", Storage);
app.use("/Order", Order);
app.use("/CashBox", CashBox);
app.use("/Trash", Trash);
app.use("/Cart", Cart);
app.use("/Keycard", Keycard);
app.use("/Banner", Banner);
app.use("/Reports", Reports);
app.use("/Uploadbulk", Uploadbulk);
app.use("/Notification", Notification);

// new ones
app.use('/api', boxRoutes);
app.use('/api', accountsRoutes);
app.use('/api', salesRoutes);
app.use('/api', purchasesRoutes);
app.use('/api', ledgerRoutes);
app.use('/api', exchangeRateRoutes);
app.use('/api', productsRoutes);
app.use('/api', expensesRoutes);
app.use('/api', accountsPayableReceivableRoutes);
app.use('/api', taxesRoutes);
app.use('/api', reportsRoutes);
app.use('/api/financial', financialReporting);
app.use('/api/budget', budgetManagement);
app.use('/api/assets', assetManagement);
app.use('/api/tax', taxManagement);
app.use('/api/cost', costAccounting);
app.use('/api', journalTemplatesRoutes);
app.use('/api', payrollRoutes);
app.use('/api', employeeRoutes);
app.use('/api', bankStatementRoutes);
app.use('/api', currencyRevaluationRoutes);
app.use('/api', activityLogRoutes);
app.use('/api', approvalWorkflowsRouter);
app.use('/api', approvalsRouter);
app.use('/api', entityManagments);
app.use('/api/FundReq', FundReq);


// Lambda function handler
module.exports.handler = (event, context, callback) => {
  const handler = serverless(app);
  return handler(event, context, callback);
};

// New handler for CloudWatch Events
module.exports.dailyOrderReminder = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Set custom DNS servers
  dns.setServers(['8.8.8.8', '8.8.4.4']);

  let dbConnection;
  try {
    // Create a new connection for this invocation
    dbConnection = await mongoose.connect(process.env.MONGO_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      maxIdleTimeMS: 270000,
      minPoolSize: 2,
      maxPoolSize: 4,
    });
    console.log("MongoDB Connected in dailyOrderReminder");

    // Pass the dbConnection to checkOrdersAndSendReminders if needed
    const result = await checkOrdersAndSendReminders(dbConnection);
    console.log(result.message || result.error);

    return { 
      statusCode: result.error ? 404 : 200, 
      body: JSON.stringify(result) 
    };
  } catch (error) {
    console.error('Error in dailyOrderReminder:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'فشل في إرسال التذكيرات' }) 
    };
  } finally {
    // Close the connection after use
    if (dbConnection) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }
    // Reset DNS servers to default
    dns.setServers(['8.8.8.8', '8.8.4.4']);
  }
};

// New handler for CloudWatch Events
module.exports.dailyItemsReminder = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Set custom DNS servers
  dns.setServers(['8.8.8.8', '8.8.4.4']);

  let dbConnection;
  try {
    // Create a new connection for this invocation
    dbConnection = await mongoose.connect(process.env.MONGO_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      maxIdleTimeMS: 270000,
      minPoolSize: 2,
      maxPoolSize: 4,
    });
    console.log("MongoDB Connected in dailyItemsReminder");

    // Pass the dbConnection to checkItemsAndSendReminders
    const result = await checkItemsAndSendReminders(dbConnection);
    console.log(result.message || result.error);

    return { 
      statusCode: result.error ? 404 : 200, 
      body: JSON.stringify(result) 
    };
  } catch (error) {
    console.error('Error in dailyItemsReminder:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'فشل في إرسال التذكيرات', details: error.message }) 
    };
  } finally {
    // Close the connection after use
    if (dbConnection) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }
    // Reset DNS servers to default
    dns.setServers(['8.8.8.8', '8.8.4.4']);
  }
};
