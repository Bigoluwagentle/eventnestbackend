const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  targetType: { type: String, enum: ['event', 'organization', 'user'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

  reason: { type: String, enum: ['spam', 'scam', 'inappropriate', 'harassment', 'copyright', 'other'], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },

  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' },
  resolution: { type: String, trim: true, maxlength: 1000, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
});

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
// Race guard: one OPEN report per person per target, even if two requests arrive together.
// (Plain equality, the form every MongoDB version accepts for a partial index. The service also checks
// reports that are already under review.)
reportSchema.index(
  { reporter: 1, targetType: 1, targetId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

module.exports = mongoose.model('Report', reportSchema);