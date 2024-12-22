const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

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
  
  // Admin Schema
  const adminSchema = new Schema({
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    forcePasswordChange: { type: Boolean, default: false },
    oldPassword: { type: String },
    email: { type: String },
    entityRoles: [{
      entity: { type: Schema.Types.ObjectId, ref: 'Entity', required: true },
      roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }]
    }],
    entities: [{ type: Schema.Types.ObjectId, ref: 'Entity' }],
    currentEntity: { type: Schema.Types.ObjectId, ref: 'Entity' },
    type: { type: String, enum: ['Admin', 'System'], default: 'Admin' }, // New field
  });
  
  // Hash password before saving
  adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });

  const Customer = mongoose.model('Customer', customerSchema);
  const Admin = mongoose.model('Admin', adminSchema);

module.exports = { Customer, Admin };
