const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { canAccessEvent } = require('../utils/eventParticipation');

const requireEventParticipant = asyncHandler(async (req, res, next) => {
  const allowed = await canAccessEvent(req.user._id, req.event._id);
  if (!allowed) {
    return next(new AppError('You do not have access to this event', 403));
  }
  next();
});

module.exports = { requireEventParticipant };