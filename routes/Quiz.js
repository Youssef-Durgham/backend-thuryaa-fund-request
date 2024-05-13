const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const Course = require("../model/course.js");
const { Post } = require("../model/Post.js");
const Quiz = require("../model/Quiz.js");
const Progress = require("../model/progress.js");
const Answer = require("../model/answer.js");



  // api to make quize
  router.post('/submit-quiz', async (req, res) => {
    const { quizId, answers } = req.body;
    const quiz = await Quiz.findById(quizId);
    let score = 0;
    let feedback = [];
  
    quiz.questions.forEach(question => {
      if (answers[question._id.toString()] === question.correctAnswer) {
        score++;
      } else {
        feedback.push({ question: question.questionText, yourAnswer: answers[question._id.toString()], correctAnswer: question.correctAnswer });
      }
    });
  
    res.status(200).send({ score: `${score} out of ${quiz.questions.length}`, feedback });
  });

  // api to make multi chose question
router.post('/courses/:courseId/sections/:sectionId/videos/:videoId/questions', async (req, res) => {
    try {
      const { courseId, sectionId, videoId } = req.params;
      const questions = req.body.questions; // Expecting an array of questions
  
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).send({ error: 'Course not found.' });
      }
      
      const section = course.sections.id(sectionId);
      if (!section) {
        return res.status(404).send({ error: 'Section not found.' });
      }
  
      const video = section.videos.id(videoId);
      if (!video) {
        return res.status(404).send({ error: 'Video not found.' });
      }
  
      questions.forEach(question => {
        video.questions.push(question); // Add each new question to the video
      });
  
      await course.save();
      res.status(201).send({ video: video });
    } catch (error) {
      res.status(400).send(error);
    }
  });

  // save answer for the questions
router.post('/courses/:courseId/sections/:sectionId/videos/:videoId/questions/:questionId/answer', async (req, res) => {
    try {
      const { userId } = req.body; // Assume userId is passed along with the answer
      const { courseId, sectionId, videoId, questionId } = req.params;
      const { selectedOptions } = req.body;
  
      let answer = await answer.findOne({
        user: userId,
        course: courseId,
        section: sectionId,
        video: videoId,
        question: questionId
      });
  
      if (answer) {
        // If answer exists, update it
        answer.selectedOptions = selectedOptions;
      } else {
        // If no answer, create a new one
        answer = new answer({
          user: userId,
          course: courseId,
          section: sectionId,
          video: videoId,
          question: questionId,
          selectedOptions: selectedOptions
        });
      }
  
      await answer.save();
      res.status(201).send({ answer });
    } catch (error) {
      res.status(400).send(error);
    }
  });


module.exports = router;