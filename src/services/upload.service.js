const crypto = require('crypto');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');
const Event = require('../models/Event');
const Speaker = require('../models/Speaker');

const ROOT = 'eventnest';
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function assertConfigured() {
  if (!isConfigured) {
    throw new AppError('Image uploads are not configured on this server', 503);
  }
}

async function assertOrgRole(userId, orgId, roles) {
  const membership = await OrganizationMember.findOne({ organization: orgId, user: userId });
  // 403 for non-members before any lookup, so org/event existence is never revealed
  if (!membership || !roles.includes(membership.role)) {
    throw new AppError('You do not have permission to upload images for this organization', 403);
  }
}

// For each purpose: who may upload, which folder the image must live in,
// and which document field it will be saved to.
const PURPOSES = {
  avatar: {
    field: 'avatar',
    async resolve(user) {
      return { folder: `${ROOT}/users/${user._id}`, doc: user };
    },
  },
  org_logo: {
    field: 'logo',
    async resolve(user, { orgId }) {
      await assertOrgRole(user._id, orgId, ['owner', 'admin']);
      const doc = await Organization.findById(orgId);
      if (!doc) throw new AppError('Organization not found', 404);
      return { folder: `${ROOT}/orgs/${doc._id}/logo`, doc };
    },
  },
  event_banner: {
    field: 'banner',
    async resolve(user, { orgId, eventId }) {
      await assertOrgRole(user._id, orgId, ['owner', 'admin', 'manager']);
      const doc = await Event.findOne({ _id: eventId, organization: orgId });
      if (!doc) throw new AppError('Event not found', 404);
      return { folder: `${ROOT}/orgs/${doc.organization}/events/${doc._id}`, doc };
    },
  },
  speaker_photo: {
    field: 'photo',
    async resolve(user, { orgId, speakerId }) {
      await assertOrgRole(user._id, orgId, ['owner', 'admin', 'manager']);
      const doc = await Speaker.findOne({ _id: speakerId, organization: orgId });
      if (!doc) throw new AppError('Speaker not found', 404);
      return { folder: `${ROOT}/orgs/${doc.organization}/speakers/${doc._id}`, doc };
    },
  },
};

async function resolveTarget(user, target) {
  const purpose = PURPOSES[target.purpose];
  const resolved = await purpose.resolve(user, target);
  return { ...resolved, field: purpose.field };
}

async function destroyQuietly(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch (err) {
    logger.warn(`Failed to delete image ${publicId}: ${err?.message || JSON.stringify(err)}`);
  }
}

async function createUploadSignature(user, target) {
  assertConfigured();
  const { folder } = await resolveTarget(user, target);

  // The server decides every signed parameter - the client never chooses what gets signed.
  const publicId = `${folder}/${crypto.randomBytes(12).toString('hex')}`;
  const paramsToSign = {
    timestamp: Math.floor(Date.now() / 1000), // Cloudinary accepts the signature for one hour
    public_id: publicId,
    allowed_formats: ALLOWED_FORMATS.join(','),
  };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    // the client must send exactly these fields, plus the file, as multipart form data
    fields: { ...paramsToSign, api_key: env.CLOUDINARY_API_KEY, signature },
    publicId,
    maxBytes: MAX_BYTES,
  };
}

async function attachUpload(user, target, publicId) {
  assertConfigured();
  const { folder, doc, field } = await resolveTarget(user, target);

  // The image must sit exactly in the folder this user is authorized for, with the
  // random 24-hex name we generated - no nesting, no traversal, no other tenant's files.
  const prefix = `${folder}/`;
  const leaf = publicId.startsWith(prefix) ? publicId.slice(prefix.length) : null;
  if (!leaf || !/^[a-f0-9]{24}$/.test(leaf)) {
    throw new AppError('Invalid image reference', 400);
  }

  // Never trust the client: ask Cloudinary whether the image really exists and what it is.
  let resource;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: 'image', type: 'upload' });
  } catch (err) {
    if (err?.http_code === 404) {
      throw new AppError('Image not found. Upload it to Cloudinary first, then try again.', 400);
    }
    logger.error(`Cloudinary lookup failed: ${err?.message || JSON.stringify(err)}`);
    throw new AppError('Could not verify the uploaded image. Please try again.', 502);
  }

  if (!ALLOWED_FORMATS.includes(resource.format) || resource.bytes > MAX_BYTES) {
    await destroyQuietly(publicId);
    throw new AppError(
      `Image must be ${ALLOWED_FORMATS.join('/')} and at most ${MAX_BYTES / (1024 * 1024)} MB`,
      400
    );
  }

  const previousPublicId = doc.get(`${field}.publicId`);
  doc.set(field, { url: resource.secure_url, publicId });
  await doc.save();

  // best-effort cleanup of the image being replaced (only ever our own folder tree)
  if (previousPublicId && previousPublicId !== publicId && previousPublicId.startsWith(`${ROOT}/`)) {
    await destroyQuietly(previousPublicId);
  }

  return { url: resource.secure_url, publicId };
}

module.exports = { createUploadSignature, attachUpload };