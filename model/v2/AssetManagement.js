// models/AssetManagement.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const entityPlugin = require('../../utils/entityPlugin');

const assetSchema = new Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    purchaseDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    depreciationMethod: { 
      type: String, 
      enum: ['StraightLine', 'ReducingBalance', 'UnitsOfProduction'],
      required: true 
    },
    depreciationRate: { type: Number, required: true },
    accumulatedDepreciation: { type: Number, default: 0 },
    location: String,
    status: { 
      type: String, 
      enum: ['Active', 'Disposed', 'UnderMaintenance'],
      default: 'Active'
    },
    disposalDate: Date,
    disposalPrice: Number,
    maintenanceHistory: [{
      date: Date,
      description: String,
      cost: Number,
      performedBy: String
    }],
    documents: [{
      title: String,
      fileUrl: String,
      uploadedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
      uploadedAt: { type: Date, default: Date.now }
    }]
  }, { timestamps: true });
  
  assetSchema.index({ category: 1 });
  assetSchema.index({ status: 1 });
  assetSchema.index({ purchaseDate: 1 });

  assetSchema.plugin(entityPlugin);
  
  const Asset = mongoose.model('Asset', assetSchema);
  module.exports = Asset;