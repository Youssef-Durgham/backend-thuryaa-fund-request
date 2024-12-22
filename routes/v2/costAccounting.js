// routes/costAccounting.js
const express = require('express');
const mongoose = require('mongoose');
const { Admin } = require('../../model/Users');;
const { CostCenter, CostAllocationRule, CostTransaction } = require('../../model/v2/Tax');
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



// Create cost center
router.post('/centers', checkPermission('Manage_Cost_Centers'), async (req, res) => {
  try {
    const {
      code,
      name,
      type,
      parent,
      budget,
      description,
      managers
    } = req.body;
    const entityId = req.entity._id;

    const costCenter = new CostCenter({
      code,
      name,
      type,
      parent,
      budget,
      description,
      managers,
      entity: entityId
    });

    await costCenter.save();

    res.status(201).json({
      message: 'Cost center created successfully',
      costCenter
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating cost center', error: error.message });
  }
});

// Create allocation rule
router.post('/allocation-rules', checkPermission('Manage_Cost_Allocation'), async (req, res) => {
  try {
    const {
      name,
      sourceCenter,
      destinationCenters,
      basis,
      frequency
    } = req.body;
    const entityId = req.entity._id;

    // Validate total allocation percentage
    const totalPercentage = destinationCenters.reduce(
      (sum, dest) => sum + dest.allocationPercentage, 
      0
    );

    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({ 
        message: 'Total allocation percentage must equal 100%' 
      });
    }

    const allocationRule = new CostAllocationRule({
      name,
      sourceCenter,
      destinationCenters,
      basis,
      frequency,
      entity: entityId
    });

    await allocationRule.save();

    res.status(201).json({
      message: 'Allocation rule created successfully',
      allocationRule
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating allocation rule', error: error.message });
  }
});

// Run cost allocation
router.post('/allocate', checkPermission('Run_Cost_Allocation'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ruleId, date } = req.body;
    const entityId = req.entity._id;

    const rule = await CostAllocationRule.findById(ruleId)
      .populate('sourceCenter')
      .populate('destinationCenters.center')
      .session(session);

    if (!rule) {
      throw new Error('Allocation rule not found');
    }

    // Get source center costs
    const sourceCosts = await CostTransaction.find({
      costCenter: rule.sourceCenter._id,
      date: {
        $gte: getDateRangeForFrequency(date, rule.frequency).start,
        $lte: getDateRangeForFrequency(date, rule.frequency).end
      }
    }).session(session);

    const totalAmount = sourceCosts.reduce((sum, cost) => sum + cost.amount, 0);

    // Create allocation transactions
    const allocationTransactions = rule.destinationCenters.map(dest => {
      const allocatedAmount = (totalAmount * dest.allocationPercentage) / 100;

      return new CostTransaction({
        date,
        costCenter: dest.center._id,
        amount: allocatedAmount,
        type: 'Allocated',
        description: `Allocated from ${rule.sourceCenter.name}`,
        allocatedFrom: rule.sourceCenter._id,
        allocationRule: rule._id,
        entity: entityId
      });
    });

    await CostTransaction.insertMany(allocationTransactions, { session });

    await session.commitTransaction();

    res.status(200).json({
      message: 'Cost allocation completed successfully',
      allocations: allocationTransactions
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error running cost allocation', error: error.message });
  } finally {
    session.endSession();
  }
});

// Generate cost center report
// routes/costAccounting.js (continued)
router.get('/centers/:id/report', checkPermission('View_Cost_Reports'), async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const costCenter = await CostCenter.findOne({ _id: id, entity: entityId })
        .populate('managers', 'name')
        .populate('parent');
  
      if (!costCenter) {
        return res.status(404).json({ message: 'Cost center not found or not associated with this entity' });
      }
  
      // Get all transactions for the cost center and entity
      const transactions = await CostTransaction.find({
        costCenter: id,
        entity: entityId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
        .populate('allocatedFrom')
        .populate('allocationRule')
        .sort({ date: 1 });
  
      // Calculate cost summaries
      const summary = {
        directCosts: 0,
        allocatedCosts: 0,
        overheadCosts: 0,
        totalCosts: 0,
        byType: {},
        byMonth: {}
      };
  
      transactions.forEach(transaction => {
        switch (transaction.type) {
          case 'Direct':
            summary.directCosts += transaction.amount;
            break;
          case 'Allocated':
            summary.allocatedCosts += transaction.amount;
            break;
          case 'Overhead':
            summary.overheadCosts += transaction.amount;
            break;
        }
  
        // Summarize by reference type
        summary.byType[transaction.referenceModel] =
          (summary.byType[transaction.referenceModel] || 0) + transaction.amount;
  
        // Summarize by month
        const monthYear = transaction.date.toISOString().substring(0, 7);
        summary.byMonth[monthYear] = (summary.byMonth[monthYear] || 0) + transaction.amount;
      });
  
      summary.totalCosts = summary.directCosts + summary.allocatedCosts + summary.overheadCosts;
  
      // Get budget variance
      const budgetVariance = costCenter.budget?.amount
        ? costCenter.budget.amount - summary.totalCosts
        : null;
  
      // Get child cost centers for the entity
      const childCenters = await CostCenter.find({ parent: id, entity: entityId })
        .select('name code type totalCosts');
  
      res.status(200).json({
        costCenter,
        summary,
        budgetVariance,
        childCenters,
        transactions
      });
    } catch (error) {
      res.status(500).json({ message: 'Error generating cost center report', error: error.message });
    }
  });  
  
  // Analyze cost allocation efficiency
  router.get('/allocation-analysis', checkPermission('View_Cost_Analysis'), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      // Get all allocation rules for the entity
      const rules = await CostAllocationRule.find({ status: 'Active', entity: entityId })
        .populate('sourceCenter')
        .populate('destinationCenters.center');
  
      const analysis = [];
  
      for (const rule of rules) {
        // Get source center transactions for the entity
        const sourceCosts = await CostTransaction.find({
          costCenter: rule.sourceCenter._id,
          entity: entityId,
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        });
  
        // Get allocated transactions for the entity
        const allocatedCosts = await CostTransaction.find({
          allocationRule: rule._id,
          entity: entityId,
          date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        });
  
        const totalSourceCost = sourceCosts.reduce((sum, t) => sum + t.amount, 0);
        const totalAllocated = allocatedCosts.reduce((sum, t) => sum + t.amount, 0);
  
        const destinationAnalysis = rule.destinationCenters.map(dest => {
          const destCosts = allocatedCosts.filter(t => t.costCenter.toString() === dest.center._id.toString());
          const actualPercentage = (destCosts.reduce((sum, t) => sum + t.amount, 0) / totalAllocated) * 100;
  
          return {
            center: dest.center,
            plannedPercentage: dest.allocationPercentage,
            actualPercentage,
            variance: dest.allocationPercentage - actualPercentage
          };
        });
  
        analysis.push({
          rule: {
            _id: rule._id,
            name: rule.name,
            basis: rule.basis,
            frequency: rule.frequency
          },
          sourceCenter: rule.sourceCenter,
          totalSourceCost,
          totalAllocated,
          allocationEfficiency: (totalAllocated / totalSourceCost) * 100,
          destinationAnalysis
        });
      }
  
      res.status(200).json({
        startDate,
        endDate,
        analysis
      });
    } catch (error) {
      res.status(500).json({ message: 'Error analyzing cost allocation', error: error.message });
    }
  });  
  
  // Get cost trends and analysis
  router.get('/trends', checkPermission('View_Cost_Analysis'), async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'month' } = req.query;
      const entityId = req.entity._id; // Extract the entity ID from the request
  
      const matchStage = {
        entity: entityId, // Add entity filter
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
      };
  
      let groupByStage;
      if (groupBy === 'month') {
        groupByStage = { year: { $year: '$date' }, month: { $month: '$date' } };
      } else if (groupBy === 'quarter') {
        groupByStage = { year: { $year: '$date' }, quarter: { $ceil: { $divide: [{ $month: '$date' }, 3] } } };
      } else {
        groupByStage = { year: { $year: '$date' } };
      }
  
      const trends = await CostTransaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupByStage,
            directCosts: { $sum: { $cond: [{ $eq: ['$type', 'Direct'] }, '$amount', 0] } },
            allocatedCosts: { $sum: { $cond: [{ $eq: ['$type', 'Allocated'] }, '$amount', 0] } },
            overheadCosts: { $sum: { $cond: [{ $eq: ['$type', 'Overhead'] }, '$amount', 0] } },
            totalCosts: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
  
      const trendsWithChanges = trends.map((period, index) => {
        const previousPeriod = index > 0 ? trends[index - 1] : null;
        const changes = previousPeriod
          ? {
              directCostsChange: ((period.directCosts - previousPeriod.directCosts) / previousPeriod.directCosts) * 100,
              allocatedCostsChange: ((period.allocatedCosts - previousPeriod.allocatedCosts) / previousPeriod.allocatedCosts) * 100,
              overheadCostsChange: ((period.overheadCosts - previousPeriod.overheadCosts) / previousPeriod.overheadCosts) * 100,
              totalCostsChange: ((period.totalCosts - previousPeriod.totalCosts) / previousPeriod.totalCosts) * 100
            }
          : null;
  
        return {
          period: period._id,
          costs: {
            direct: period.directCosts,
            allocated: period.allocatedCosts,
            overhead: period.overheadCosts,
            total: period.totalCosts
          },
          changes
        };
      });
  
      res.status(200).json({
        trends: trendsWithChanges,
        groupBy
      });
    } catch (error) {
      res.status(500).json({ message: 'Error analyzing cost trends', error: error.message });
    }
  });  
  
  module.exports = router;