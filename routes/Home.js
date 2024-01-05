const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const transactionModel = require("../model/transactionModel.js");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const serviceAccount = require("../taxi-a519a-firebase-adminsdk-c1qag-a4149b9d00.json");
const Notification = require("../model/Notification.js");
const Payment = require("../model/Payment.js");
const Message = require("../model/Message.js");

// Create a new FCM client.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await user.correctPassword(password))) {
    return res.status(401).send("Incorrect username or password");
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "365d",
    }
  );

  res.status(200).json({ token });
});

router.post("/register", async (req, res) => {
  try {
    const { username, password, role, name, Location, phone } = req.body;
    console.log(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create a new user
    const newUser = new User({
      username,
      password,
      role,
      name,
      Location,
      phone,
      fcmTokens: [] // Initialize fcmTokens as an empty array
    });

    // Save the new user
    await newUser.save();

    // Optionally remove the password from the output
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error registering new user" });
  }
});

router.post("/transaction", async (req, res) => {
  try {
    const { user, type, amount, dueDate } = req.body;
    console.log(req.body);
    const transaction = await transactionModel.create({
      user,
      type,
      amount,
      amounttx: amount,
      dueDate,
    });
    res.status(201).json(transaction);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
});

router.put("/transaction/:id/pay", async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { paidAmount } = req.body; // Get paidAmount from request body

    const transaction = await transactionModel.findById(transactionId);
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    // Check if paidAmount is provided and valid
    if (
      paidAmount !== undefined &&
      paidAmount > 0 &&
      transaction.amount >= paidAmount
    ) {
      transaction.amount -= paidAmount;

      // Set transaction as paid if the amount reaches 0
      if (transaction.amount === 0) {
        transaction.paid = true;
        transaction.paidDate = new Date(); // Set the current date if fully paid
      }
    } else {
      // Handle invalid paidAmount
      return res.status(400).send("Invalid paid amount");
    }

    await transaction.save();
    res.send(transaction);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/user/:userId/totals", async (req, res) => {
  try {
    const userId = req.params.userId;

    const totals = await transactionModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { type: "$type", paid: "$paid" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.type",
          details: {
            $push: {
              paidStatus: "$_id.paid",
              amount: "$totalAmount",
              transactionCount: "$count",
            },
          },
        },
      },
      {
        $project: {
          type: "$_id",
          _id: 0,
          paidDetails: {
            $filter: {
              input: "$details",
              as: "detail",
              cond: { $eq: ["$$detail.paidStatus", true] },
            },
          },
          unpaidDetails: {
            $filter: {
              input: "$details",
              as: "detail",
              cond: { $eq: ["$$detail.paidStatus", false] },
            },
          },
        },
      },
      {
        $project: {
          type: 1,
          paidTotalAmount: { $sum: "$paidDetails.amount" },
          paidTotalTransactions: { $sum: "$paidDetails.transactionCount" },
          unpaidTotalAmount: { $sum: "$unpaidDetails.amount" },
          unpaidTotalTransactions: { $sum: "$unpaidDetails.transactionCount" },
        },
      },
    ]);

    if (!totals.length) {
      return res.status(404).send("No transactions found for user");
    }

    res.send(totals);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
});

// Endpoint to get transactions of a user
router.get("/transactions/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    // Query for transactions where 'paid' is false
    const transactions = await transactionModel.find({
      user: userId,
      paid: false,
    });
    res.status(200).json(transactions);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
});

router.get("/search/users", async (req, res) => {
  try {
    const searchTerm = req.query.name;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    // Find users whose name matches the search term
    const users = await User.find({
      name: new RegExp(searchTerm, "i"),
      role: "user", // Only include users with the role 'user'
    }).select("-password"); // Exclude the password field

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/transactions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user role
    const user = await User.findById(userId);
    const userRole = user.role;

    let transactionQuery = {
      user: userId,
      paid: false,
    };

    // If user role is 'user', add type filter for 'debt'
    if (userRole === "user") {
      transactionQuery.type = "debt";
    }

    // Query to find transactions based on user role
    const transactions = await transactionModel.find(transactionQuery);

    res.json(transactions);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
});

router.get("/api/transactions/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all transactions (debt and credit) for the user
    const transactions = await transactionModel.find({ user: userId });

    res.json(transactions);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
});

