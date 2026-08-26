const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 100 }, // e.g. "General Admission", "VIP", "Early Bird"
    description: { type: String, maxlength: 500, default: '' },

    price: { type: Number, required: true, min: 0, default: 0 }, // 0 = free ticket
    currency: { type: String, default: 'USD' },

    quantity: { type: Number, required: true, min: 1 }, // total available - THE inventory cap
    quantitySold: { type: Number, default: 0, min: 0 }, // incremented atomically on each successful registration

    salesStart: { type: Date, default: null }, // null = on sale immediately
    salesEnd: { type: Date, default: null }, // null = no end date (falls back to event registration deadline)

    purchaseLimit: { type: Number, default: 10, min: 1 }, // max quantity per single registration/user

    isActive: { type: Boolean, default: true }, // organizer can pause a ticket type without deleting it
  },
  { timestamps: true }
);

ticketTypeSchema.index({ event: 1, isActive: 1 });

ticketTypeSchema.virtual('remaining').get(function getRemaining() {
  return Math.max(this.quantity - this.quantitySold, 0);
});
ticketTypeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('TicketType', ticketTypeSchema);