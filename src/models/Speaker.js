const mongoose = require('mongoose');

const speakerSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 150 },
    photo: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    bio: { type: String, maxlength: 2000, default: '' },
    company: { type: String, maxlength: 150, default: '' },
    jobTitle: { type: String, maxlength: 150, default: '' },
    socialLinks: {
      twitter: { type: String, default: null },
      linkedin: { type: String, default: null },
      website: { type: String, default: null },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

speakerSchema.index({ organization: 1, name: 1 });

module.exports = mongoose.model('Speaker', speakerSchema);