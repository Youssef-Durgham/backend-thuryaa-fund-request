// models/CurrencyRevaluation.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const currencyRevaluationSchema = new Schema({
  revaluationDate: { type: Date, required: true },
  currency: { type: String, required: true },
  oldRate: { type: Number, required: true },
  newRate: { type: Number, required: true },
  difference: { type: Number, required: true }, // الفرق في قيمة العملة
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

currencyRevaluationSchema.plugin(entityPlugin);

const CurrencyRevaluation = mongoose.model('CurrencyRevaluation', currencyRevaluationSchema);
module.exports = CurrencyRevaluation;
