const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const UserProgress = require("../model/progress.js");




// Save user progress for a video
router.post('/progress', async (req, res) => {
  const { userId, courseId, videoId, progressPercentage, progressMinutes } = req.body;

  try {
    let progress = await UserProgress.findOne({ user: userId, course: courseId, video: videoId });

    if (progress) {
      // Update existing progress
      progress.progressPercentage = progressPercentage;
      progress.progressMinutes = progressMinutes;
    } else {
      // Create new progress
      progress = new UserProgress({ user: userId, course: courseId, video: videoId, progressPercentage, progressMinutes });
    }

    await progress.save();
    res.status(200).json({ message: 'Progress saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while saving progress' });
  }
});

// Get user progress for a specific course
router.get('/progress/course/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const { userId } = req.query;

  try {
    const progress = await UserProgress.find({ user: userId, course: courseId });

    if (!progress.length) {
      return res.status(404).json({ message: 'No progress found for this course' });
    }

    const totalVideos = await VideoContent.countDocuments({ course: courseId });
    const totalProgress = progress.reduce((acc, p) => acc + p.progressPercentage, 0);
    const courseProgressPercentage = totalProgress / totalVideos;

    res.status(200).json({ courseProgressPercentage });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while retrieving course progress' });
  }
});

// Get user progress for a specific video
router.get('/progress/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.query;

  try {
    const progress = await UserProgress.findOne({ user: userId, video: videoId });

    if (!progress) {
      return res.status(404).json({ message: 'No progress found for this video' });
    }

    res.status(200).json(progress);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while retrieving video progress' });
  }
});



module.exports = router;