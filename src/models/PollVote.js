const mongoose = require('mongoose');

const pollVoteSchema = new mongoose.Schema(
  {
    poll: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// THE duplicate-vote guard: the database rejects a second vote from the same user on the same poll
pollVoteSchema.index({ poll: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('PollVote', pollVoteSchema);