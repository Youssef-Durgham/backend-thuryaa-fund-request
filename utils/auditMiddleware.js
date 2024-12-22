// utils/auditMiddleware.js
const ActivityLog = require('../model/ActivityLog');

const auditMiddleware = (schema, itemType) => {
  // بعد حفظ (save) أو تحديث (update) المستندات
  schema.post(['save', 'findOneAndUpdate', 'deleteOne'], async function(doc, next) {
    try {
      let action = '';
      if (this.op === 'save') {
        action = 'Create';
      } else if (this.op === 'findOneAndUpdate') {
        action = 'Update';
      } else if (this.op === 'deleteOne') {
        action = 'Delete';
      }

      await ActivityLog.create({
        action: `${action}_${itemType}`,
        performedBy: doc.createdBy || null, // افترض أن المستند يحتوي على `createdBy`
        targetItem: doc._id,
        itemType: itemType,
        userType: 'Admin', // أو حسب السياق
        description: `${action} ${itemType}`,
        changes: doc // يمكنك تخصيص هذا الجزء لتسجيل التغييرات فقط
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
    next();
  });
};

module.exports = auditMiddleware;
