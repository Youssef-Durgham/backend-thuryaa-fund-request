const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleSchema = new Schema({
  name: { type: String, required: true, unique: true },
  permissions: { type: [String], default: [] } // Make permissions optional and default to an empty array
});

const groupSchema = new Schema({
  groupName: { type: String, required: true, unique: true },
  roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }]
});

const Role = mongoose.model('Role', roleSchema);
const RoleGroup = mongoose.model('RoleGroup', groupSchema);

module.exports = { Role, RoleGroup };
