const env = require('./config/env');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const app = require('./app');

let server;

async function start() {
  await connectDB();

  server = app.listen(env.PORT, () => {
    logger.info(`EventNest API running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });
}

start();

// ---- Graceful shutdown & crash safety ----
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server?.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully.');
  server?.close(() => logger.info('Process terminated.'));
});
