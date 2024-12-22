// models/Employee.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const employeeSchema = new Schema({
  name: { type: String, required: true },
  position: { type: String },
  salary: { type: Number, required: true },
  bankAccount: { type: Schema.Types.ObjectId, ref: 'Box' }, // حساب البنك الخاص بالموظف
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });

employeeSchema.plugin(entityPlugin);

const Employee = mongoose.model('Employee', employeeSchema);
module.exports = Employee;
