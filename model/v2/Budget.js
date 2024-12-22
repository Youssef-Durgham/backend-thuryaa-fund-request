// models/Budget.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const budgetSchema = new Schema({
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    department: { type: String },
    category: { type: String, required: true },
    plannedAmount: { type: Number, required: true },
    actualAmount: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    status: { 
      type: String, 
      enum: ['Active', 'Closed'],
      default: 'Active'
    }
  }, { timestamps: true });
  
  budgetSchema.index({ year: 1, month: 1 });
  budgetSchema.index({ department: 1 });
  budgetSchema.index({ category: 1 });

  budgetSchema.plugin(entityPlugin);
  
  const Budget = mongoose.model('Budget', budgetSchema);
  module.exports = Budget;