// routes/payroll.js
const express = require('express');
const Payroll = require('../../model/v2/Payroll');
const Employee = require('../../model/v2/Employee');
const GeneralLedger = require('../../model/v2/GeneralLedger');
const findOrCreateAccount = require('../../utils/findOrCreateAccount');
const logActivity = require('../../utils/activityLogger');
const mongoose = require('mongoose');
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


router.post('/payrolls', checkPermission('Create_Payroll'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { payrollDate, employeeIds } = req.body;
    const entityId = req.entity._id; // Extract entity ID from request

    const employees = await Employee.find({ _id: { $in: employeeIds } }).session(session);
    if (employees.length === 0) throw new Error('No valid employees found');

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const payrollEntries = employees.map(employee => {
      const grossSalary = employee.salary;
      const deductions = grossSalary * 0.1; // مثال: 10% خصومات
      const netSalary = grossSalary - deductions;

      totalGross += grossSalary;
      totalDeductions += deductions;
      totalNet += netSalary;

      return {
        employee: employee._id,
        grossSalary,
        deductions,
        netSalary
      };
    });

    const newPayroll = new Payroll({
      payrollDate,
      employees: payrollEntries,
      totalGross,
      totalDeductions,
      totalNet,
      createdBy: req.adminId,
      entity: entityId
    });

    await newPayroll.save({ session });

    // العثور على حسابات دفتر الأستاذ أو إنشائها
    const payrollExpenseAccount = await findOrCreateAccount('Payroll Expenses', 'Expense', entityId);
    const cashAccount = await findOrCreateAccount('Cash', 'Asset', entityId);

    // إنشاء قيود دفتر الأستاذ
    const ledgerEntry = new GeneralLedger({
      description: `Payroll for ${payrollDate.toISOString().split('T')[0]}`,
      debitAccount: payrollExpenseAccount._id,
      creditAccount: cashAccount._id,
      amount: totalNet,
      currency: 'USD', // أو العملة المناسبة
      exchangeRate: 1,
      amountInBaseCurrency: totalNet,
      reference: newPayroll._id,
      refModel: 'Payroll',
      entity: entityId
    });

    await ledgerEntry.save({ session });

    newPayroll.relatedLedgerEntries.push(ledgerEntry._id);
    await newPayroll.save({ session });

    // تسجيل النشاط
    await logActivity({
      action: 'Create_Payroll',
      performedBy: req.adminId,
      targetItem: newPayroll._id,
      itemType: 'Payroll',
      userType: 'Admin',
      entity: entityId
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Payroll created successfully', payroll: newPayroll });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/payrolls', checkPermission('View_Payrolls'), async (req, res) => {
  try {
    const entityId = req.entity._id; // Extract the entity ID from the request

    const payrolls = await Payroll.find({ entity: entityId }) // Filter by entity
      .populate('employees.employee', 'name position')
      .populate('createdBy', 'name')
      .populate('relatedLedgerEntries');

    res.status(200).json(payrolls);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
