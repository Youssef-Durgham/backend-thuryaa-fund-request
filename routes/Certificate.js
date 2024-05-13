const router = require("express").Router();
const User = require("../model/Users.js");
const jwt = require("jsonwebtoken");
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const Course = require("../model/course.js");
const Progress = require("../model/progress.js");


async function createCertificate(userName, courseId) {
  const existingPdfBytes = fs.readFileSync('./template/CertificateTemplate.pdf'); // Assume a pre-designed template exists
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const fontSize = 24;

  page.drawText(`Certificate of Completion`, { x: 50, y: height - 100, size: fontSize + 6, color: rgb(0.2, 0.1, 0.1) });
  page.drawText(`This certifies that ${userName}`, { x: 50, y: height - 150, size: fontSize, color: rgb(0, 0, 0) });
  page.drawText(`has successfully completed the course: ${courseId}.`, { x: 50, y: height - 180, size: fontSize, color: rgb(0, 0, 0) });

  const pdfBytes = await pdfDoc.save();

  return pdfBytes;
}

// api to make certificate
router.get('/certificate/:userId/:courseId', async (req, res) => {
  const { userId, courseId } = req.params;
  const user = await User.findById(userId);
  const progress = await Progress.findOne({ user: userId, course: courseId });

  if (!progress || progress.overallProgress < 100) {
    return res.status(400).send({ error: 'Certificate cannot be generated. Course not completed.' });
  }

  const pdfBytes = await createCertificate(user.username, courseId);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdfBytes);
});


module.exports = router;