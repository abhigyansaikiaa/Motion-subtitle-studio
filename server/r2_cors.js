require('dotenv').config();
const { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

async function run() {
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
  
  const Bucket = process.env.R2_BUCKET;
  
  try {
    const cors = await s3.send(new GetBucketCorsCommand({ Bucket }));
    console.log('Existing CORS:', JSON.stringify(cors.CORSRules, null, 2));
  } catch (err) {
    if (err.name === 'NoSuchCORSConfiguration') {
      console.log('No existing CORS configuration.');
    } else {
      console.error('Error getting CORS:', err.message);
    }
  }

  // Set new CORS rules
  const newRules = {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedOrigins: ['https://motion-subtitle-studio.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173'],
        ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Type']
      }
    ]
  };

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: newRules
    }));
    console.log('Successfully applied new CORS rules for R2.');
  } catch (err) {
    console.error('Error setting CORS:', err.message);
  }
}

run();
