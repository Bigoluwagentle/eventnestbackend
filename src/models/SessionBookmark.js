const mongoose = require('mongoose');

const sessionBookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  },
  { timestamps: true }
);

sessionBookmarkSchema.index({ user: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('SessionBookmark', sessionBookmarkSchema);