const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

/**
 * For routes that serve both anonymous visitors and logged-in users (like a gallery that can be
 * public). A valid token attaches req.user; a missing, invalid or expired one just means
 * "anonymous". The route itself decides whether being anonymous is enough.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  let decoded;
  try {
    decoded = verifyAccessToken(header.split(' ')[1]);
  } catch {
    return next();
  }

  const user = await User.findById(decoded.sub).select('+passwordChangedAt');
  // the same checks as the strict protect middleware: active account, token newer than the last password change
  if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) {
    req.user = user;
  }
  return next();
});

module.exports = { optionalAuth };