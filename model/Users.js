const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['manager', 'seller', 'storage', 'admin', 'inventory', 'logistics'] },
  name: { type: String, required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  phone: { type: String },
  fcmTokens: { type: [String] },
  // Additional fields
  email: { type: String },
  department: { type: String },
  hireDate: { type: Date },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
