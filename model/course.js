const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  optionText: { type: String, required: true },
  isCorrect: { type: Boolean, required: true, default: false }
});

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [optionSchema],
  explanation: { type: String } // Optional field for providing an explanation after the question is answered
});

const videoContentSchema = new mongoose.Schema({
  videoTitle: { type: String, required: true },
  videoUrl: { type: String, required: true },
  documents: [String], // URLs to documents
  duration: { type: Number, required: true }, // Duration in seconds
  questions: [questionSchema] // Using the new questionSchema for quiz questions
});

const sectionSchema = new mongoose.Schema({
  sectionTitle: { type: String, required: true },
  description: { type: String },
  videos: [videoContentSchema] // Array of videos within this section
});

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true },
  discountPercentage: { type: Number, required: true }, // Example: 20 for a 20% discount
  validUntil: { type: Date, required: true },
  maxUsages: { type: Number, required: true }, // Maximum number of times the coupon can be used
  currentUsages: { type: Number, default: 0 } // Number of times the coupon has already been used
});

const discountSchema = new mongoose.Schema({
  discountType: { type: String, enum: ['date', 'registrationCount'], required: true },
  discountValue: { type: Number, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  registrationCountThreshold: { type: Number },
  maxUsages: { type: Number }, // Maximum number of usages allowed for this discount
  currentUsages: { type: Number, default: 0 } // Track how many times the discount has been used
});

const pricingPlanSchema = new mongoose.Schema({
  planName: { type: String, required: true },
  price: { type: Number, required: true },
  features: [String] // List of features included in this plan
});


const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  pricingPlans: [pricingPlanSchema],
  discounts: [discountSchema],
  isActive: { type: Boolean, default: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  sections: [sectionSchema],
  coupons: [couponSchema],
  imageUrl: { type: String, required: false },
});

// Middleware to update the updatedAt field and check for discounts
courseSchema.pre('save', function(next) {
  const currentDate = new Date();
  this.discounts.forEach(discount => {
    if (discount.discountType === 'registrationCount' &&
        this.students.length >= discount.registrationCountThreshold &&
        (discount.currentUsages < discount.maxUsages || !discount.maxUsages)) {
      discount.currentUsages++;
      if (this.appliedDiscount < discount.discountValue) {
        this.appliedDiscount = discount.discountValue;
      }
    } else if (discount.discountType === 'date' &&
               currentDate >= discount.startDate && currentDate <= discount.endDate &&
               this.appliedDiscount < discount.discountValue) {
      this.appliedDiscount = discount.discountValue;
    }
  });

  next();
});


const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
