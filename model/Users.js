const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true},
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'instructor', 'admin'], default: 'user' },
  profile: {
    fullName: String,
  },
  isEmailVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationCodeExpires: { type: Date },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  consentForMarketing: { type: Boolean, default: false },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (!this.isModified('createdAt')) {
    this.updatedAt = Date.now();
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
