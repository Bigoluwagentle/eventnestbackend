const { getIO } = require('../sockets');
const logger = require('../config/logger');

// Emits to everyone in an event's socket room. If the socket layer isn't
// available, the REST action that triggered this still succeeds.
function emitToEvent(eventId, eventName, payload) {
  try {
    getIO().to(`event:${eventId}`).emit(eventName, payload);
  } catch (err) {
    logger.warn(`Could not emit ${eventName}: ${err.message}`);
  }
}

module.exports = { emitToEvent };