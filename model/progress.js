const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  modulesCompleted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }],
  overallProgress: { type: Number, default: 0 } // percentage of the course completed
});

const Progress = mongoose.model('Progress', progressSchema);

module.exports = Progress;
