const mongoose = require('mongoose');

const EVENT_PERMISSIONS = [
  'check_in', // scan/validate tickets at the door
  'view_attendees', // see attendee list and lookup
  'manage_schedule', // create/edit sessions
  'send_announcements', // post live announcements
  'manage_questions', // moderate Q&A
  'view_analytics', // see event reports
];

const eventStaffSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    permissions: {
      type: [{ type: String, enum: EVENT_PERMISSIONS }],
      default: ['check_in'],
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

eventStaffSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('EventStaff', eventStaffSchema);
module.exports.EVENT_PERMISSIONS = EVENT_PERMISSIONS;