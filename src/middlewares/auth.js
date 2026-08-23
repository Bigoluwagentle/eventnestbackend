const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

/**
 * Requires a valid access token in the Authorization header.
 * Attaches the authenticated user to req.user.
 */
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    return next(new AppError('Invalid or expired session. Please log in again.', 401));
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('This account has been deactivated.', 401));
  }

  // if password was changed after this token was issued, invalidate it
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401));
  }

  req.user = user;
  next();
});

/**
 * Restricts access to specific global roles.
 * Usage: restrictTo('super_admin')
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { protect, restrictTo };