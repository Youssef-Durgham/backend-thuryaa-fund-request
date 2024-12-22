const jwt = require('jsonwebtoken');
const { Admin } = require('../model/Users');
const Entity = require('../model/v2/Entity');
const JWT_SECRET ='your_jwt_secret';


const checkEntityAccess = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No auth token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(decoded.id)
      .populate('currentEntity')
      .populate({
        path: 'roles',
        match: { entity: decoded.currentEntity }
      });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (admin.type === 'System') {
      // System user has access to all entities
      req.entity = { name: 'All Entities' }; // Placeholder for system user
      req.adminId = admin._id;
      req.entityRoles = []; // System user doesn't need specific entity roles
      return next();
    }


    req.entity = admin.currentEntity;
    req.adminId = admin._id;
    req.entityRoles = admin.roles;

    next();
  } catch (error) {
    console.error('Error in entityAccess middleware:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


module.exports = checkEntityAccess;
