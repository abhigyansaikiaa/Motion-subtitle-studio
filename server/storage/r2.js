const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

let s3Client;
let bucketName;

async function init() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  bucketName = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 configuration missing required environment variables.');
  }

  // Cloudflare R2 always uses the "auto" region
  s3Client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  // Test connection
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (err) {
    throw new Error(`Failed to connect to R2 bucket "${bucketName}": ` + err.message);
  }
}

async function uploadFile(localPath, remoteKey) {
  const fileStream = fs.createReadStream(localPath);
  
  // Set appropriate content type based on extension
  let contentType = 'application/octet-stream';
  if (localPath.endsWith('.mp4')) contentType = 'video/mp4';
  if (localPath.endsWith('.png')) contentType = 'image/png';
  if (localPath.endsWith('.mov')) contentType = 'video/quicktime';
  if (localPath.endsWith('.webm')) contentType = 'video/webm';
  
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
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: remoteKey
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

async function getStream(remoteKey, range = undefined) {
  const params = {
    Bucket: bucketName,
    Key: remoteKey
  };
  if (range) {
    params.Range = range;
  }
  
  const response = await s3Client.send(new GetObjectCommand(params));
  return {
    stream: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    contentRange: response.ContentRange,
    acceptRanges: response.AcceptRanges
  };
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
  getStream,
  deleteFile
};
