const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');

// Customer Schema
const customerSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String },
  location: { type: String },
  isActivated: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiresAt: { type: Date }
});

// Hash password before saving if it is new or modified
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Role Schema
const roleSchema = new Schema({
    name: { type: String, required: true, unique: true },
    permissions: { type: [String], required: true } // e.g., ['assign_roles', 'delete_roles']
  });
  
  // Admin Schema
  const adminSchema = new Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    forcePasswordChange: { type: Boolean, default: false },
    oldPassword: { type: String }
  });
  
  // Hash password before saving
  adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });

const Customer = mongoose.model('Customer', customerSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Role = mongoose.model('Role', roleSchema);

module.exports = { Customer, Admin, Role };
