const mongoose = require('mongoose');

// "I saved this event": one row per person per event.
const savedEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  createdAt: { type: Date, default: Date.now },
});

// a plain unique index (no partial filter): saving the same event twice can never create two rows
savedEventSchema.index({ user: 1, event: 1 }, { unique: true });
savedEventSchema.index({ user: 1, createdAt: -1 });
savedEventSchema.index({ event: 1 }); // lets deleting an event find its saves quickly

module.exports = mongoose.model('SavedEvent', savedEventSchema);