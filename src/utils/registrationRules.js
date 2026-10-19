const AppError = require('./AppError');
const { canAccessEvent } = require('./eventParticipation');

// Rules about WHO may register, on top of the event being open for registration.
async function assertEventAllowsRegistration(event, user) {
  // Private events are not open to the public. There are no event invitations yet, so only people who
  // are already part of the event (organization members and event staff) can register. Everyone
  // else gets "not found" so a private event's existence is not revealed.
  if (event.visibility === 'private' && !(await canAccessEvent(user._id, event._id))) {
    throw new AppError('Event not found', 404);
  }
}

module.exports = { assertEventAllowsRegistration };