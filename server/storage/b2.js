const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

let s3Client;
let bucketName;

async function init() {
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  bucketName = process.env.B2_BUCKET;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;

  if (!endpoint || !region || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error('B2 configuration missing required environment variables.');
  }

  s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  // Test connection
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (err) {
    throw new Error(`Failed to connect to B2 bucket "${bucketName}": ` + err.message);
  }
}

async function uploadFile(localPath, remoteKey) {
  const fileStream = fs.createReadStream(localPath);
  
  // Set appropriate content type based on extension
  let contentType = 'application/octet-stream';
  if (localPath.endsWith('.mp4')) contentType = 'video/mp4';
  if (localPath.endsWith('.png')) contentType = 'image/png';
  
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: remoteKey,
    Body: fileStream,
    ContentType: contentType
  }));
}

async function downloadFile(remoteKey, localPath) {
  const { Body } = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: remoteKey
  }));
  
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localPath);
    Body.pipe(writeStream);
    Body.on('error', reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function getPresignedUrl(remoteKey, expiresInSeconds = 3600) {
  const filename = remoteKey.split('/').pop();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: remoteKey,
    ResponseContentDisposition: `attachment; filename="${filename}"`
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

async function deleteFile(remoteKey) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: remoteKey
  }));
}

module.exports = {
  init,
  uploadFile,
  downloadFile,
  getPresignedUrl,
  deleteFile
};
