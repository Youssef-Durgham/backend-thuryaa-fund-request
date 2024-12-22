// routes/entityManagement.js
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const Entity = require('../../model/v2/Entity');
const { Admin } = require('../../model/Users');
const logActivity = require('../../utils/activityLogger');
const checkEntityAccess = require('../../utils/entityAccess');
const jwt = require('jsonwebtoken');
const ActivityLog = require('../../model/ActivityLog');

const router = express.Router();

// تطبيق Middleware على جميع المسارات في هذا الـ Router
router.use(checkEntityAccess);

// Check permissions middleware
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, 'your_jwt_secret');
      console.log(token, decoded)
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

// Create new entity
router.post('/entities', checkPermission('Create_Entity'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      code,
      type,
      fiscalYearStart,
      fiscalYearEnd,
      baseCurrency,
      parentEntity,
      taxIdentificationNumber,
      registrationNumber,
      legalName,
      address,
      contact,
      settings
    } = req.body;

    // Validate fiscal year dates
    const startDate = new Date(fiscalYearStart);
    const endDate = new Date(fiscalYearEnd);
    if (endDate <= startDate) {
      throw new Error('Fiscal year end date must be after start date');
    }

    const entity = new Entity({
      name,
      code,
      type,
      fiscalYearStart: startDate,
      fiscalYearEnd: endDate,
      baseCurrency,
      parentEntity,
      taxIdentificationNumber,
      registrationNumber,
      legalName,
      address,
      contact,
      settings,
      createdBy: req.adminId
    });

    await entity.save({ session });

    // Log activity
    await logActivity({
      action: 'Create_Entity',
      performedBy: req.adminId,
      targetItem: entity._id,
      itemType: 'Entity',
      description: `Created new entity: ${name}`
    }, session);

    await session.commitTransaction();
    res.status(201).json({
      message: 'Entity created successfully',
      entity
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error)
    res.status(500).json({ message: 'Error creating entity', error: error.message });
  } finally {
    session.endSession();
  }
});

// Get entity list with hierarchy
router.get('/entities', checkPermission('View_Entities'), async (req, res) => {
  try {
    const entities = await Entity.find({ status: 'Active' })
      .populate('parentEntity', 'name code')
      .populate('createdBy', 'name')
      .sort({ 'parentEntity': 1, 'name': 1 });

    // Build hierarchy
    const buildHierarchy = (items, parentId = null) => {
      return items
        .filter(item => 
          (parentId === null && !item.parentEntity) || 
          (item.parentEntity?._id?.toString() === parentId?.toString())
        )
        .map(item => ({
          ...item.toObject(),
          children: buildHierarchy(entities, item._id)
        }));
    };

    const hierarchicalEntities = buildHierarchy(entities);

    res.status(200).json(hierarchicalEntities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching entities', error: error.message });
  }
});

// Update entity
router.put('/entities/:id', checkPermission('Update_Entity'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    // Prevent circular parent reference
    if (updateData.parentEntity === id) {
      throw new Error('Entity cannot be its own parent');
    }

    const entity = await Entity.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true, session }
    );

    if (!entity) {
      throw new Error('Entity not found');
    }

    // Log activity
    await logActivity({
      action: 'Update_Entity',
      performedBy: req.adminId,
      targetItem: entity._id,
      itemType: 'Entity',
      description: `Updated entity: ${entity.name}`
    }, session);

    await session.commitTransaction();
    res.status(200).json({
      message: 'Entity updated successfully',
      entity
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error updating entity', error: error.message });
  } finally {
    session.endSession();
  }
});

// Archive entity
router.post('/entities/:id/archive', checkPermission('Archive_Entity'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    
    const entity = await Entity.findById(id).session(session);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // Check for active children
    const activeChildren = await Entity.exists({
      parentEntity: id,
      status: 'Active'
    }).session(session);

    if (activeChildren) {
      throw new Error('Cannot archive entity with active child entities');
    }

    entity.status = 'Archived';
    await entity.save({ session });

    // Log activity
    await logActivity({
      action: 'Archive_Entity',
      performedBy: req.adminId,
      targetItem: entity._id,
      itemType: 'Entity',
      description: `Archived entity: ${entity.name}`
    }, session);

    await session.commitTransaction();
    res.status(200).json({
      message: 'Entity archived successfully',
      entity
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error archiving entity', error: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/switch-entity', checkPermission('Switch_Entity'), async (req, res) => {
  const { entityId } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = await Admin.findById(req.adminId)
      .populate('entities')
      .session(session);
    
    const entity = admin.entities.find(e => 
      e._id.toString() === entityId && e.status === 'Active'
    );

    if (!entity) {
      throw new Error('Invalid entity or no access');
    }

    // Update admin's current entity
    admin.currentEntity = entity._id;
    await admin.save({ session });

    // Generate new token with updated current entity
    const token = jwt.sign({ 
      id: admin._id,
      userType: 'admin',
      phone: admin.phone,
      name: admin.name,
      currentEntity: entity._id
    }, process.env.TOKEN_SECRET, { expiresIn: '365d' });

    await new ActivityLog({
      action: 'switch_entity',
      performedBy: admin._id,
      targetItem: entityId,
      itemType: 'Entity',
      userType: 'Admin',
      entity: entityId
    }).save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: 'Entity switched successfully',
      token,
      currentEntity: entity
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

router.post('/assign-entity', checkPermission('Assign_Entity'), async (req, res) => {
  const { adminId, entityId } = req.body;
  console.log(req.body)
  try {
    const admin = await Admin.findById(adminId);
    const entity = await Entity.findById(entityId);

    if (!admin || !entity) {
      return res.status(404).json({ message: 'Admin or Entity not found' });
    }

    if (!admin.entities.includes(entityId)) {
      admin.entities.push(entityId);
      await admin.save();

      await new ActivityLog({
        action: 'assign_entity',
        performedBy: req.adminId,
        targetUser: adminId,
        targetItem: entityId,
        itemType: 'Admin-Activitys',
        userType: 'System',
        entity: entityId
      }).save();
    }

    res.status(200).json({ message: 'Entity assigned successfully' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/unassign-entity', checkPermission('Assign_Entity'), async (req, res) => {
  const { adminId, entityId } = req.body;
console.log(req.body)
  try {
    if (!ObjectId.isValid(adminId) || !ObjectId.isValid(entityId)) {
      return res.status(400).json({ message: 'Invalid adminId or entityId' });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
console.log(admin, req.body)
    const entityIndex = admin.entities.findIndex(entity => entity.toString() === entityId);
console.log(entityIndex)
    if (entityIndex === -1) {
      return res.status(400).json({ message: 'Entity not assigned to this admin' });
    }

    admin.entities.splice(entityIndex, 1);
    await admin.save();

    // Log the unassignment action
    await new ActivityLog({
      action: 'unassign_entity',
      performedBy: req.adminId,
      targetUser: adminId,
      targetItem: entityId,
      itemType: 'Admin-Activitys',
      userType: 'System',
      entity: entityId,
    }).save();

    res.status(200).json({ message: 'Entity unassigned successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




module.exports = router;