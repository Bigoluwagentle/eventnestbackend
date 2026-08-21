const mongoose = require('mongoose');

// We store a hash of each issued refresh token (never the raw token) so we can:
// - revoke a specific session (logout)
// - detect reuse of a rotated-out token (theft signal)
// - revoke all sessions for a user (e.g. "log out everywhere")
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null }, // set on rotation
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

// auto-delete expired token documents (MongoDB TTL index)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);