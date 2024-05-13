const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: String,
    options: [String],
    correctAnswer: String,
    questionType: { type: String, enum: ['multipleChoice', 'trueFalse', 'fillBlank'], default: 'multipleChoice' }
  });
  
  const quizSchema = new mongoose.Schema({
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: [questionSchema]
  });
  
  const Quiz = mongoose.model('Quiz', quizSchema);
  

module.exports = Quiz;