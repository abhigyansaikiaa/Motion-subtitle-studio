const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } = require('@aws-sdk/client-s3');
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
    forcePathStyle: true,
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

async function getPresignedUrl(remoteKey, expiresInSeconds = 3600, filename = null) {
  const params = {
    Bucket: bucketName,
    Key: remoteKey
  };
  if (filename) {
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

async function getPresignedUploadUrl(remoteKey, contentType, expiresInSeconds = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: remoteKey,
    ContentType: contentType
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

// ---------------------------------------------------------------------------
// Multipart upload (parallel, resumable-friendly). Used for large video
// uploads: the browser PUTs each part directly to R2 and the server only
// signs URLs + completes the upload. ETags are collected server-side via
// ListParts so the browser never needs to read ETag response headers
// (avoids bucket CORS expose-headers configuration).
// ---------------------------------------------------------------------------
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
  getPresignedUploadUrl,
  getStream,
  deleteFile,
  supportsMultipart: true,
  createMultipartUpload,
  getMultipartPartUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload
};
