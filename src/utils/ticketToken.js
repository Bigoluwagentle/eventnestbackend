const crypto = require('crypto');
const env = require('../config/env');

/**
 * Deterministically derives a secure, unguessable ticket token from the ticket's
 * own ID and a server-only secret. Never stored - recomputed whenever needed,
 * which lets attendees re-view their QR code anytime.
 */
function generateTicketToken(ticketId) {
  return crypto.createHmac('sha256', env.TICKET_TOKEN_SECRET).update(ticketId.toString()).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks during check-in validation.
 */
function verifyTicketToken(ticketId, presentedToken) {
  const expected = generateTicketToken(ticketId);
  const expectedBuf = Buffer.from(expected);
  const presentedBuf = Buffer.from(presentedToken || '');
  if (expectedBuf.length !== presentedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, presentedBuf);
}

module.exports = { generateTicketToken, verifyTicketToken };