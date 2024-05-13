const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    section: { type: mongoose.Schema.Types.ObjectId, required: true },
    video: { type: mongoose.Schema.Types.ObjectId, required: true },
    question: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOptions: [{ type: String }] // Array of option IDs
  });
  
  const Answer = mongoose.model('Answer', answerSchema);
  
  module.exports = Answer;