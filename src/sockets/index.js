const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../config/logger');
const { verifyAccessToken } = require('../utils/tokens');
const OrganizationMember = require('../models/OrganizationMember');
const EventStaff = require('../models/EventStaff');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

let io;

async function userCanAccessEventRoom(userId, eventId) {
  const [registration, staffRecord] = await Promise.all([
    Registration.findOne({ event: eventId, user: userId, status: 'confirmed' }),
    EventStaff.findOne({ event: eventId, user: userId }),
  ]);
  if (registration || staffRecord) return true;

  const event = await Event.findById(eventId).select('organization');
  if (!event) return false;

  const membership = await OrganizationMember.findOne({ organization: event.organization, user: userId });
  return !!membership;
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  // Same JWT access tokens used for REST auth - no separate socket auth system.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.sub;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: user ${socket.userId}`);

    socket.on('join:event', async (eventId, callback) => {
      try {
        const allowed = await userCanAccessEventRoom(socket.userId, eventId);
        if (!allowed) {
          return callback?.({ success: false, message: 'Not authorized for this event' });
        }
        socket.join(`event:${eventId}`);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, message: 'Failed to join event room' });
      }
    });

    socket.on('leave:event', (eventId) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${socket.userId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

module.exports = { initSocket, getIO };