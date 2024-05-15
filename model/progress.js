const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoContent', required: true },
  progressPercentage: { type: Number, required: true }, // 0 to 100
  progressMinutes: { type: Number, required: true } // in minutes
});

const UserProgress = mongoose.model('UserProgress', userProgressSchema);

module.exports = UserProgress;