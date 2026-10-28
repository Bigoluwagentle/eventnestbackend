const mongoose = require('mongoose');

// A record of what a platform admin did, to whom, when and why. Append-only: the model refuses
// updates and deletes, and no endpoint offers them.
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, default: '' }, // snapshot, so the log stays readable if the account changes later

  action: { type: String, required: true, maxlength: 60 }, // e.g. organization.suspend, user.deactivate, report.resolved
  targetType: { type: String, enum: ['organization', 'user', 'report'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetLabel: { type: String, default: '' }, // name or email at the time, also a snapshot

  reason: { type: String, maxlength: 1000, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// Hooks without a `next` parameter that throw work on every Mongoose version.
const IMMUTABLE = 'Audit log entries cannot be changed or deleted';
auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function blockQueryChanges() {
    throw new Error(IMMUTABLE);
  }
);
auditLogSchema.pre('save', function blockResave() {
  if (!this.isNew) throw new Error(IMMUTABLE);
});
auditLogSchema.pre('deleteOne', { document: true, query: false }, function blockDocumentDelete() {
  throw new Error(IMMUTABLE);
});

module.exports = mongoose.model('AuditLog', auditLogSchema);