const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } = require('@aws-sdk/client-s3');
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

// Multipart upload (parallel). Same contract as r2.js: the browser PUTs
// parts directly, the server signs part URLs and completes via ListParts
// so no ETag CORS exposure is needed client-side.
async function createMultipartUpload(remoteKey, contentType) {
  const res = await s3Client.send(new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: remoteKey,
    ContentType: contentType || 'application/octet-stream'
  }));
  return res.UploadId;
}

async function getMultipartPartUploadUrl(remoteKey, uploadId, partNumber, expiresInSeconds = 3600) {
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: remoteKey,
    UploadId: uploadId,
    PartNumber: partNumber
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

async function completeMultipartUpload(remoteKey, uploadId) {
  const parts = [];
  let partNumberMarker;
  for (;;) {
    const res = await s3Client.send(new ListPartsCommand({
      Bucket: bucketName,
      Key: remoteKey,
      UploadId: uploadId,
      PartNumberMarker: partNumberMarker,
      MaxParts: 1000
    }));
    for (const p of (res.Parts || [])) {
      parts.push({ PartNumber: p.PartNumber, ETag: p.ETag });
    }
    if (!res.IsTruncated) break;
    partNumberMarker = res.NextPartNumberMarker;
  }
  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  if (parts.length === 0) {
    throw new Error('No uploaded parts found for multipart completion');
  }
  await s3Client.send(new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: remoteKey,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts }
  }));
}

async function abortMultipartUpload(remoteKey, uploadId) {
  await s3Client.send(new AbortMultipartUploadCommand({
    Bucket: bucketName,
    Key: remoteKey,
    UploadId: uploadId
  }));
}

module.exports = {
  init,
  uploadFile,
  downloadFile,
  getPresignedUrl,
  getStream,
  deleteFile,
  supportsMultipart: true,
  createMultipartUpload,
  getMultipartPartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload
};
