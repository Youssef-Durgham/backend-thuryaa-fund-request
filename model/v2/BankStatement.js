// models/BankStatement.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const bankStatementSchema = new Schema({
  bankAccount: { type: Schema.Types.ObjectId, ref: 'Box', required: true }, // افتراض أن `Box` يمثل حساب البنك
  statementDate: { type: Date, required: true },
  transactions: [{
    date: { type: Date, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true }
  }],
  isReconciled: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

bankStatementSchema.plugin(entityPlugin);

const BankStatement = mongoose.model('BankStatement', bankStatementSchema);
module.exports = BankStatement;
