const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 3000, default: '' },

    type: {
      type: String,
      enum: ['keynote', 'workshop', 'session', 'panel', 'break'],
      default: 'session',
    },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    location: { type: String, default: '' },
    capacity: { type: Number, default: null, min: 1 },

    speakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Speaker' }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

sessionSchema.index({ event: 1, startTime: 1 });

sessionSchema.pre('validate', function validateTimes(next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    return next(new Error('Session end time must be after start time'));
  }
  next();
});

module.exports = mongoose.model('Session', sessionSchema);