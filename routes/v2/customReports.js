// routes/customReports.js
const express = require('express');
const CustomReport = require('../../model/v2/CustomReport');
const logActivity = require('../../utils/activityLogger');
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


// إنشاء تقرير مخصص جديد
router.post('/custom-reports', checkPermission('Create_CustomReport'), async (req, res) => {
  try {
    const { name, description, filters, columns } = req.body;
    const entityId = req.entity._id;

    const customReport = new CustomReport({
      name,
      description,
      filters,
      columns,
      createdBy: req.adminId,
      entity: entityId
    });

    await customReport.save();

    // تسجيل النشاط
    await logActivity({
      action: 'Create_CustomReport',
      performedBy: req.adminId,
      targetItem: customReport._id,
      itemType: 'CustomReport',
      userType: 'Admin',
      entity: entityId
    });

    res.status(201).json({ message: 'Custom Report created successfully', customReport });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// الحصول على قائمة بالتقارير المخصصة
router.get('/custom-reports', checkPermission('View_CustomReports'), async (req, res) => {
  try {
    const customReports = await CustomReport.find()
      .populate('createdBy', 'name');

    res.status(200).json(customReports);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// تنفيذ تقرير مخصص بناءً على معرف التقرير
router.get('/custom-reports/:id/execute', checkPermission('Execute_CustomReport'), async (req, res) => {
  try {
    const { id } = req.params;
    const report = await CustomReport.findById(id);
    if (!report) {
      return res.status(404).json({ message: 'Custom Report not found' });
    }

    const { filters, columns } = report;

    // بناء الفلاتر للاستعلام
    const query = {};
    if (filters.periodStart || filters.periodEnd) {
      query.createdAt = {};
      if (filters.periodStart) query.createdAt.$gte = new Date(filters.periodStart);
      if (filters.periodEnd) query.createdAt.$lte = new Date(filters.periodEnd);
    }
    if (filters.accountTypes && filters.accountTypes.length > 0) {
      query['account.type'] = { $in: filters.accountTypes };
    }
    if (filters.departments && filters.departments.length > 0) {
      query['account.department'] = { $in: filters.departments };
    }
    // أضف المزيد من الشروط حسب الفلاتر

    // تنفيذ الاستعلام على دفتر الأستاذ
    const ledgerEntries = await GeneralLedger.find(query)
      .populate('debitAccount', 'name type')
      .populate('creditAccount', 'name type');

    // بناء التقرير بناءً على الأعمدة المحددة
    const reportData = ledgerEntries.map(entry => {
      const data = {};
      columns.forEach(column => {
        switch(column) {
          case 'Account Name':
            data['Account Name'] = entry.debitAccount.name; // مثال، يمكن تخصيصه
            break;
          case 'Debit':
            data['Debit'] = entry.debitAccount.type === 'Debit' ? entry.amount : 0;
            break;
          case 'Credit':
            data['Credit'] = entry.creditAccount.type === 'Credit' ? entry.amount : 0;
            break;
          // أضف المزيد من الأعمدة حسب الحاجة
          default:
            data[column] = '';
        }
      });
      return data;
    });

    res.status(200).json({ reportName: report.name, data: reportData });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
