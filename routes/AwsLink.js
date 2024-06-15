const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

AWS.config.update({
    accessKeyId: "AKIA2A7TW4X33V7ZXGPN",
    secretAccessKey: "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",
    region: "me-south-1",
  });
  
  const s3 = new AWS.S3();

router.get('/s3/signed-url', async (req, res) => {
  const { filename, filetype } = req.query;
  const s3Params = {
    Bucket: 'taxi-app-najaf3',
    Key: filename,
    Expires: 60, // Expires in 60 seconds
    ContentType: filetype,
    ACL: 'public-read' // or another ACL according to your requirements
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if (err) {
      console.log('Error getting signed URL', err);
      return res.status(500).json({ success: false, error: 'Server Error' });
    }
    const url = `https://${s3Params.Bucket}.s3.me-south-1.amazonaws.com/${encodeURIComponent(filename)}`;
    res.json({ signedUrl: data, url, key: filename });
  });
});

module.exports = router;
