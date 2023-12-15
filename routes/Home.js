const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const transactionModel = require("../model/transactionModel.js");

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
    const { username, password, role, name } = req.body;
    console.log(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    // Create a new user
    const newUser = await User.create({ username, password, role, name });

    // Optionally remove password from the output
    newUser.password = undefined;

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).send("Error registering new user");
  }
});

router.post("/transaction", async (req, res) => {
  try {
    const { user, type, amount, dueDate } = req.body;
    const transaction = await transactionModel.create({
      user,
      type,
      amount,
      dueDate,
    });
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/transaction/:id/pay', async (req, res) => {
  try {
      const transactionId = req.params.id;
      const paidStatus = req.body.paid; // true or false

      const transaction = await transactionModel.findById(transactionId);
      if (!transaction) {
          return res.status(404).send('Transaction not found');
      }

      transaction.paid = paidStatus;
      if (paidStatus) {
          transaction.paidDate = new Date(); // Set the current date
      } else {
          transaction.paidDate = null; // Reset the paid date
      }

      await transaction.save();
      res.send(transaction);
  } catch (error) {
      res.status(500).send('Server error');
  }
});

router.get('/user/:userId/totals', async (req, res) => {
  try {
      const userId = req.params.userId;

      const totals = await Transaction.aggregate([
          { $match: { user: mongoose.Types.ObjectId(userId) } },
          { $group: {
              _id: {
                  type: '$type',
                  paid: '$paid'
              },
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
          }},
          { $group: {
              _id: '$_id.type',
              totals: {
                  $push: {
                      paidStatus: '$_id.paid',
                      amount: '$totalAmount',
                      transactionCount: '$count'
                  }
              },
              totalTypeAmount: { $sum: '$totalAmount' }
          }},
          { $group: {
              _id: null,
              types: {
                  $push: {
                      type: '$_id',
                      totals: '$totals',
                      totalAmount: '$totalTypeAmount'
                  }
              },
              grandTotal: { $sum: '$totalTypeAmount' }
          }}
      ]);

      if (!totals.length) {
          return res.status(404).send('No transactions found for user');
      }

      res.send(totals[0]);
  } catch (error) {
      res.status(500).send('Server error');
  }
});

// Endpoint to get transactions of a user
router.get("/transactions/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const transactions = await transactionModel.find({ user: userId });
    res.status(200).json(transactions);
  } catch (error) {
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
    });

    // Find transactions for each user
    const userTransactions = await Promise.all(
      users.map(async (user) => {
        const transactions = await transactionModel.find({ user: user._id });
        return { user, transactions };
      })
    );

    res.status(200).json(userTransactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

module.exports = router;
