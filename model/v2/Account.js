// models/Account.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const accountSchema = new Schema({
  name: { type: String, required: true, unique: true },
  type: { 
    type: String, 
    enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'], 
    required: true 
  },
  currency: { type: String, default: 'IQD' }, // العملة الخاصة بالحساب (افتراضي: العملة الأساسية)
  description: { type: String }
}, { timestamps: true });

accountSchema.plugin(entityPlugin);

const Account = mongoose.model('Account', accountSchema);
module.exports = Account;
