const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const Course = require("../model/course.js");
const { Post } = require("../model/Post.js");
const Progress = require("../model/progress.js");
const Answer = require("../model/answer.js");



// register to course
router.post('/courses/:courseId/register', async (req, res) => {
  const { courseId } = req.params;
  const { userId, couponCode } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course || !course.isActive) {
      return res.status(404).send({ error: 'Course not found or not active.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: 'User not found.' });
    }

    // Check if user is already registered
    if (course.students.includes(userId)) {
      return res.status(400).send({ error: 'User already registered for this course.' });
    }

    // Apply coupon if provided
    let finalPrice = course.price;
    if (couponCode) {
      const coupon = course.coupons.find(c => c.code === couponCode && new Date() <= c.validUntil && c.currentUsages < c.maxUsages);
      if (!coupon) {
        return res.status(400).send({ error: 'Invalid or expired coupon.' });
      }
      coupon.currentUsages++;
      finalPrice *= (1 - (coupon.discountPercentage / 100));
    }

    // Register user
    course.students.push(userId);
    await course.save();

    res.status(201).send({
      message: 'User successfully registered for the course.',
      finalPrice: finalPrice.toFixed(2)
    });
  } catch (error) {
    res.status(500).send({ error: 'Error registering for course' });
  }
});

router.get('/courses/:courseId/details', async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId)
      .populate('instructor', 'username') // Assuming you want to show instructor details
      .lean(); // Use lean to improve performance since we only read data

    if (!course) {
      return res.status(404).send({ error: 'Course not found.' });
    }

    // Calculate discounted price if there's an active discount
    let discountedPrice = course.price;
    let discountAmount = 0; // How much discount is applied
    let activeDiscountDetails = null;

    // Check for active discounts and apply the highest applicable discount
    if (course.discounts) {
      const currentDate = new Date();
      const applicableDiscounts = course.discounts.filter(discount => {
        const isDateValid = discount.startDate <= currentDate && discount.endDate >= currentDate;
        const isUsageValid = discount.currentUsages < (discount.maxUsages || Infinity);
        return isDateValid && isUsageValid;
      });

      const highestDiscount = applicableDiscounts.reduce((max, discount) => {
        return discount.discountValue > max ? discount.discountValue : max;
      }, 0);

      if (highestDiscount > 0) {
        discountAmount = (course.price * highestDiscount / 100);
        discountedPrice -= discountAmount;
        activeDiscountDetails = {
          discountPercentage: highestDiscount,
          discountAmount: discountAmount.toFixed(2)
        };
      }
    }

    res.status(200).send({
      id: course._id,
      title: course.title,
      description: course.description,
      category: course.category,
      originalPrice: course.price.toFixed(2),
      discountedPrice: discountedPrice.toFixed(2),
      numberOfStudents: course.students.length,
      activeDiscountDetails,
      instructorName: course.instructor.username, // Assuming instructor's username is what you want to show
    });
  } catch (error) {
    res.status(500).send({ error: 'Error fetching course details' });
  }
});


module.exports = router;