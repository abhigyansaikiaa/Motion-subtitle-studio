const b2 = require('./b2');
const local = require('./local');

let provider;

function getProvider() {
  if (provider) return provider;
  
  const providerType = process.env.STORAGE_PROVIDER;
  
  if (providerType === 'b2') {
    provider = b2;
  } else if (providerType === 'r2') {
    provider = require('./r2');
  } else if (providerType === 'local') {
    provider = local;
  } else {
    // If not set, maybe default to local, but user said "STORAGE_PROVIDER must be explicit".
    throw new Error('STORAGE_PROVIDER must be explicitly set to "b2", "r2" or "local"');
  }
  
  return provider;
}

module.exports = {
  init: async () => await getProvider().init(),
  uploadFile: async (localPath, remoteKey) => await getProvider().uploadFile(localPath, remoteKey),
  downloadFile: async (remoteKey, localPath) => await getProvider().downloadFile(remoteKey, localPath),
  getPresignedUrl: async (remoteKey, expiresInSeconds, filename) => await getProvider().getPresignedUrl(remoteKey, expiresInSeconds, filename),
  getPresignedUploadUrl: async (remoteKey, contentType, expiresInSeconds) => await getProvider().getPresignedUploadUrl(remoteKey, contentType, expiresInSeconds),
  getStream: async (remoteKey, range) => await getProvider().getStream(remoteKey, range),
  deleteFile: async (remoteKey) => await getProvider().deleteFile(remoteKey),
  supportsMultipart: () => getProvider().supportsMultipart === true,
  createMultipartUpload: async (remoteKey, contentType) => {
    const p = getProvider();
    if (typeof p.createMultipartUpload !== 'function') throw new Error('Multipart upload not supported by storage provider');
    return p.createMultipartUpload(remoteKey, contentType);
  },
  getMultipartPartUploadUrl: async (remoteKey, uploadId, partNumber, expiresInSeconds) => {
    const p = getProvider();
    if (typeof p.getMultipartPartUploadUrl !== 'function') throw new Error('Multipart upload not supported by storage provider');
    return p.getMultipartPartUploadUrl(remoteKey, uploadId, partNumber, expiresInSeconds);
  },
  completeMultipartUpload: async (remoteKey, uploadId) => {
    const p = getProvider();
    if (typeof p.completeMultipartUpload !== 'function') throw new Error('Multipart upload not supported by storage provider');
    return p.completeMultipartUpload(remoteKey, uploadId);
  },
  abortMultipartUpload: async (remoteKey, uploadId) => {
    const p = getProvider();
    if (typeof p.abortMultipartUpload !== 'function') return; // best-effort
    return p.abortMultipartUpload(remoteKey, uploadId);
  },
  get type() { return process.env.STORAGE_PROVIDER; }
};
