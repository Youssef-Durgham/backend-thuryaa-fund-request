const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

AWS.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  region: process.env.S3_REGION,
});

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET_NAME;

// Upload: get a presigned URL to upload a file (private, no ACL)
router.get('/s3/signed-url', async (req, res) => {
  const { filename, filetype } = req.query;
  const s3Params = {
    Bucket: BUCKET,
    Key: filename,
    Expires: 60,
    ContentType: filetype,
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if (err) {
      console.log('Error getting signed URL', err);
      return res.status(500).json({ success: false, error: 'Server Error' });
    }
    const url = `https://${BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${filename}`;
    res.json({ signedUrl: data, key: filename, url });
  });
});

// Download: get a presigned URL to view/download a private file
router.get('/s3/get-url', async (req, res) => {
  const { key } = req.query;
  const s3Params = {
    Bucket: BUCKET,
    Key: key,
    Expires: 3600, // link valid for 1 hour
  };

  s3.getSignedUrl('getObject', s3Params, (err, data) => {
    if (err) {
      console.log('Error getting signed URL', err);
      return res.status(500).json({ success: false, error: 'Server Error' });
    }
    res.json({ url: data });
  });
});

module.exports = router;
