const env = require('../config/env');
const AppError = require('../utils/AppError');

// Optional gate (REQUIRE_VERIFIED_EMAIL=true) for actions that create things other people see.
// Off by default so development accounts with made-up email addresses keep working.
function requireVerifiedEmail(req, res, next) {
  if (env.REQUIRE_VERIFIED_EMAIL && !req.user.isEmailVerified) {
    return next(
      new AppError('Please verify your email address first. You can request a new link at POST /auth/resend-verification.', 403)
    );
  }
  return next();
}

module.exports = { requireVerifiedEmail };