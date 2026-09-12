require('dotenv').config();
const { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

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
  const Key = 'uploads/50651c18-b347-4d16-989d-accb5ef7c49d/c1f08936-1f97-4d2a-9eb6-c8efac8e34c5/1789203486610-cghln98.mp4';
  
  try {
    console.log('Listing...');
    const list = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: Key }));
    console.log('List Objects:', list.Contents ? list.Contents.map(c => c.Key) : 'None');
    
    console.log('Head Object...');
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
    console.log('Head Length:', head.ContentLength, 'Content-Type:', head.ContentType);
    
    console.log('Get Object...');
    const get = await s3.send(new GetObjectCommand({ Bucket, Key }));
    console.log('Get successful! Stream readable:', !!get.Body);
  } catch (err) {
    console.error('B2 Error:', err.name);
    console.error('Code:', err.Code || err.code);
    console.error('Message:', err.message);
    if (err.$metadata) console.error('Status:', err.$metadata.httpStatusCode);
  }
}

run();
