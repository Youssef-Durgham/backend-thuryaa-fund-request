// models/BalanceSheet.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const balanceSheetSchema = new Schema({
  date: { type: Date, required: true },
  assets: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  liabilities: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  equity: [{
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    amount: { type: Number, required: true }
  }],
  totalAssets: { type: Number, required: true },
  totalLiabilities: { type: Number, required: true },
  totalEquity: { type: Number, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

balanceSheetSchema.plugin(entityPlugin);

const BalanceSheet = mongoose.model('BalanceSheet', balanceSheetSchema);
module.exports = BalanceSheet;
