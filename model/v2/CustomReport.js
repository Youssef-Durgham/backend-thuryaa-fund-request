// models/CustomReport.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const customReportSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  filters: {
    periodStart: { type: Date },
    periodEnd: { type: Date },
    accountTypes: [{ type: String }], // مثل ['Revenue', 'Expense']
    departments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    // أضف المزيد من الفلاتر حسب الحاجة
  },
  columns: [{
    type: String, // مثل ['Account Name', 'Debit', 'Credit']
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

customReportSchema.plugin(entityPlugin);

const CustomReport = mongoose.model('CustomReport', customReportSchema);
module.exports = CustomReport;
