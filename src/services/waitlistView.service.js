const Registration = require('../models/Registration');

/**
 * Who is waiting for a ticket type, in order. For organizers: names and when they joined, nothing else
 * (no emails, no ids), so the list shows demand without exposing anyone.
 */
async function listWaitlist(ticketType, { page, limit }) {
  const filter = { ticketType: ticketType._id, status: 'waitlisted' };

  const [rows, total] = await Promise.all([
    Registration.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name')
      .lean(),
    Registration.countDocuments(filter),
  ]);

  return {
    total,
    entries: rows.map((row, index) => ({
      position: (page - 1) * limit + index + 1,
      name: row.user ? row.user.name : null,
      joinedAt: row.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

module.exports = { listWaitlist };