const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true, index: true },
    ticketType: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // human-readable reference for UI/emails - NOT used for validation
    ticketNumber: { type: String, required: true, unique: true },

    // NOTE: no stored token here. The actual scan token is derived on demand via
    // HMAC-SHA256(ticket._id, TICKET_TOKEN_SECRET) - see utils/ticketToken.js.
    // This lets attendees re-view their QR anytime without us ever persisting the raw token.

    status: {
      type: String,
      enum: ['valid', 'used', 'cancelled', 'refunded'],
      default: 'valid',
      index: true,
    },

    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // staff member who scanned it
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);