router.get("/api/transHistory/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await transactionModel.find({ user: userId });
    res.json(transactions);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
});

router.get("/api/alltransactions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await transactionModel.find({ user: userId });
    res.json(transactions);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/user/name/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const user = await User.findOne({
      name: name,
      role: "user", // Ensure the user has the role 'user'
    }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/add-fcm-token", async (req, res) => {
  const { userId, fcmToken } = req.body;

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Add the FCM token if it's not already in the array
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
      await user.save();
    }

    res.send("FCM token added successfully");
  } catch (error) {
    res.status(500).send("Error adding FCM token");
  }
});

router.post("/send-custom-notification", async (req, res) => {
  const { userId, title, body, screenType, jsonData } = req.body;

  if (!userId || !title || !body || !screenType) {
    return res
      .status(400)
      .json({ error: "User ID, title, body, and screen type are required" });
  }

  try {
    // Find the user and get their FCM tokens
    const user = await User.findById(userId);
    if (!user || user.fcmTokens.length === 0) {
      return res
        .status(404)
        .json({ error: "No FCM tokens found for the user" });
    }

    const tokenList = user.fcmTokens;

    const message = {
      notification: {
        title,
        body,
        data: jsonData,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
      tokens: tokenList,
    };

    const response = await admin.messaging().sendMulticast(message);

    // Optionally, you can save the notification details in your database
    await new Notification({
      userId,
      title,
      body,
      screenType,
      jsonData,
    }).save();

    res.status(200).json({ success: "Notification sent", response });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.post("/mark-notification-as-read", async (req, res) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ error: "Notification ID is required" });
  }

  try {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({ success: "Notification marked as read" });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

router.get("/notifications/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    // Retrieve notifications and sort them by 'sentAt' in descending order
    const notifications = await Notification.find({ userId }).sort({
      sentAt: -1,
    });
    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error retrieving notifications:", error);
    res.status(500).json({ error: "Failed to retrieve notifications" });
  }
});

router.get("/notifications/unread/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });
    res.status(200).json({ hasUnreadNotifications: unreadCount > 0 });
  } catch (error) {
    console.error("Error checking unread notifications:", error);
    res.status(500).json({ error: "Failed to check for unread notifications" });
  }
});

