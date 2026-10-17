const GalleryItem = require('../models/GalleryItem');
const Event = require('../models/Event');
const OrganizationMember = require('../models/OrganizationMember');
const AppError = require('../utils/AppError');
const { canAccessEvent } = require('../utils/eventParticipation');
const { parseVideoUrl, videoLinks } = require('../utils/videoLinks');
const eventService = require('./event.service');
const assets = require('./cloudinaryAssets.service');

const MAX_ITEMS_PER_EVENT = 500;

const photoFolder = (event) => `${assets.ROOT}/orgs/${event.organization}/events/${event._id}/gallery`;

// What clients see. Never includes who uploaded it or the organization.
function serialize(item) {
  const base = { _id: item._id, type: item.type, title: item.title, caption: item.caption, createdAt: item.createdAt };

  if (item.type === 'photo') {
    return { ...base, photo: { ...assets.imageUrls(item.photo.publicId), width: item.photo.width, height: item.photo.height } };
  }
  if (item.type === 'video') {
    const { provider, videoId, hash } = item.video;
    return { ...base, video: { provider, videoId, ...videoLinks({ provider, videoId, hash }) } };
  }
  return { ...base, resource: { url: item.resource.url } };
}

async function assertRoomFor(event, adding) {
  const existing = await GalleryItem.countDocuments({ event: event._id });
  if (existing + adding > MAX_ITEMS_PER_EVENT) {
    throw new AppError(`A gallery can hold at most ${MAX_ITEMS_PER_EVENT} items`, 400);
  }
}

