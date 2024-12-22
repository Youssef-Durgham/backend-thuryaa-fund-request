// utils/entityPlugin.js
const mongoose = require('mongoose');

const entityPlugin = (schema, options) => {
  schema.add({
    entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  });

  // إضافة فهرسة على حقل entity لتحسين أداء الاستعلامات
  schema.index({ entity: 1 });
};

module.exports = entityPlugin;
