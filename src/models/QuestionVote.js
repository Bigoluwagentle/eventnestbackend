const mongoose = require('mongoose');

const questionVoteSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// one upvote per user per question, enforced by the database
questionVoteSchema.index({ question: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('QuestionVote', questionVoteSchema);