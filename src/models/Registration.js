const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ticketType: { type: mongoose.Schema.Types.ObjectId, ref: 'TicketType', required: true },

    quantity: { type: Number, required: true, min: 1, default: 1 },

    status: {
      type: String,
      enum: ['pending_payment', 'confirmed', 'cancelled', 'waitlisted'],
      default: 'confirmed', // free tickets confirm immediately; paid ones start pending_payment (Phase 8)
      index: true,
    },

    // snapshot of amount owed at registration time - price could change later, this stays fixed
    amountDue: { type: Number, required: true, default: 0 },

    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
  },
  { timestamps: true }
);

// one active (non-cancelled) registration per user per event per ticket type -
// prevents accidental duplicate registrations from double-clicks/retries
registrationSchema.index(
  { event: 1, user: 1, ticketType: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending_payment', 'confirmed', 'waitlisted'] } } }
);

module.exports = mongoose.model('Registration', registrationSchema);