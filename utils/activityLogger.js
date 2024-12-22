// utils/activityLogger.js
const ActivityLog = require('../model/ActivityLog');

const logActivity = async ({ action, performedBy, targetUser, targetItem, itemType, userType, description, changes, entityId }) => {
  try {
    const activity = new ActivityLog({
      action,
      performedBy,
      targetUser,
      targetItem,
      itemType,
      userType,
      description,
      changes,
      entity: entityId
    });
    await activity.save();
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

module.exports = logActivity;
