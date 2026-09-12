require('dotenv').config();
const { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

async function run() {
  const s3 = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY
    }
  });
  
  const Bucket = process.env.B2_BUCKET;
  
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
        AllowedOrigins: ['*'],
        ExposeHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Type']
      }
    ]
  };

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: newRules
    }));
    console.log('Successfully applied new CORS rules.');
  } catch (err) {
    console.error('Error setting CORS:', err.message);
  }
}

run();