router.put("/transaction/:id/waiting", async (req, res) => {
  try {
    const transaction = await transactionModel.findById(req.params.id);
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    const paidAmount = req.body.paidAmount;
    let newPayment = "";

    // Calculate total paid amount for 'waiting' or 'confirmed' payments
const totalConfirmedWaitingPaid = await Payment.aggregate([
  { $match: { transaction: transaction._id, status: { $in: ["waiting", "confirmed"] } } },
  { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
]);
const totalPaidConfirmedWaiting = totalConfirmedWaitingPaid[0] ? totalConfirmedWaitingPaid[0].totalAmount : 0;

// Check if the new paid amount exceeds the amount for the transaction
if (totalPaidConfirmedWaiting + paidAmount > transaction.amount) {
  return res.status(400).send("Can't add more payment because the total payment amount is bigger than total amount. Wait for approval or rejection from the owner.");
}

    // Calculate total paid amount so far
    const totalPaid = transaction.payments.reduce(async (sum, paymentId) => {
      const payment = await Payment.findById(paymentId);
      return sum + payment.amount;
    }, 0);

    // Check if the new paid amount exceeds the debt amount
    if (totalPaid + paidAmount > transaction.debtAmount) {
      return res.status(410).send("Paid amount exceeds the debt amount");
    }

    if (paidAmount !== undefined) {
      newPayment = new Payment({
        transaction: transaction._id,
        amount: paidAmount,
      });
      await newPayment.save();
      transaction.payments.push(newPayment._id);
    }

    transaction.status = "waiting";
    await transaction.save();

    const user = await User.findById(transaction.user);
    const userName = user.name;

    // Send notification to all admin users and save it in the database
    const adminUsers = await User.find({ role: "admin" });
    console.log(adminUsers);

    for (const user of adminUsers) {
      console.log(user);

      // Check if user has FCM tokens
      const tokenList = user.fcmTokens;
      console.log(tokenList);

      if (tokenList && tokenList.length > 0) {
        // User has FCM tokens, prepare and send the notification
        const message = {
          notification: {
            title: "Transaction waiting",
            body: `User ${userName} has paid ${paidAmount}.`,
          },
          android: {
            priority: "high",
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
            headers: {
              "apns-priority": "10",
            },
          },
          tokens: tokenList,
        };

        const response = await admin.messaging().sendMulticast(message);
        // Log response or handle errors as needed
      }

      // Save notification to database for each admin, regardless of FCM token existence
      await new Notification({
        userId: user._id,
        title: "Transaction waiting",
        body: `User ${userName} has paid ${paidAmount}.`,
        screenType: "transactionUpdate",
        jsonData: {
          transactionId: transaction._id,
          transactiontxt: newPayment._id,
        },
      }).save();
    }

    res.send("Transaction status updated and admins notified");
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

// GET a transaction by ID
router.get("/transaction/get/:id", async (req, res) => {
  try {
    const transaction = await transactionModel
      .findById(req.params.id)
      .populate("user", "username role name"); // Populates only specified fields

    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.put("/payment/confirm/:paymentId/:notificationId", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).send("Payment not found");
    }
    console.log("Payment:", payment);
  
    // Use payment.transaction instead of req.params.paymentId
    const transaction2 = await transactionModel.findById(payment.transaction);
    if (!transaction2) {
      return res.status(404).send("Transaction not found for the given payment");
    }
    console.log("Transaction User:", transaction2.user, "Transaction:", transaction2);

    payment.status = "confirmed";
    await payment.save();
    const notification = await Notification.findById(req.params.notificationId);
    // Update the transaction
    const transaction = await transactionModel.findById(payment.transaction);
    if (transaction.amount >= payment.amount) {
      transaction.amount -= payment.amount;
      // Set transaction as paid only if the amount reaches 0
      if (transaction.amount === 0) {
        transaction.paid = true;
      }
      transaction.paidDate = new Date();
      await transaction.save();
    } else {
      return res.status(400).send("Invalid payment amount");
    }

    // Update the notification title
    notification.title = "Transaction approved";
    await notification.save();
    const user = await User.findById(transaction2.user);
    console.log(user);

    // Save the notification details for the user
    const userNotification = {
      userId: user._id,
      title: "payment approved",
      body: "the payment you paid has be approved",
      screenType: "paymentConfirmation", // You can modify this as needed
    };

    const allUserTokens = user.fcmTokens;
    const message = {
      notification: {
        title: "transaction approved",
        body: `Your transaction of payed have ben approved`,
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
      tokens: allUserTokens,
    };
    await Notification.create(userNotification);
    const response = await admin.messaging().sendMulticast(message);

    res.json({ transaction, payment, notification });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

router.put("/payment/reject/:paymentId/:notificationId", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).send("Payment not found");
    }

    const notification = await Notification.findById(req.params.notificationId);
    const users = await transactionModel.findById(payment.transaction);
    if (!notification) {
      return res.status(404).send("Notification not found");
    }

    payment.status = "rejected";
    await payment.save();

    // No need to update the transaction for rejection, but you can add logic here if needed

    // Update the notification title
    notification.title = "Transaction rejected";
    await notification.save();
    const user = await User.findById(users.user);
console.log(user);
    // Save the notification details for the user
    const userNotification = {
      userId: user._id,
      title: "payment rejected",
      body: "the payment you paid has be rejected",
      screenType: "paymentConfirmation", // You can modify this as needed
    };

    const allUserTokens = user.fcmTokens;
    console.log(allUserTokens);
    const message = {
      notification: {
        title: "Transaction rejected",
        body: "Your pay for transaction has rejected",
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
      tokens: allUserTokens,
    };
    await Notification.create(userNotification);
    const response = await admin.messaging().sendMulticast(message);
console.log(response);
    res.json({ payment, notification });
  } catch (error) {
    console.log(error);
    res.status(500).send(error.message);
  }
});

router.get("/api/payment/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const paymentData = await Payment.findById(paymentId).populate(
      "transaction"
    );

    if (!paymentData) {
      return res.status(404).send("Payment not found");
    }

    res.json(paymentData);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/transaction222/:id/addNote", async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).send("Note is required");
    }

    const transaction = await mongoose.model("Transaction").findById(id);

    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    transaction.notes.push(note);
    await transaction.save();

    res.status(200).send("Note added successfully");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/transaction333/:id/addFileLink", async (req, res) => {
  try {
    const { id } = req.params;
    const { fileLink } = req.body;

    if (!fileLink) {
      return res.status(400).send("File link is required");
    }

    const transaction = await mongoose.model("Transaction").findById(id);

    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    transaction.fileLinks.push(fileLink);
    await transaction.save();

    res.status(200).send("File link added successfully");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/transaction33/:id/details", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the transaction by ID
    const transaction = await mongoose
      .model("Transaction")
      .findById(id)
      .select("fileLinks notes");

    // Check if the transaction exists
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    // Extract fileLinks and notes
    const { fileLinks, notes } = transaction;

    // Send response
    res.status(200).json({ fileLinks, notes });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/transactions2/sorted", async (req, res) => {
  try {
    const transactions = await transactionModel
      .find({ paid: false })
      .populate("user", "username name") // Populate with desired fields from the User model
      .sort({ dueDate: 1 }); // Sorting by due date in ascending order

    res.status(200).json({
      status: "success",
      data: {
        transactions,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: "error",
      message: "Error fetching transactions",
      error: err.message,
    });
  }
});

router.post("/send-message", async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;

    // Validate senderId and receiverId existence (You may want to add more validation)

    const conversationId = new mongoose.Types.ObjectId();

    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      conversationId,
    });

    const savedMessage = await newMessage.save();

    // Send FCM notification to the user with receiverId
    const receiver = await User.findById(receiverId); // Assuming you have a User model
    if (receiver && receiver.fcmTokens.length > 0) {
      const tokens2 = receiver.fcmTokens;
      const message = {
        notification: {
          title: "New Message",
          body: `You have a new message from ${senderId}`,
        },
        android: {
          priority: "high",
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
          headers: {
            "apns-priority": "10",
          },
        },
        tokens: tokens2,
      };

      const response = await admin.messaging().sendMulticast(message);

      // Log details of the response
      console.log("Multicast Response:", response);

      // Check for errors in the response
      if (response.failureCount > 0) {
        console.error(
          "Failed to send FCM notifications:",
          response.responses[0].error
        );
      }

      console.log("Successfully sent message:", response);

      res.json(savedMessage);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/send-message-user", async (req, res) => {
  try {
    const { senderId, message } = req.body;

    // Validate senderId existence (You may want to add more validation)

    // Retrieve all admin users' ids
    const adminUserIds = await User.find({ role: "admin" }).distinct("_id");

    // Create a unique conversation ID
    const conversationId = new mongoose.Types.ObjectId();

    // Create a message for each admin user with the same conversation ID
    const messages = adminUserIds.map((adminId) => ({
      senderId,
      receiverId: adminId,
      message,
      conversationId, // Assign the same conversation ID to all messages
    }));

    // Bulk insert messages
    const savedMessages = await Message.insertMany(messages);

    // Retrieve FCM tokens for all admin users
    const adminUsers = await User.find({ _id: { $in: adminUserIds } });

    // Prepare the list of FCM tokens for all admin users
    const adminTokens = adminUsers.reduce((tokens, adminUser) => {
      if (adminUser.fcmTokens && adminUser.fcmTokens.length > 0) {
        tokens.push(...adminUser.fcmTokens);
      }
      return tokens;
    }, []);

    if (adminTokens.length > 0) {
      const message = {
        notification: {
          title: "New Message",
          body: `You have a new message from ${senderId}`,
        },
        android: {
          priority: "high",
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
            },
          },
          headers: {
            "apns-priority": "10",
          },
        },
        tokens: adminTokens,
      };

      const response = await admin.messaging().sendMulticast(message);

      console.log("Successfully sent message to admins:", response);
    }

    res.json(savedMessages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/view-messages/:userId/:otherUserId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const otherUserId = req.params.otherUserId;

    // Validate userId and otherUserId existence (You may want to add more validation)

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    }).sort({ sentAt: 1 });

    // Determine if the user is the sender for each message in the conversation
    const messagesWithIsSender = messages.map((message) => {
      const isSender = message.senderId._id.toString() === userId.toString(); // Convert both to strings
      return { ...message.toObject(), isSender };
    });

    res.json({ messages: messagesWithIsSender });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/view-messages-user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate userId existence (You may want to add more validation)

    // Retrieve all admin users' ids
    const adminUserIds = await User.find({ role: "admin" }).distinct("_id");

    // Find messages between the specified user and all admin users
    const messages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId, receiverId: { $in: adminUserIds } },
            { senderId: { $in: adminUserIds }, receiverId: userId },
          ],
        },
      },
      {
        $sort: { sentAt: 1 },
      },
      {
        $group: {
          _id: "$conversationId", // Group by conversationId
          message: { $first: "$$ROOT" }, // Select only the first message in each group
        },
      },
      {
        $replaceRoot: { newRoot: "$message" }, // Replace the root document with the selected message
      },
    ]);

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find({}, "_id name username"); // Fetch only _id, name, and username fields

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/user22/:userId/messages", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find distinct conversationIds related to the user
    const distinctConversations = await Message.distinct("conversationId", {
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    // Find the latest message for each distinct conversationId
    const messages = await Promise.all(
      distinctConversations.map(async (conversationId) => {
        const conversationMessages = await Message.find({ conversationId })
          .sort("sentAt")
          .populate("senderId", "username name") // Assuming you want to include sender information
          .populate("receiverId", "username name"); // Assuming you want to include receiver information

        // Determine if the user is the sender for each message in the conversation
        const messagesWithIsSender = conversationMessages.map((message) => {
          const isSender =
            message.senderId._id.toString() === userId.toString(); // Convert both to strings
          console.log(message.senderId._id.toString(), isSender, userId);
          return { ...message.toObject(), isSender };
        });

        // Get the latest message in the conversation
        const latestMessage =
          messagesWithIsSender[messagesWithIsSender.length - 1];

        return latestMessage;
      })
    );

    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/transactions/edit/:id", async (req, res) => {
  const transactionId = req.params.id;
  const { dueDate, amounttx, type } = req.body;

  try {
    // Find the transaction by ID
    const transaction = await transactionModel.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Check if there are any payments associated with this transaction
    const paymentExists = await Payment.findOne({ transaction: transactionId });
    if (paymentExists) {
      return res
        .status(420)
        .json({
          error: "Cannot edit transaction as it has associated payments",
        });
    }

    // Update the transaction fields
    if (dueDate) {
      transaction.dueDate = dueDate;
    }
    if (amounttx) {
      transaction.amount = amounttx;
      transaction.amounttx = amounttx;
    }
    if (type) {
      transaction.type = type;
    }

    // Save the updated transaction
    await transaction.save();

    // Send the updated transaction as the response
    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/transactions/delete/:id", async (req, res) => {
  const transactionId = req.params.id;

  try {
    // Check if there are any payments associated with this transaction
    const paymentExists = await Payment.findOne({ transaction: transactionId });
    if (paymentExists) {
      return res
        .status(420)
        .json({
          error: "Cannot delete transaction as it has associated payments",
        });
    }

    // If no payments found, find the transaction by ID and delete it
    const deletedTransaction = await transactionModel.findByIdAndDelete(
      transactionId
    );

    if (!deletedTransaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Send the deleted transaction as the response
    res.json(deletedTransaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/payments/data/:transactionId", async (req, res) => {
  const transactionId = req.params.transactionId;

  try {
    // Find all payments for the given transaction ID
    const payments = await Payment.find({ transaction: transactionId });

    res.json({ payments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
