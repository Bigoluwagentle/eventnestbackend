const mongoose = require('mongoose');

// One collection for everything in a gallery. `type` says which of photo / video / resource applies.
// No automatic `timestamps`: photos are inserted with bulk upserts, and automatic timestamps would
// bump updatedAt on already-attached photos every time an attach request is repeated.
const galleryItemSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

  type: { type: String, enum: ['photo', 'video', 'resource'], required: true },
  title: { type: String, trim: true, maxlength: 150, default: '' },
  caption: { type: String, trim: true, maxlength: 500, default: '' },

  // hosted photo (Cloudinary). Delivery URLs are built from publicId when read, never stored.
  photo: {
    publicId: String,
    width: Number,
    height: Number,
    bytes: Number,
    format: String,
  },

  // YouTube / Vimeo: only the id is stored, and links are rebuilt from it
  video: {
    provider: { type: String, enum: ['youtube', 'vimeo'] },
    videoId: String,
    hash: String,
  },

  // a link to slides, a document, a folder... (https only, checked before saving)
  resource: {
    url: String,
  },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// listing an event's gallery in a stable order (oldest first, so pages don't shift when items are added)
galleryItemSchema.index({ event: 1, createdAt: 1 });
galleryItemSchema.index({ event: 1, type: 1, createdAt: 1 });
// a photo can be attached only once, which makes a repeated attach request harmless
galleryItemSchema.index(
  { 'photo.publicId': 1 },
  { unique: true, partialFilterExpression: { 'photo.publicId': { $type: 'string' } } }
);

// A hook with no `next` parameter that throws on bad data works on every Mongoose version
// (newer versions no longer pass a `next` callback to hooks at all).
galleryItemSchema.pre('validate', function checkContent() {
  if (this.type === 'photo' && !(this.photo && this.photo.publicId)) {
    throw new Error('A photo needs an uploaded image');
  }
  if (this.type === 'video' && !(this.video && this.video.provider && this.video.videoId)) {
    throw new Error('A video needs a provider and a video id');
  }
  if (this.type === 'resource' && !(this.resource && this.resource.url && this.title)) {
    throw new Error('A resource needs a title and a link');
  }
});

module.exports = mongoose.model('GalleryItem', galleryItemSchema);