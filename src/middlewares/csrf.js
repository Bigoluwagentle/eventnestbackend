const AppError = require('../utils/AppError');

// The refresh cookie is sent cross-site in production (SameSite=None), so the
// cookie-only endpoints need a CSRF defense. Requiring a custom header forces
// a CORS preflight, which only our allowed origins can pass.
function requireCsrfHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(new AppError('Missing required request header', 403));
  }
  next();
}

module.exports = { requireCsrfHeader };