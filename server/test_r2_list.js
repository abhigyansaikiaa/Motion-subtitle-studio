require('dotenv').config();
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function listFiles() {
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

  try {
    const data = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
    console.log(`Found ${data.Contents?.length || 0} objects:`);
    if (data.Contents) {
      data.Contents.forEach(c => console.log(`- ${c.Key} (${c.Size} bytes)`));
    }
  } catch (err) {
    console.error('Error listing objects:', err.message);
  }
}

listFiles();
