require('dotenv').config();
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

async function checkFile() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  
  const s3 = new S3Client({
    endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });

  const bucket = process.env.R2_BUCKET;
  const key = 'uploads/1788701951975/proj_1788797070217mx3q9/1788797070045-kypgd41.mp4';

  try {
    const data = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`File exists! Size: ${data.ContentLength} bytes`);
  } catch (err) {
    console.error('File not found or error:', err.message);
  }
}

checkFile();
