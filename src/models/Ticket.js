const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true, index: true },
    ticketType: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // human-readable reference shown in UI/emails - NOT used for validation (guessable/sequential-looking)
    ticketNumber: { type: String, required: true, unique: true },

    // the actual security boundary: raw random token lives only in the QR code /
    // the one-time response to the client; we store only its hash, same pattern as refresh tokens
    tokenHash: { type: String, required: true, unique: true, select: false },

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