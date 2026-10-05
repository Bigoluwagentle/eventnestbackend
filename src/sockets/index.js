const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../config/logger');
const { verifyAccessToken } = require('../utils/tokens');
const { canAccessEvent } = require('../utils/eventParticipation');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

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
        const allowed = await canAccessEvent(socket.userId, eventId);
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