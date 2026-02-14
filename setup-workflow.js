/**
 * Setup Script: Creates admin user, roles, permissions, departments, and workflow
 *
 * Run: node setup-workflow.js
 *
 * This will create:
 * 1. System admin user
 * 2. All required roles with permissions
 * 3. The FundRequest workflow with 4 steps
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Admin } = require('./model/Users');
const { Role } = require('./model/Role');
const AssignedWorkflow = require('./model/v2/AssignedWorkflow');
const Department = require('./model/v2/Department');
const Entity = require('./model/v2/Entity');

const MONGO_URL = process.env.MONGO_URL;

async function setup() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB');

    // =============================================
    // 1. CREATE ROLES WITH PERMISSIONS
    // =============================================
    const rolesData = [
      {
        name: 'موظف (Employee)',
        permissions: [
          'Create_FundRequest',
          'View_FundRequests',
          'View_FundRequest',
          'Cancel_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'مدير (Manager)',
        permissions: [
          'Approve_FundRequest',
          'Reject_FundRequest',
          'View_FundRequests',
          'View_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'مالي (Financial)',
        permissions: [
          'Approve_FundRequest',
          'Reject_FundRequest',
          'View_FundRequests',
          'View_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'المدير التنفيذي (Executive Director)',
        permissions: [
          'Approve_FundRequest',
          'Reject_FundRequest',
          'View_FundRequests',
          'View_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'الكاشير (Cashier)',
        permissions: [
          'Approve_FundRequest',
          'Pay_FundRequest',
          'View_FundRequests',
          'View_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'المحاسب (Accountant)',
        permissions: [
          'View_Paid_FundRequests',
          'View_FundRequests',
          'View_FundRequest',
          'View_Departments'
        ]
      },
      {
        name: 'مدير النظام (System Admin)',
        permissions: [
          'Create_FundRequest',
          'Approve_FundRequest',
          'Reject_FundRequest',
          'View_FundRequest',
          'View_FundRequests',
          'Cancel_FundRequest',
          'Pay_FundRequest',
          'View_Paid_FundRequests',
          'Create_Department',
          'View_Departments',
          'Create_Workflow',
          'View_Workflows',
          'Manage_AssignedWorkflow',
          'Manage_AssignedWorkflowUsers',
          'Create_admin',
          'add_role',
          'assign_roles'
        ]
      }
    ];

    const createdRoles = {};

    for (const roleData of rolesData) {
      let role = await Role.findOne({ name: roleData.name });
      if (role) {
        // Update permissions if role exists
        role.permissions = roleData.permissions;
        await role.save();
        console.log(`Updated role: ${roleData.name}`);
      } else {
        role = new Role(roleData);
        await role.save();
        console.log(`Created role: ${roleData.name}`);
      }
      createdRoles[roleData.name] = role;
    }

    // =============================================
    // 2. CREATE SYSTEM ADMIN USER
    // =============================================
    const adminEmail = 'admin@system.com';
    let adminUser = await Admin.findOne({ email: adminEmail });

    if (!adminUser) {
      adminUser = new Admin({
        email: adminEmail,
        name: 'System Admin',
        password: 'Admin@123456',
        type: 'System',
        department: 'IT',
        roles: [createdRoles['مدير النظام (System Admin)']._id]
      });
      await adminUser.save();
      console.log(`\nCreated System Admin user:`);
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: Admin@123456`);
      console.log(`  Type: System`);
    } else {
      console.log(`\nSystem Admin user already exists (email: ${adminEmail})`);
    }

    // =============================================
    // 3. CREATE ENTITY C1
    // =============================================
    let entityC1 = await Entity.findOne({ code: 'C1' });
    if (!entityC1) {
      entityC1 = new Entity({
        name: 'الشركة الرئيسية',
        code: 'C1',
        type: 'Company',
        status: 'Active',
        fiscalYearStart: new Date('2025-01-01'),
        fiscalYearEnd: new Date('2025-12-31'),
        baseCurrency: 'IQD',
        createdBy: adminUser._id
      });
      await entityC1.save();
      console.log(`\nCreated Entity C1: ${entityC1.name} (ID: ${entityC1._id})`);
    } else {
      console.log(`\nEntity C1 already exists (ID: ${entityC1._id})`);
    }

    // Assign Entity C1 to admin user with System Admin role
    const systemAdminRole = createdRoles['مدير النظام (System Admin)'];
    const hasEntityRole = adminUser.entityRoles && adminUser.entityRoles.some(
      er => er.entity && er.entity.toString() === entityC1._id.toString()
    );

    if (!hasEntityRole) {
      adminUser.entityRoles = adminUser.entityRoles || [];
      adminUser.entityRoles.push({
        entity: entityC1._id,
        roles: [systemAdminRole._id]
      });
      adminUser.entities = adminUser.entities || [];
      adminUser.entities.push(entityC1._id);
      adminUser.currentEntity = entityC1._id;
      await adminUser.save();
      console.log(`Assigned Entity C1 to admin user with System Admin role`);
    } else {
      console.log(`Admin user already has Entity C1 assigned`);
    }

    // =============================================
    // 5. CREATE DEFAULT DEPARTMENTS
    // =============================================
    const defaultDepartments = ['IT', 'المالية', 'الموارد البشرية', 'المشتريات', 'المبيعات', 'الإدارة'];

    for (const deptName of defaultDepartments) {
      const existing = await Department.findOne({ name: deptName });
      if (!existing) {
        await new Department({ name: deptName, createdBy: adminUser._id }).save();
        console.log(`Created department: ${deptName}`);
      } else {
        console.log(`Department already exists: ${deptName}`);
      }
    }

    // =============================================
    // 6. CREATE FUND REQUEST WORKFLOW
    // =============================================
    const workflowType = 'FundRequest';
    let workflow = await AssignedWorkflow.findOne({ transactionType: workflowType });

    if (workflow) {
      console.log(`\nWorkflow '${workflowType}' already exists. Updating steps...`);
      workflow.steps = [
        { level: 1, stepName: 'مدير (Manager)', approvers: [], canReject: true },
        { level: 2, stepName: 'مالي (Financial)', approvers: [], canReject: true },
        { level: 3, stepName: 'المدير التنفيذي (Executive Director)', approvers: [], canReject: true },
        { level: 4, stepName: 'الكاشير (Cashier)', approvers: [], canReject: false }
      ];
      await workflow.save();
    } else {
      workflow = new AssignedWorkflow({
        transactionType: workflowType,
        steps: [
          { level: 1, stepName: 'مدير (Manager)', approvers: [], canReject: true },
          { level: 2, stepName: 'مالي (Financial)', approvers: [], canReject: true },
          { level: 3, stepName: 'المدير التنفيذي (Executive Director)', approvers: [], canReject: true },
          { level: 4, stepName: 'الكاشير (Cashier)', approvers: [], canReject: false }
        ]
      });
      await workflow.save();
    }

    console.log(`\nWorkflow created/updated: ${workflowType}`);
    console.log(`  Workflow ID: ${workflow._id}`);
    console.log(`  Steps:`);
    console.log(`    1. مدير (Manager) - can reject: YES`);
    console.log(`    2. مالي (Financial) - can reject: YES`);
    console.log(`    3. المدير التنفيذي (Executive Director) - can reject: YES`);
    console.log(`    4. الكاشير (Cashier) - can reject: NO (only approve/pay)`);

    // =============================================
    // SUMMARY
    // =============================================
    console.log('\n========================================');
    console.log('SETUP COMPLETE');
    console.log('========================================');
    console.log('\nRoles created:');
    for (const [name, role] of Object.entries(createdRoles)) {
      console.log(`  - ${name} (ID: ${role._id})`);
    }
    console.log(`\nWorkflow ID: ${workflow._id}`);
    console.log('\nNEXT STEPS:');
    console.log('1. Assign approvers to each workflow step via the admin panel or API');
    console.log('   POST /api/FundReq/assigned-workflows/<workflowId>/add-user');
    console.log('   Body: { "level": 1, "userId": "<manager_user_id>" }');
    console.log('2. Create admin users for each role and assign them the correct role');
    console.log('3. Assign users to departments');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Setup failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

setup();
