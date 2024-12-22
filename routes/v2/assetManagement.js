// routes/assetManagement.js
const express = require('express');
const mongoose = require('mongoose');
const Asset = require('../../model/v2/AssetManagement');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const Account = require('../../model/v2/Account');
const { Admin } = require('../../model/Users');
const checkEntityAccess = require('../../utils/entityAccess');
const jwt = require('jsonwebtoken');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);


const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const admin = await Admin.findById(decoded.id).populate('roles');

      if (admin.type === 'System') {
        // System user has all permissions
        req.adminId = decoded.id;
        return next();
      }

      const hasPermission = admin.roles.some(role =>
        role.permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.adminId = decoded.id;
      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
  };
};


// Create new asset
router.post('/assets', checkPermission('Create_Asset'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      category,
      purchaseDate,
      purchasePrice,
      depreciationMethod,
      depreciationRate,
      location,
      documents
    } = req.body;
    const entityId = req.entity._id;

    // Create new asset
    const asset = new Asset({
      name,
      category,
      purchaseDate: new Date(purchaseDate),
      purchasePrice,
      currentValue: purchasePrice,
      depreciationMethod,
      depreciationRate,
      location,
      documents: documents ? documents.map(doc => ({
        ...doc,
        uploadedBy: req.adminId
      })) : [],
      entity: entityId
    });

    await asset.save({ session });

    // Create ledger entry for asset purchase
    const assetAccount = await Account.findOne({ 
      type: 'Asset',
      category: 'FixedAssets'
    }).session(session);

    const cashAccount = await Account.findOne({
      type: 'Asset',
      category: 'Cash'
    }).session(session);

    if (!assetAccount || !cashAccount) {
      throw new Error('Required accounts not found');
    }

    const ledgerEntry = new GeneralLedger({
      date: new Date(purchaseDate),
      description: `Purchase of asset: ${name}`,
      debitAccount: assetAccount._id,
      creditAccount: cashAccount._id,
      amount: purchasePrice,
      reference: asset._id,
      refModel: 'Asset',
      entity: entityId
    });

    await ledgerEntry.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: 'Asset created successfully',
      asset
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error creating asset', error: error.message });
  } finally {
    session.endSession();
  }
});

// Calculate depreciation
router.post('/assets/calculate-depreciation', checkPermission('Calculate_Depreciation'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { assetId, date } = req.body;
    const entityId = req.entity._id;
    const calculationDate = new Date(date);

    const asset = await Asset.findById(assetId).session(session);
    if (!asset) {
      throw new Error('Asset not found');
    }

    let depreciationAmount = 0;
    const timeHeld = (calculationDate - asset.purchaseDate) / (1000 * 60 * 60 * 24 * 365); // Years

    switch (asset.depreciationMethod) {
      case 'StraightLine':
        depreciationAmount = (asset.purchasePrice * asset.depreciationRate * timeHeld) / 100;
        break;
      
      case 'ReducingBalance':
        depreciationAmount = asset.purchasePrice * 
          (1 - Math.pow(1 - asset.depreciationRate/100, timeHeld));
        break;
      
      // Add other depreciation methods as needed
    }

    // Update asset values
    asset.accumulatedDepreciation += depreciationAmount;
    asset.currentValue = asset.purchasePrice - asset.accumulatedDepreciation;
    
    // Create depreciation ledger entry
    const depreciationAccount = await Account.findOne({
      type: 'Expense',
      category: 'Depreciation'
    }).session(session);

    const accumulatedDepreciationAccount = await Account.findOne({
      type: 'Asset',
      category: 'AccumulatedDepreciation'
    }).session(session);

    if (!depreciationAccount || !accumulatedDepreciationAccount) {
      throw new Error('Required accounts not found');
    }

    const ledgerEntry = new GeneralLedger({
      date: calculationDate,
      description: `Depreciation for asset: ${asset.name}`,
      debitAccount: depreciationAccount._id,
      creditAccount: accumulatedDepreciationAccount._id,
      amount: depreciationAmount,
      reference: asset._id,
      refModel: 'Asset',
      entity: entityId
    });

    await Promise.all([
      asset.save({ session }),
      ledgerEntry.save({ session })
    ]);

    await session.commitTransaction();

    res.status(200).json({
      message: 'Depreciation calculated successfully',
      asset,
      depreciationAmount
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error calculating depreciation', error: error.message });
  } finally {
    session.endSession();
  }
});

// Record asset disposal
router.post('/assets/:id/dispose', checkPermission('Dispose_Asset'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { disposalPrice, disposalDate, notes } = req.body;
    const entityId = req.entity._id;
    const asset = await Asset.findById(req.params.id).session(session);
    
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Update asset status
    asset.status = 'Disposed';
    asset.disposalDate = new Date(disposalDate);
    asset.disposalPrice = disposalPrice;
    
    // Calculate gain/loss on disposal
    const gainLoss = disposalPrice - asset.currentValue;

    // Create ledger entries for disposal
    const cashAccount = await Account.findOne({
      type: 'Asset',
      category: 'Cash'
    }).session(session);

    const assetAccount = await Account.findOne({
      type: 'Asset',
      category: 'FixedAssets'
    }).session(session);

    const gainLossAccount = await Account.findOne({
      type: gainLoss >= 0 ? 'Revenue' : 'Expense',
      category: 'AssetDisposal'
    }).session(session);

    if (!cashAccount || !assetAccount || !gainLossAccount) {
      throw new Error('Required accounts not found');
    }

    // Record cash received and asset removal
    const disposalEntries = [
      new GeneralLedger({
        date: new Date(disposalDate),
        description: `Disposal of asset: ${asset.name}`,
        debitAccount: cashAccount._id,
        creditAccount: assetAccount._id,
        amount: disposalPrice,
        reference: asset._id,
        refModel: 'Asset',
        entity: entityId
      }),
      new GeneralLedger({
        date: new Date(disposalDate),
        description: `Gain/Loss on disposal of asset: ${asset.name}`,
        debitAccount: gainLoss >= 0 ? gainLossAccount._id : assetAccount._id,
        creditAccount: gainLoss >= 0 ? assetAccount._id : gainLossAccount._id,
        amount: Math.abs(gainLoss),
        reference: asset._id,
        refModel: 'Asset',
        entity: entityId
      })
    ];

    await Promise.all([
      asset.save({ session }),
      ...disposalEntries.map(entry => entry.save({ session }))
    ]);

    await session.commitTransaction();

    res.status(200).json({
      message: 'Asset disposed successfully',
      asset,
      gainLoss
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error disposing asset', error: error.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;