const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSignInSchema = new Schema({
  userId: Schema.Types.ObjectId,
  signInDate: { type: Date, default: Date.now },
  ip: String,
  userAgent: String, // Schema field for user agent
});

const UserSignIn = mongoose.model('UserSignIn', userSignInSchema);

module.exports = UserSignIn;