const Event = require('../models/Event');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const TicketType = require('../models/TicketType');
const Session = require('../models/Session');
const SessionBookmark = require('../models/SessionBookmark');
const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const Question = require('../models/Question');
const QuestionVote = require('../models/QuestionVote');

const DAY_MS = 24 * 60 * 60 * 1000;

// NOTE: aggregation pipelines do not cast values the way find() does, so every id passed
// into a $match below must already be an ObjectId (taken from a loaded document) and never
// a raw string from the request.

// A fraction between 0 and 1 (rounded to 4 places); 0 when there is nothing to divide by.
const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 10000) / 10000 : 0);

// event.timezone is free text from the organizer; an unknown name would make MongoDB error out.
function safeTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone }); // eslint-disable-line no-new
    return timeZone;
  } catch {
    return 'UTC';
  }
}

const countsByKey = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);
// MongoDB groups in UTC unless told otherwise, so the option is simply left out for UTC.
const dayBucket = (timezone) => ({
  $dateToString: { format: '%Y-%m-%d', date: '$createdAt', ...(timezone && timezone !== 'UTC' ? { timezone } : {}) },
});

// Registrations per day (cancelled excluded), grouped in the event's own time zone so that
// "day" matches what the organizer sees. If MongoDB rejects the zone name, fall back to UTC.
async function registrationsPerDay(match, timezone) {
  const run = (tz) =>
    Registration.aggregate([
      { $match: match },
      { $group: { _id: dayBucket(tz), registrations: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  try {
    return await run(timezone);
  } catch (err) {
    return run('UTC');
  }
}

/**
 * Everything an organizer wants to know about one event. Aggregates only:
 * no individual attendee is ever identified (so anonymous polls stay anonymous).
 */
async function getEventAnalytics(event) {
  const eventId = event._id;
  const timezone = safeTimeZone(event.timezone);

  const [
    registrationRows, revenueRows, ticketRows, ticketTypes, trendRows, bookmarkRows, bookmarkTotal,
    sessionTotal, polls, questionRows, questionIds, attendeeIds, pollVoters, askers, bookmarkers,
  ] = await Promise.all([
    Registration.aggregate([{ $match: { event: eventId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Registration.aggregate([
      { $match: { event: eventId, status: 'confirmed' } },
      { $group: { _id: '$ticketType', revenue: { $sum: '$amountDue' } } },
    ]),
    Ticket.aggregate([
      { $match: { event: eventId } },
      { $group: { _id: { ticketType: '$ticketType', status: '$status' }, count: { $sum: 1 } } },
    ]),
    TicketType.find({ event: eventId }).sort({ price: 1 }).lean(),
    registrationsPerDay({ event: eventId, status: { $ne: 'cancelled' } }, timezone),
    SessionBookmark.aggregate([
      { $match: { event: eventId } },
      { $group: { _id: '$session', bookmarks: { $sum: 1 } } },
      { $sort: { bookmarks: -1 } },
      { $limit: 10 },
    ]),
    SessionBookmark.countDocuments({ event: eventId }),
    Session.countDocuments({ event: eventId }),
    Poll.find({ event: eventId, status: { $ne: 'draft' } }).sort({ createdAt: 1 }).lean(),
    Question.aggregate([
      { $match: { event: eventId } },
      { $group: { _id: '$status', count: { $sum: 1 }, upvotes: { $sum: '$upvoteCount' } } },
    ]),
    Question.distinct('_id', { event: eventId }),
    Registration.distinct('user', { event: eventId, status: 'confirmed' }),
    PollVote.distinct('user', { event: eventId }),
    Question.distinct('author', { event: eventId }),
    SessionBookmark.distinct('user', { event: eventId }),
  ]);

  const upvoters = await QuestionVote.distinct('user', { question: { $in: questionIds } });

  const popularIds = bookmarkRows.map((r) => r._id);
  const popularSessions = popularIds.length
    ? await Session.find({ _id: { $in: popularIds } }).select('title type startTime').lean()
    : [];
  const sessionById = new Map(popularSessions.map((s) => [String(s._id), s]));

  // ---- registrations ----
  const byStatus = countsByKey(registrationRows);
  const confirmed = byStatus.confirmed || 0;
  const pendingPayment = byStatus.pending_payment || 0;
  const waitlisted = byStatus.waitlisted || 0;
  const cancelled = byStatus.cancelled || 0;

  // ---- tickets, revenue, per-type sales ----
  const issuedByType = new Map(); // ticketTypeId -> { valid, used }
  ticketRows.forEach(({ _id, count }) => {
    const key = String(_id.ticketType);
    const entry = issuedByType.get(key) || { valid: 0, used: 0 };
    if (_id.status === 'valid') entry.valid += count;
    if (_id.status === 'used') entry.used += count;
    issuedByType.set(key, entry);
  });
  const revenueByType = new Map(revenueRows.map((r) => [String(r._id), r.revenue]));

  const revenueByCurrency = new Map();
  const typeStats = ticketTypes.map((t) => {
    const tickets = issuedByType.get(String(t._id)) || { valid: 0, used: 0 };
    const revenue = revenueByType.get(String(t._id)) || 0;
    revenueByCurrency.set(t.currency, (revenueByCurrency.get(t.currency) || 0) + revenue);
    return {
      _id: t._id,
      name: t.name,
      price: t.price,
      currency: t.currency,
      isActive: t.isActive,
      quantity: t.quantity,
      sold: t.quantitySold, // includes unpaid reservations (pending_payment)
      remaining: Math.max(t.quantity - t.quantitySold, 0),
      fillRate: rate(t.quantitySold, t.quantity),
      ticketsIssued: tickets.valid + tickets.used,
      checkedIn: tickets.used,
      revenue,
    };
  });

  const inventory = sum(typeStats, (t) => t.quantity);
  const sold = sum(typeStats, (t) => t.sold);
  const ticketsIssued = sum(typeStats, (t) => t.ticketsIssued);
  const checkedIn = sum(typeStats, (t) => t.checkedIn);

  // ---- polls ----
  const attendees = new Set(attendeeIds.map(String));
  const pollItems = polls.map((p) => {
    const totalVotes = sum(p.options, (o) => o.voteCount);
    return {
      _id: p._id,
      question: p.question,
      status: p.status,
      isAnonymous: p.isAnonymous,
      totalVotes,
      participationRate: Math.min(rate(totalVotes, attendees.size), 1),
      options: p.options.map((o) => ({ _id: o._id, text: o.text, voteCount: o.voteCount })),
    };
  });
  const totalVotes = sum(pollItems, (p) => p.totalVotes);

  // ---- Q&A ----
  const questionByStatus = Object.fromEntries(questionRows.map((r) => [r._id, r]));
  const questionCount = (status) => (questionByStatus[status] ? questionByStatus[status].count : 0);

  // ---- engagement: confirmed attendees who voted, asked, upvoted or bookmarked ----
  const engagedAttendees = [...new Set([...pollVoters, ...askers, ...upvoters, ...bookmarkers].map(String))].filter((id) =>
    attendees.has(id)
  ).length;

  return {
    event: {
      _id: event._id,
      name: event.name,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone,
    },
    registrations: {
      total: confirmed + pendingPayment + waitlisted, // excludes cancelled
      confirmed,
      pendingPayment,
      waitlisted,
      cancelled,
      uniqueAttendees: attendees.size,
    },
    tickets: { inventory, sold, remaining: Math.max(inventory - sold, 0), fillRate: rate(sold, inventory), issued: ticketsIssued },
    checkIn: { checkedIn, ticketsIssued, notCheckedIn: ticketsIssued - checkedIn, rate: rate(checkedIn, ticketsIssued) },
    revenue: [...revenueByCurrency].map(([currency, amount]) => ({ currency, amount })),
    ticketTypes: typeStats,
    registrationsByDay: trendRows.map((r) => ({ date: r._id, registrations: r.registrations })),
    sessions: {
      total: sessionTotal,
      totalBookmarks: bookmarkTotal,
      popular: bookmarkRows
        .filter((r) => sessionById.has(String(r._id)))
        .map((r) => {
          const s = sessionById.get(String(r._id));
          return { _id: s._id, title: s.title, type: s.type, startTime: s.startTime, bookmarks: r.bookmarks };
        }),
    },
    polls: {
      total: pollItems.length,
      totalVotes,
      averageParticipationRate: pollItems.length ? rate(sum(pollItems, (p) => p.participationRate), pollItems.length) : 0,
      items: pollItems,
    },
    questions: {
      total: sum(questionRows, (r) => r.count),
      totalUpvotes: sum(questionRows, (r) => r.upvotes),
      byStatus: { approved: questionCount('approved'), answered: questionCount('answered'), hidden: questionCount('hidden') },
    },
    engagement: { engagedAttendees, engagementRate: rate(engagedAttendees, attendees.size) },
  };
}

/** Overview across all of one organization's events. */
async function getOrganizationAnalytics(organization) {
  const organizationId = organization._id;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [eventRows, registrationRows, ticketRows, revenueRows, topRows, trendRows, upcomingPublished] = await Promise.all([
    Event.aggregate([{ $match: { organization: organizationId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Registration.aggregate([{ $match: { organization: organizationId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: { organization: organizationId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Registration.aggregate([
      { $match: { organization: organizationId, status: 'confirmed' } },
      { $group: { _id: '$ticketType', revenue: { $sum: '$amountDue' } } },
    ]),
    Registration.aggregate([
      { $match: { organization: organizationId, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$event', registrations: { $sum: 1 } } },
      { $sort: { registrations: -1 } },
      { $limit: 5 },
    ]),
    Registration.aggregate([
      { $match: { organization: organizationId, status: { $ne: 'cancelled' }, createdAt: { $gte: since30 } } },
      { $group: { _id: dayBucket('UTC'), registrations: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Event.countDocuments({ organization: organizationId, status: 'published', startDate: { $gte: now } }),
  ]);

  const [typeDocs, topEventDocs] = await Promise.all([
    revenueRows.length ? TicketType.find({ _id: { $in: revenueRows.map((r) => r._id) } }).select('currency').lean() : [],
    topRows.length ? Event.find({ _id: { $in: topRows.map((r) => r._id) } }).select('name slug status startDate').lean() : [],
  ]);

  const currencyByType = new Map(typeDocs.map((t) => [String(t._id), t.currency]));
  const revenueByCurrency = new Map();
  revenueRows.forEach((r) => {
    const currency = currencyByType.get(String(r._id)) || 'USD';
    revenueByCurrency.set(currency, (revenueByCurrency.get(currency) || 0) + r.revenue);
  });

  const events = countsByKey(eventRows);
  const registrations = countsByKey(registrationRows);
  const tickets = countsByKey(ticketRows);
  const eventById = new Map(topEventDocs.map((e) => [String(e._id), e]));
  const ticketsIssued = (tickets.valid || 0) + (tickets.used || 0);

  return {
    events: { total: sum(eventRows, (r) => r.count), upcomingPublished, byStatus: events },
    registrations: {
      total: (registrations.confirmed || 0) + (registrations.pending_payment || 0) + (registrations.waitlisted || 0),
      confirmed: registrations.confirmed || 0,
      pendingPayment: registrations.pending_payment || 0,
      waitlisted: registrations.waitlisted || 0,
      cancelled: registrations.cancelled || 0,
    },
    checkIn: { checkedIn: tickets.used || 0, ticketsIssued, rate: rate(tickets.used || 0, ticketsIssued) },
    revenue: [...revenueByCurrency].map(([currency, amount]) => ({ currency, amount })),
    topEvents: topRows
      .filter((r) => eventById.has(String(r._id)))
      .map((r) => {
        const e = eventById.get(String(r._id));
        return { _id: e._id, name: e.name, slug: e.slug, status: e.status, startDate: e.startDate, registrations: r.registrations };
      }),
    registrationsLast30Days: trendRows.map((r) => ({ date: r._id, registrations: r.registrations })),
  };
}

/** Platform-wide totals and growth for super admins. Counts only: no personal or per-organization data. */
async function getPlatformAnalytics() {
  const now = Date.now();
  const since = (days) => new Date(now - days * DAY_MS);
  const createdSince = (days) => ({ createdAt: { $gte: since(days) } });
  // like the event and organization reports, registrations here never include cancelled ones
  const activeRegistrationsSince = (days) => ({ status: { $ne: 'cancelled' }, ...createdSince(days) });
  const series = (Model, field, extraMatch = {}) =>
    Model.aggregate([
      { $match: { ...extraMatch, ...createdSince(30) } },
      { $group: { _id: dayBucket('UTC'), [field]: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

  const [
    users, activeUsers, verifiedUsers, organizations, suspendedOrganizations, events, upcomingPublished,
    eventRows, registrationRows, ticketRows,
    newUsers7, newUsers30, newOrgs7, newOrgs30, newEvents7, newEvents30, newRegs7, newRegs30,
    userTrend, registrationTrend,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isEmailVerified: true }),
    Organization.countDocuments({}),
    Organization.countDocuments({ status: 'suspended' }),
    Event.countDocuments({}),
    Event.countDocuments({ status: 'published', startDate: { $gte: new Date(now) } }),
    Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Registration.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments(createdSince(7)), User.countDocuments(createdSince(30)),
    Organization.countDocuments(createdSince(7)), Organization.countDocuments(createdSince(30)),
    Event.countDocuments(createdSince(7)), Event.countDocuments(createdSince(30)),
    Registration.countDocuments(activeRegistrationsSince(7)), Registration.countDocuments(activeRegistrationsSince(30)),
    series(User, 'users'),
    series(Registration, 'registrations', { status: { $ne: 'cancelled' } }),
  ]);

  const registrations = countsByKey(registrationRows);
  const tickets = countsByKey(ticketRows);

  return {
    totals: {
      users, activeUsers, verifiedUsers, organizations, suspendedOrganizations, events, upcomingPublishedEvents: upcomingPublished,
      registrations: (registrations.confirmed || 0) + (registrations.pending_payment || 0) + (registrations.waitlisted || 0),
      ticketsIssued: (tickets.valid || 0) + (tickets.used || 0),
      checkIns: tickets.used || 0,
    },
    eventsByStatus: countsByKey(eventRows),
    registrationsByStatus: registrations,
    newInLast7Days: { users: newUsers7, organizations: newOrgs7, events: newEvents7, registrations: newRegs7 },
    newInLast30Days: { users: newUsers30, organizations: newOrgs30, events: newEvents30, registrations: newRegs30 },
    growth: {
      usersByDay: userTrend.map((r) => ({ date: r._id, users: r.users })),
      registrationsByDay: registrationTrend.map((r) => ({ date: r._id, registrations: r.registrations })),
    },
  };
}

module.exports = { getEventAnalytics, getOrganizationAnalytics, getPlatformAnalytics };