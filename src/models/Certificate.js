const mongoose = require('mongoose');

// No `timestamps` option on purpose: certificates are issued with bulk upserts, and automatic
// timestamps would bump updatedAt on already-issued certificates every time issuing is re-run.
const certificateSchema = new mongoose.Schema({
  // the public verification ID printed on the certificate, e.g. ENC-7K3Q-9XMD-4P2R
  certificateId: { type: String, required: true, unique: true },

  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Snapshot taken when the certificate is issued. A certificate is a record, so renaming
  // the event or the user later must not change what it says.
  recipientName: { type: String, required: true },
  eventName: { type: String, required: true },
  eventStartDate: { type: Date, required: true },
  eventEndDate: { type: Date, required: true },
  timezone: { type: String, default: 'UTC' },
  organizationName: { type: String, required: true },

  status: { type: String, enum: ['valid', 'revoked'], default: 'valid' },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedReason: { type: String, maxlength: 300, default: null },
});

// One VALID certificate per attendee per event. A revoked one stays as history, and a
// fresh one can be issued afterwards. This also makes concurrent "generate" clicks safe.
certificateSchema.index({ event: 1, user: 1 }, { unique: true, partialFilterExpression: { status: 'valid' } });
certificateSchema.index({ event: 1, issuedAt: -1 });
certificateSchema.index({ user: 1, issuedAt: -1 });

module.exports = mongoose.model('Certificate', certificateSchema);