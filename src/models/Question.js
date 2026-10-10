const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    text: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['approved', 'hidden', 'answered'], default: 'approved', index: true },

    upvoteCount: { type: Number, default: 0, min: 0 }, // incremented atomically with the QuestionVote insert
  },
  { timestamps: true }
);

// ranking query: this event's visible questions, most upvoted first
questionSchema.index({ event: 1, status: 1, upvoteCount: -1, createdAt: -1 });

module.exports = mongoose.model('Question', questionSchema);