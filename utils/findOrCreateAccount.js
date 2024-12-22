// utils/findOrCreateAccount.js
const Account = require('../model/v2/Account');

const findOrCreateAccount = async (accountName, accountType, entityId, description = '') => {
  let account = await Account.findOne({ name: accountName });
  if (!account) {
    account = new Account({
      name: accountName,
      type: accountType,
      entity: entityId,
      description
    });
    await account.save();
  }
  return account;
};

module.exports = findOrCreateAccount;
