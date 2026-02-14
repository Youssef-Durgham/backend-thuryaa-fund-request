/**
 * Seed Script: Creates test users for each workflow role and assigns them to the workflow steps
 *
 * Run: node seed-test-users.js
 *
 * Creates 5 test users:
 *   1. employee@test.com    - Employee (creates fund requests)
 *   2. manager@test.com     - Manager (Step 1 approver)
 *   3. financial@test.com   - Financial (Step 2 approver)
 *   4. director@test.com    - Executive Director (Step 3 approver)
 *   5. cashier@test.com     - Cashier (Step 4 approver)
 *
 * All passwords: Test@123456
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Admin } = require('./model/Users');
const { Role } = require('./model/Role');
const AssignedWorkflow = require('./model/v2/AssignedWorkflow');
const Entity = require('./model/v2/Entity');

const MONGO_URL = process.env.MONGO_URL;

const testUsers = [
  {
    email: 'employee@test.com',
    name: 'موظف تجريبي (Test Employee)',
    phone: '9640000000001',
    department: 'IT',
    roleName: 'موظف (Employee)',
    workflowLevel: null // not an approver
  },
  {
    email: 'manager@test.com',
    name: 'مدير تجريبي (Test Manager)',
    phone: '9640000000002',
    department: 'الإدارة',
    roleName: 'مدير (Manager)',
    workflowLevel: 1
  },
  {
    email: 'financial@test.com',
    name: 'مالي تجريبي (Test Financial)',
    phone: '9640000000003',
    department: 'المالية',
    roleName: 'مالي (Financial)',
    workflowLevel: 2
  },
  {
    email: 'director@test.com',
    name: 'المدير التنفيذي تجريبي (Test Director)',
    phone: '9640000000004',
    department: 'الإدارة',
    roleName: 'المدير التنفيذي (Executive Director)',
    workflowLevel: 3
  },
  {
    email: 'cashier@test.com',
    name: 'كاشير تجريبي (Test Cashier)',
    phone: '9640000000005',
    department: 'المالية',
    roleName: 'الكاشير (Cashier)',
    workflowLevel: 4
  }
];

async function seedTestUsers() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB');

    // Find Entity C1
    const entityC1 = await Entity.findOne({ code: 'C1' });
    if (!entityC1) {
      console.error('Entity C1 not found. Please run setup-workflow.js first.');
      process.exit(1);
    }
    console.log(`Found Entity C1: ${entityC1._id}`);

    // Find the FundRequest workflow
    const workflow = await AssignedWorkflow.findOne({ transactionType: 'FundRequest' });
    if (!workflow) {
      console.error('FundRequest workflow not found. Please run setup-workflow.js first.');
      process.exit(1);
    }
    console.log(`Found workflow: ${workflow._id}`);

    const createdUsers = [];

    for (const userData of testUsers) {
      // Find the role
      const role = await Role.findOne({ name: userData.roleName });
      if (!role) {
        console.error(`Role not found: ${userData.roleName}. Please run setup-workflow.js first.`);
        continue;
      }

      // Check if user already exists
      let user = await Admin.findOne({ email: userData.email });

      if (!user) {
        user = new Admin({
          email: userData.email,
          name: userData.name,
          phone: userData.phone,
          password: 'Test@123456',
          type: 'Admin',
          department: userData.department,
          roles: [role._id],
          entityRoles: [{
            entity: entityC1._id,
            roles: [role._id]
          }],
          entities: [entityC1._id],
          currentEntity: entityC1._id
        });
        await user.save();
        console.log(`Created user: ${userData.email} (${userData.name})`);
      } else {
        // Update existing user's roles and entity assignments
        user.roles = [role._id];
        user.entityRoles = [{
          entity: entityC1._id,
          roles: [role._id]
        }];
        user.entities = [entityC1._id];
        user.currentEntity = entityC1._id;
        await user.save();
        console.log(`Updated user: ${userData.email} (${userData.name})`);
      }

      createdUsers.push({ ...userData, userId: user._id });

      // Add user to workflow step if applicable
      if (userData.workflowLevel !== null) {
        const step = workflow.steps.find(s => s.level === userData.workflowLevel);
        if (step) {
          const alreadyAssigned = step.approvers.some(
            a => a.toString() === user._id.toString()
          );
          if (!alreadyAssigned) {
            step.approvers.push(user._id);
            console.log(`  -> Added to workflow step ${userData.workflowLevel} (${step.stepName})`);
          } else {
            console.log(`  -> Already assigned to workflow step ${userData.workflowLevel}`);
          }
        }
      }
    }

    // Save updated workflow
    await workflow.save();
    console.log('\nWorkflow updated with test approvers.');

    // Print summary
    console.log('\n========================================');
    console.log('TEST USERS CREATED SUCCESSFULLY');
    console.log('========================================');
    console.log('\nAll passwords: Test@123456\n');

    console.log('Users:');
    for (const u of createdUsers) {
      console.log(`  ${u.email.padEnd(25)} | ${u.name.padEnd(40)} | Role: ${u.roleName}`);
    }

    console.log(`\nWorkflow ID: ${workflow._id}`);
    console.log('\nWorkflow Steps:');
    for (const step of workflow.steps) {
      const approverCount = step.approvers.length;
      console.log(`  Step ${step.level}: ${step.stepName} (${approverCount} approver(s))`);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Seed failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedTestUsers();
