const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, maxlength: 1000, default: '' },
    logo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    website: { type: String, default: null },
    socialLinks: {
      twitter: { type: String, default: null },
      linkedin: { type: String, default: null },
      instagram: { type: String, default: null },
      facebook: { type: String, default: null },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      // convenience pointer to the current owner for fast lookups;
      // source of truth for permissions is still OrganizationMember
    },
    settings: {
      isPublic: { type: Boolean, default: true }, // whether org page/events are publicly discoverable
    },
    status: {
      type: String,
      enum: ['active', 'suspended'], // super_admin can suspend an org for abuse
      default: 'active',
    },
  },
  { timestamps: true }
);

organizationSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('Organization', organizationSchema);