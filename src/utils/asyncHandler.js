/**
 * Wraps an async Express route/controller function so rejected promises
 * are forwarded to next(err) instead of crashing the process or requiring
 * a try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
