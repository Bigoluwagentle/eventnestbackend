const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const logger = require('./config/logger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const apiRouter = require('./routes');

const app = express();

// Trust Render's reverse proxy so req.ip / secure cookies behave correctly
app.set('trust proxy', 1);

// API docs get their own relaxed helmet config, so mount them before the global helmet
app.use('/api/docs', require('./docs'));

// ---- Security middleware ----
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = non-browser client (Postman, curl, health checks). CORS only
      // protects browsers, so these are allowed; auth still protects every private route.
      if (!origin || env.CLIENT_URLS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true, // allow the refresh-token cookie to be sent
  })
);
app.use(mongoSanitize()); // strips $ and . from req.body/query/params to block NoSQL injection

// ---- Body parsing ----
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ---- Logging ----
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

// ---- Rate limiting (applied to all /api routes) ----
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', globalLimiter);

// ---- Health check (for Render + uptime monitors) ----
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'EventNest API is healthy', uptime: process.uptime() });
});

// ---- API routes ----
app.use(`/api/${env.API_VERSION}`, apiRouter);

// ---- 404 + centralized error handler (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;