async function listItems(event, { page, limit, type }) {
  const filter = { event: event._id };
  if (type) filter.type = type;

  const [items, total, countRows] = await Promise.all([
    GalleryItem.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    GalleryItem.countDocuments(filter),
    GalleryItem.aggregate([{ $match: { event: event._id } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);

  const counts = { photo: 0, video: 0, resource: 0, ...Object.fromEntries(countRows.map((r) => [r._id, r.count])) };
  return { items: items.map(serialize), counts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

// ---------- organizer side ----------

async function listForManagement(event, query) {
  return { access: event.galleryAccess || 'private', ...(await listItems(event, query)) };
}

async function updateAccess(event, access) {
  await Event.findByIdAndUpdate(event._id, { $set: { galleryAccess: access } });
  return { access };
}

async function createPhotoUploadTickets(event, count) {
  assets.assertConfigured();
  await assertRoomFor(event, count);
  const folder = photoFolder(event);
  return { tickets: Array.from({ length: count }, () => assets.buildUploadTicket(folder)) };
}

async function attachPhotos(event, userId, photos) {
  assets.assertConfigured();

  // the same upload listed twice in one request counts once
  const byId = new Map();
  photos.forEach((photo) => {
    if (!byId.has(photo.publicId)) byId.set(photo.publicId, photo);
  });
  const ids = [...byId.keys()];

  // Every image must sit exactly in THIS event's gallery folder with the random name we issued:
  // no other event's files, no other organization's, no nesting or traversal.
  const prefix = `${photoFolder(event)}/`;
  const invalid = ids.filter((id) => {
    const leaf = id.startsWith(prefix) ? id.slice(prefix.length) : null;
    return !leaf || !/^[a-f0-9]{24}$/.test(leaf);
  });
  if (invalid.length) throw new AppError('Invalid image reference', 400, invalid);

  // photos attached earlier are not touched again, so repeating a request is harmless
  const attached = await GalleryItem.find({ 'photo.publicId': { $in: ids } }).select('photo.publicId').lean();
  const known = new Set(attached.map((item) => item.photo.publicId));
  const fresh = ids.filter((id) => !known.has(id));

  let added = 0;
  if (fresh.length) {
    await assertRoomFor(event, fresh.length);

    // never trust the client: ask Cloudinary what was really uploaded (one call for the whole batch)
    const found = await assets.fetchImages(fresh);
    const missing = fresh.filter((id) => !found.has(id));
    if (missing.length) {
      throw new AppError('Some photos were not found on the image host. Upload them first, then try again.', 400, missing);
    }

    const rejected = fresh.filter((id) => {
      const image = found.get(id);
      return !assets.ALLOWED_FORMATS.includes(image.format) || image.bytes > assets.MAX_BYTES;
    });
    if (rejected.length) {
      await Promise.all(rejected.map((id) => assets.destroyQuietly(id)));
      throw new AppError(
        `Photos must be ${assets.ALLOWED_FORMATS.join('/')} files of at most ${assets.MAX_BYTES / (1024 * 1024)} MB`,
        400,
        rejected
      );
    }

    // upsert keyed on the public id: a repeat or a race can never create a second copy
    const now = new Date();
    const operations = fresh.map((publicId) => {
      const image = found.get(publicId);
      return {
        updateOne: {
          filter: { 'photo.publicId': publicId },
          update: {
            $setOnInsert: {
              event: event._id,
              organization: event.organization,
              type: 'photo',
              title: '',
              caption: byId.get(publicId).caption || '',
              'photo.width': image.width,
              'photo.height': image.height,
              'photo.bytes': image.bytes,
              'photo.format': image.format,
              uploadedBy: userId,
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      };
    });
    const result = await GalleryItem.bulkWrite(operations, { ordered: false });
    added = result.upsertedCount;
  }

  const items = await GalleryItem.find({ event: event._id, 'photo.publicId': { $in: ids } })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return { added, items: items.map(serialize) };
}

async function addVideo(event, userId, { url, title, caption }) {
  const video = parseVideoUrl(url);
  if (!video) throw new AppError('Only YouTube and Vimeo links are supported', 400);

  await assertRoomFor(event, 1);
  const item = await GalleryItem.create({
    event: event._id,
    organization: event.organization,
    type: 'video',
    title: title || '',
    caption: caption || '',
    video,
    uploadedBy: userId,
  });
  return serialize(item);
}

async function addResource(event, userId, { title, url, description }) {
  await assertRoomFor(event, 1);
  const item = await GalleryItem.create({
    event: event._id,
    organization: event.organization,
    type: 'resource',
    title,
    caption: description || '',
    resource: { url },
    uploadedBy: userId,
  });
  return serialize(item);
}

async function updateItem(event, itemId, { title, caption }) {
  const item = await GalleryItem.findOne({ _id: itemId, event: event._id });
  if (!item) throw new AppError('Gallery item not found', 404);

  if (title !== undefined) {
    if (item.type === 'resource' && !title) throw new AppError('A resource needs a title', 400);
    item.title = title;
  }
  if (caption !== undefined) item.caption = caption;
  item.updatedAt = new Date();

  await item.save();
  return serialize(item);
}

async function deleteItem(event, itemId) {
  const item = await GalleryItem.findOneAndDelete({ _id: itemId, event: event._id });
  if (!item) throw new AppError('Gallery item not found', 404);

  // also remove the hosted file (only ever inside our own folder tree)
  if (item.type === 'photo' && item.photo && item.photo.publicId && item.photo.publicId.startsWith(`${assets.ROOT}/`)) {
    await assets.destroyQuietly(item.photo.publicId);
  }
}

// ---------- attendee / public side ----------

/**
 * Who may see the gallery is the organizer's choice (event.galleryAccess):
 *   public    - anyone who can see the event page
 *   attendees - confirmed attendees, event staff and organization members
 *   private   - organization members only (the default, so nothing shows while the organizer is curating)
 */
async function getPublicGallery(orgSlug, eventSlug, user, query) {
  const event = await eventService.getPublicEventBySlug(orgSlug, eventSlug);
  const access = event.galleryAccess || 'private';

  if (access !== 'public') {
    if (!user) throw new AppError('Log in to view this gallery', 401);

    if (access === 'attendees') {
      if (!(await canAccessEvent(user._id, event._id))) {
        throw new AppError('This gallery is only available to people who registered for this event', 403);
      }
    } else if (!(await OrganizationMember.exists({ organization: event.organization._id, user: user._id }))) {
      throw new AppError('The organizer has not shared this gallery yet', 403);
    }
  }

  return { access, ...(await listItems(event, query)) };
}

module.exports = {
  listForManagement,
  updateAccess,
  createPhotoUploadTickets,
  attachPhotos,
  addVideo,
  addResource,
  updateItem,
  deleteItem,
  getPublicGallery,
};