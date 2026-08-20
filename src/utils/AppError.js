class AppError extends Error {
  /**
   * @param {string} message - human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {object} [details] - optional extra info (e.g. validation field errors)
   */
  constructor(message, statusCode, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // distinguishes expected errors from programming bugs
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
