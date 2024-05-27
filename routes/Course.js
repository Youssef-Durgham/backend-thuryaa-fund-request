const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const Course = require("../model/course.js");
const Answer = require("../model/answer.js");


// create new course
router.post('/courses', async (req, res) => {
  try {
    const { title, description, category, imageUrl, pricingPlans, isActive, instructor } = req.body;

    // Validate pricingPlans to ensure they contain the new fields
    const validatedPricingPlans = pricingPlans.map(plan => ({
      planName: plan.planName,
      price: plan.price,
      projectFeatures: plan.projectFeatures, // Ensure project features are included
      basicFeatures: plan.basicFeatures, // Ensure basic features are included
      bonusFeatures: plan.bonusFeatures, // Ensure bonus features are included
      description: plan.description, // Ensure description is included
      texts: plan.texts // Ensure texts array is included
    }));

    const newCourse = new Course({
      title,
      description,
      category,
      imageUrl,
      pricingPlans: validatedPricingPlans,
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
router.post('/courses/newsection/:courseId/sections', async (req, res) => {
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
  
// Upload video in the section of the course
router.post('/courses/upload/:courseId/sections/:sectionId/videos', async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const { videoTitle, videoUrl, documents, duration } = req.body;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).send({ error: 'Course not found.' });
    }
    const section = course.sections.id(sectionId);
    if (!section) {
      return res.status(404).send({ error: 'Section not found.' });
    }
    section.videos.push({ videoTitle, videoUrl, documents, duration });
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

// get all section with its videos by course id
router.get('/api/courses/:courseId/sections', async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const course = await Course.findById(courseId).select('sections').exec();
  
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
  
      res.status(200).json(course.sections);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

// get sections with its videos
router.get('/courses/sections2/:courseId', async (req, res) => {
  try {
      const { courseId } = req.params;
      const course = await Course.findById(courseId).populate('sections.videos').exec();
      if (!course) {
          return res.status(404).json({ message: 'Course not found' });
      }
      res.status(200).json(course);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
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

// Get total duration for a section
router.get('/courses/duration/:courseId/sections/:sectionId', async (req, res) => {
  try {
    const { courseId, sectionId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).send({ error: 'Course not found.' });
    }
    const section = course.sections.id(sectionId);
    if (!section) {
      return res.status(404).send({ error: 'Section not found.' });
    }
    const duration = section.videos.reduce((total, video) => total + video.duration, 0);
    res.status(200).send({ sectionId, duration });
  } catch (error) {
    res.status(500).send({ error: 'Error fetching section duration' });
  }
});

// Get total duration for a course
router.get('/courses/duration/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).send({ error: 'Course not found.' });
    }
    const duration = course.sections.reduce((total, section) => {
      return total + section.videos.reduce((sectionTotal, video) => sectionTotal + video.duration, 0);
    }, 0);
    res.status(200).send({ courseId, duration });
  } catch (error) {
    res.status(500).send({ error: 'Error fetching course duration' });
  }
});

// get all plan price with discount for spisific course by id
router.get('/pricing/course/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id).populate('instructor').populate('students');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const currentDate = new Date();
    const pricingPlansWithDiscounts = course.pricingPlans.map(plan => {
      let discountValue = 0;

      course.discounts.forEach(discount => {
        if (discount.discountType === 'registrationCount' &&
            course.students.length >= discount.registrationCountThreshold &&
            (discount.currentUsages < discount.maxUsages || !discount.maxUsages)) {
          discountValue = Math.max(discountValue, discount.discountValue);
        } else if (discount.discountType === 'date' &&
                   currentDate >= discount.startDate && currentDate <= discount.endDate) {
          discountValue = Math.max(discountValue, discount.discountValue);
        }
      });

      const discountedPrice = plan.price * (1 - discountValue / 100);

      return {
        planName: plan.planName,
        features: plan.features,
        originalPrice: plan.price,
        discount: discountValue,
        discountedPrice: discountedPrice.toFixed(2),
      };
    });

    res.json(pricingPlansWithDiscounts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



module.exports = router;