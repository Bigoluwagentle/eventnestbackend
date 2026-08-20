const AppError = require('../utils/AppError');
const logger = require('../config/logger');

function handleMongooseValidationError(err) {
  const errors = Object.values(err.errors).map((e) => e.message);
  return new AppError('Validation failed', 400, errors);
}

function handleMongooseDuplicateKeyError(err) {
  const field = Object.keys(err.keyValue || {})[0];
  return new AppError(`${field} already exists`, 409);
}

function handleMongooseCastError(err) {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

function handleJWTError() {
  return new AppError('Invalid or expired token. Please log in again.', 401);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err.name === 'ValidationError') error = handleMongooseValidationError(err);
  if (err.code === 11000) error = handleMongooseDuplicateKeyError(err);
  if (err.name === 'CastError') error = handleMongooseCastError(err);
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError();
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;

  if (!isOperational) {
    // Unexpected/programming error - log full detail server-side, never leak to client
    logger.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? error.message : 'Something went wrong. Please try again later.',
    ...(error.details ? { details: error.details } : {}),
    ...(process.env.NODE_ENV === 'development' && !isOperational ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
