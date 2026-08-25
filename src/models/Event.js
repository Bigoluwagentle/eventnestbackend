const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
      // THE tenant boundary field for this collection - every query must filter by this
    },
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, maxlength: 10000, default: '' },
    shortDescription: { type: String, maxlength: 300, default: '' },
    category: {
      type: String,
      enum: [
        'conference',
        'tech',
        'hackathon',
        'meetup',
        'workshop',
        'concert',
        'corporate',
        'school',
        'church',
        'festival',
        'community',
        'other',
      ],
      required: true,
    },
    tags: [{ type: String, trim: true, lowercase: true }],

    banner: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },

    eventType: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      required: true,
    },
    location: {
      venueName: { type: String, default: null },
      address: { type: String, default: null },
      city: { type: String, default: null },
      country: { type: String, default: null },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    virtualLink: { type: String, default: null }, // shown only to registered attendees at controller level

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    timezone: { type: String, required: true, default: 'UTC' }, // IANA name, for display only

    capacity: {
      type: Number,
      default: null, // null = unlimited
      min: 1,
    },

    visibility: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'public',
      // public: shown in discovery. unlisted: accessible via direct link only. private: invite-only, not linkable publicly.
    },

    registrationDeadline: { type: Date, default: null },

    status: {
      type: String,
      enum: ['draft', 'published', 'registration_closed', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// slug unique per organization, not globally
eventSchema.index({ organization: 1, slug: 1 }, { unique: true });
// common discovery query pattern: public + published events sorted by date
eventSchema.index({ status: 1, visibility: 1, startDate: 1 });
eventSchema.index({ category: 1, status: 1 });

eventSchema.pre('validate', function validateDates(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);