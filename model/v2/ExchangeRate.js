// models/ExchangeRate.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const exchangeRateSchema = new Schema({
  currency: { type: String, required: true, unique: true }, // مثل 'USD', 'EUR'
  rate: { type: Number, required: true }, // نسبة العملة إلى العملة الأساسية
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

exchangeRateSchema.plugin(entityPlugin);

const ExchangeRate = mongoose.model('ExchangeRate', exchangeRateSchema);
module.exports = ExchangeRate;
