// routes/financialReporting.js
const express = require('express');
const mongoose = require('mongoose');
const FinancialReport = require('../../model/v2/FinancialReport');
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


// Generate Balance Sheet
router.post('/balance-sheet', checkPermission('Generate_FinancialReports'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { periodEnd, notes } = req.body;
    const periodEndDate = new Date(periodEnd);

    // Get all accounts
    const accounts = await Account.find({}).session(session);
    
    // Calculate account balances up to the period end date
    const ledgerEntries = await GeneralLedger.find({
      date: { $lte: periodEndDate }
    }).session(session);

    // Calculate balances for each account type
    const balances = {
      assets: [],
      liabilities: [],
      equity: []
    };

    accounts.forEach(account => {
      const accountEntries = ledgerEntries.filter(entry => 
        entry.debitAccount.equals(account._id) || 
        entry.creditAccount.equals(account._id)
      );

      let balance = 0;
      accountEntries.forEach(entry => {
        if (entry.debitAccount.equals(account._id)) {
          balance += entry.amountInBaseCurrency;
        }
        if (entry.creditAccount.equals(account._id)) {
          balance -= entry.amountInBaseCurrency;
        }
      });

      const accountBalance = {
        accountId: account._id,
        amount: Math.abs(balance),
        category: account.type
      };

      switch(account.type) {
        case 'Asset':
          balances.assets.push(accountBalance);
          break;
        case 'Liability':
          balances.liabilities.push(accountBalance);
          break;
        case 'Equity':
          balances.equity.push(accountBalance);
          break;
      }
    });

    // Calculate totals
    const totalAssets = balances.assets.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = balances.liabilities.reduce((sum, item) => sum + item.amount, 0);
    const totalEquity = balances.equity.reduce((sum, item) => sum + item.amount, 0);

    // Create balance sheet report
    const balanceSheet = new FinancialReport({
      reportType: 'BalanceSheet',
      periodStart: new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1),
      periodEnd: periodEndDate,
      createdBy: req.adminId,
      data: {
        assets: balances.assets,
        liabilities: balances.liabilities,
        equity: balances.equity
      },
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity
      },
      status: 'Published',
      notes: notes ? [{ note: notes, addedBy: req.adminId }] : []
    });

    await balanceSheet.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      message: 'Balance sheet generated successfully',
      report: balanceSheet
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error generating balance sheet', error: error.message });
  } finally {
    session.endSession();
  }
});

// Generate Profit and Loss Statement
router.post('/profit-loss', checkPermission('Generate_FinancialReports'), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const { periodStart, periodEnd, notes } = req.body;
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
  
      // Get all revenue and expense accounts
      const accounts = await Account.find({
        type: { $in: ['Revenue', 'Expense'] }
      }).session(session);
  
      // Get relevant ledger entries
      const ledgerEntries = await GeneralLedger.find({
        date: { 
          $gte: startDate,
          $lte: endDate
        }
      }).session(session);
  
      // Calculate revenue and expenses
      const calculations = {
        revenue: [],
        expenses: []
      };
  
      accounts.forEach(account => {
        const accountEntries = ledgerEntries.filter(entry => 
          entry.debitAccount.equals(account._id) || 
          entry.creditAccount.equals(account._id)
        );
  
        let balance = 0;
        accountEntries.forEach(entry => {
          if (account.type === 'Revenue') {
            if (entry.creditAccount.equals(account._id)) {
              balance += entry.amountInBaseCurrency;
            }
          } else { // Expense
            if (entry.debitAccount.equals(account._id)) {
              balance += entry.amountInBaseCurrency;
            }
          }
        });
  
        const accountBalance = {
          accountId: account._id,
          amount: balance,
          category: account.type
        };
  
        if (account.type === 'Revenue') {
          calculations.revenue.push(accountBalance);
        } else {
          calculations.expenses.push(accountBalance);
        }
      });
  
      // Calculate totals
      const totalRevenue = calculations.revenue.reduce((sum, item) => sum + item.amount, 0);
      const totalExpenses = calculations.expenses.reduce((sum, item) => sum + item.amount, 0);
      const netIncome = totalRevenue - totalExpenses;
  
      // Create P&L report
      const profitLossReport = new FinancialReport({
        reportType: 'ProfitAndLoss',
        periodStart: startDate,
        periodEnd: endDate,
        createdBy: req.adminId,
        data: {
          revenue: calculations.revenue,
          expenses: calculations.expenses
        },
        summary: {
          totalRevenue,
          totalExpenses,
          netIncome
        },
        status: 'Published',
        notes: notes ? [{ note: notes, addedBy: req.adminId }] : []
      });
  
      await profitLossReport.save({ session });
      await session.commitTransaction();
  
      res.status(200).json({
        message: 'Profit and Loss statement generated successfully',
        report: profitLossReport
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({ message: 'Error generating Profit and Loss statement', error: error.message });
    } finally {
      session.endSession();
    }
  });
  
  // Get report list with pagination
  router.get('/reports', checkPermission('View_FinancialReports'), async (req, res) => {
    try {
      const { page = 1, limit = 10, reportType, startDate, endDate } = req.query;
      const query = {};
  
      if (reportType) {
        query.reportType = reportType;
      }
  
      if (startDate || endDate) {
        query.periodEnd = {};
        if (startDate) query.periodEnd.$gte = new Date(startDate);
        if (endDate) query.periodEnd.$lte = new Date(endDate);
      }
  
      const reports = await FinancialReport.find(query)
        .sort({ periodEnd: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('createdBy', 'name');
  
      const total = await FinancialReport.countDocuments(query);
  
      res.status(200).json({
        reports,
        total,
        pages: Math.ceil(total / limit),
        currentPage: parseInt(page)
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching reports', error: error.message });
    }
  });
  
  module.exports = router;