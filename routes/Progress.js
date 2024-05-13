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




router.post('/progress/update', async (req, res) => {
  const { userId, courseId, moduleId } = req.body;
  let progress = await Progress.findOne({ user: userId, course: courseId });
  if (!progress) {
    progress = new Progress({ user: userId, course: courseId, modulesCompleted: [] });
  }
  if (!progress.modulesCompleted.includes(moduleId)) {
    progress.modulesCompleted.push(moduleId);
    progress.overallProgress = (progress.modulesCompleted.length / totalModulesInCourse) * 100; // Assume totalModulesInCourse is known
    await progress.save();
  }
  res.status(200).send(progress);
});

// API to get progress
router.get('/progress/:userId/:courseId', async (req, res) => {
  const { userId, courseId } = req.params;
  const progress = await Progress.findOne({ user: userId, course: courseId });
  if (!progress) {
    return res.status(404).send({ error: 'Progress not found.' });
  }
  res.status(200).send(progress);
});



module.exports = router;