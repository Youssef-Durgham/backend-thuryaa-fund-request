const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const Course = require("../model/course.js");
const Answer = require("../model/answer.js");


// create new course
router.post('/courses', async (req, res) => {
    try {
      const { title, description, category, imageUrl, pricingPlans, isActive, instructor } = req.body;
      const newCourse = new Course({
        title,
        description,
        category,
        imageUrl,
        pricingPlans,
        isActive,
        instructor
      });
      await newCourse.save();
      res.status(201).send(newCourse);
    } catch (error) {
      res.status(400).send(error);
    }
  });
  
  // create new sections in the course
  router.post('/courses/:courseId/sections', async (req, res) => {
    try {
      const { courseId } = req.params;
      const { sectionTitle, description } = req.body;
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).send({ error: 'Course not found.' });
      }
      course.sections.push({ sectionTitle, description });
      await course.save();
      res.status(201).send(course);
    } catch (error) {
      res.status(400).send(error);
    }
  });
  
  // upload video in the section of the course
  router.post('/courses/:courseId/sections/:sectionId/videos', async (req, res) => {
    try {
      const { courseId, sectionId } = req.params;
      const { videoTitle, videoUrl, documents } = req.body;
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).send({ error: 'Course not found.' });
      }
      const section = course.sections.id(sectionId);
      if (!section) {
        return res.status(404).send({ error: 'Section not found.' });
      }
      section.videos.push({ videoTitle, videoUrl, documents });
      await course.save();
      res.status(201).send(course);
    } catch (error) {
      res.status(400).send(error);
    }
  });

  // get all course avalible
router.get('/courses/list', async (req, res) => {
    try {
      // Find courses that are active and selectively project fields, including pricing plans
      const courses = await Course.find({ isActive: true })
                                  .select('-students -sections')
                                  .populate('pricingPlans'); // If necessary, adjust based on actual data structure needs
  
      const courseList = courses.map(course => {
        return {
          id: course._id,
          image: course.imageUrl,
          title: course.title,
          description: course.description,
          category: course.category,
          pricingPlans: course.pricingPlans.map(plan => ({ // Ensure you include pricing plan details
            planName: plan.planName,
            price: plan.price,
            features: plan.features
          })),
          activeDiscount: course.appliedDiscount // Assuming you handle discount calculation elsewhere
        };
      });
  
      res.status(200).send(courseList);
    } catch (error) {
      res.status(500).send({ error: 'Error fetching courses' });
    }
  });

  // api to return data for a one video
  router.get('/courses/:courseId/sections/:sectionId/videos/:videoId', async (req, res) => {
    try {
      const { courseId, sectionId, videoId } = req.params;
      const userId = req.query.userId; // User ID passed as query parameter for personalized response
  
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
  
      // Fetch answers for the questions in this video for the user
      const answers = await Answer.find({
        user: userId,
        course: courseId,
        section: sectionId,
        video: videoId
      }).lean();
  
      const videoWithAnswers = {
        ...video.toObject(),
        questions: video.questions.map(question => {
          const userAnswer = answers.find(answer => answer.question.toString() === question._id.toString());
          return {
            ...question.toObject(),
            userAnswer: userAnswer ? userAnswer.selectedOptions : []
          };
        })
      };
  
      res.status(200).send(videoWithAnswers);
    
  }catch (error) {
      res.status(500).send({ error: 'Error fetching video details' });
    }
  });


module.exports = router;