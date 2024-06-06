const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const loginHistorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  loginTime: { type: Date, default: Date.now },
  ipAddress: { type: String }
});

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

module.exports = LoginHistory;
