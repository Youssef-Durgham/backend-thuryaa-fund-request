const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  permissions: { type: [String], required: true } // e.g., ['assign_roles', 'delete_roles']
});

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
