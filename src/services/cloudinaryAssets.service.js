const crypto = require('crypto');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');

// Shared helpers for hosted images. (The avatar/logo/banner flow in upload.service.js has its own
// copy of the first few of these; they can be merged in a later tidy-up.)
const ROOT = 'eventnest';
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function assertConfigured() {
  if (!isConfigured) {
    throw new AppError('Image uploads are not configured on this server', 503);
  }
}

// A signed ticket for ONE upload into `folder`. The server chooses every signed parameter,
// including the exact public id, so the client cannot influence what gets signed.
function buildUploadTicket(folder) {
  const publicId = `${folder}/${crypto.randomBytes(12).toString('hex')}`;
  const paramsToSign = {
    timestamp: Math.floor(Date.now() / 1000), // Cloudinary accepts the signature for one hour
    public_id: publicId,
    allowed_formats: ALLOWED_FORMATS.join(','),
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    fields: { ...paramsToSign, api_key: env.CLOUDINARY_API_KEY, signature },
    publicId,
    maxBytes: MAX_BYTES,
  };
}

// Looks up many uploaded images with ONE Admin API call (it accepts up to 100 ids).
// Ids that were never uploaded are simply missing from the returned Map.
async function fetchImages(publicIds) {
  try {
    const result = await cloudinary.api.resources_by_ids(publicIds, { resource_type: 'image', type: 'upload' });
    return new Map((result.resources || []).map((resource) => [resource.public_id, resource]));
  } catch (err) {
    logger.error(`Cloudinary lookup failed: ${err?.message || JSON.stringify(err)}`);
    throw new AppError('Could not verify the uploaded images. Please try again.', 502);
  }
}

async function destroyQuietly(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch (err) {
    logger.warn(`Failed to delete image ${publicId}: ${err?.message || JSON.stringify(err)}`);
  }
}

// Delivery URLs are built from the public id when needed, so nothing stale is ever stored.
function imageUrls(publicId) {
  const build = (options) => cloudinary.url(publicId, { secure: true, resource_type: 'image', type: 'upload', ...options });
  return {
    url: build({ width: 2000, crop: 'limit', fetch_format: 'auto', quality: 'auto' }),
    thumbnailUrl: build({ width: 480, height: 360, crop: 'fill', gravity: 'auto', fetch_format: 'auto', quality: 'auto' }),
    downloadUrl: build({ flags: 'attachment' }), // original quality, saved as a file
  };
}

module.exports = {
  ROOT, ALLOWED_FORMATS, MAX_BYTES, assertConfigured, buildUploadTicket, fetchImages, destroyQuietly, imageUrls,
};