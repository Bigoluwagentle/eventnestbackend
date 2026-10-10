const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    question: { type: String, required: true, trim: true, maxlength: 300 },
    options: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 150 },
          voteCount: { type: Number, default: 0, min: 0 }, // incremented atomically, in a transaction with the PollVote insert
        },
      ],
      validate: [(v) => v.length >= 2 && v.length <= 10, 'A poll needs between 2 and 10 options'],
    },

    status: { type: String, enum: ['draft', 'open', 'closed'], default: 'draft', index: true },
    isAnonymous: { type: Boolean, default: false }, // voter identity is never exposed by the API when true

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

pollSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);