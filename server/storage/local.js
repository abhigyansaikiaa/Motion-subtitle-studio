const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const rootDir = path.join(__dirname, '..');
const MEDIA_SECRET = crypto.randomBytes(32).toString('hex');

async function init() {
  const uploadDir = path.join(rootDir, 'uploads');
  const outputDir = path.join(rootDir, 'outputs');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  console.log('Local storage provider initialized.');
}

async function uploadFile(localPath, remoteKey) {
  const targetPath = path.join(rootDir, remoteKey);
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  
  fs.copyFileSync(localPath, targetPath);
}

async function downloadFile(remoteKey, localPath) {
  const sourcePath = path.join(rootDir, remoteKey);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Local file not found: ${remoteKey}`);
  }
  
  const targetDir = path.dirname(localPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  
  fs.copyFileSync(sourcePath, localPath);
}

async function getPresignedUrl(remoteKey, expiresInSeconds = 3600) {
  const token = jwt.sign({ path: remoteKey }, MEDIA_SECRET, { expiresIn: expiresInSeconds });
  return `/api/local-storage/${encodeURIComponent(remoteKey)}?sig=${token}`;
}

function verifySignature(remoteKey, token) {
  try {
    const decoded = jwt.verify(token, MEDIA_SECRET);
    return decoded.path === remoteKey;
  } catch(e) {
    return false;
  }
}

async function deleteFile(remoteKey) {
  const targetPath = path.join(rootDir, remoteKey);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

module.exports = {
  init,
  uploadFile,
  downloadFile,
  getPresignedUrl,
  deleteFile,
  verifySignature
};
