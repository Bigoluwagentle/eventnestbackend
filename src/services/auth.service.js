const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Issues a new access + refresh token pair for a user, and persists
 * the refresh token record (hashed) so it can be looked up / revoked.
 */
async function issueTokenPair(user, meta = {}) {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken(user._id.toString(), user.role);
  const refreshToken = signRefreshToken(user._id.toString(), tokenId);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days, matches JWT_REFRESH_EXPIRES_IN

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userAgent: meta.userAgent || null,
    ip: meta.ip || null,
  });

  return { accessToken, refreshToken };
}

async function signup({ name, email, password }, meta) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({ name, email, password });

  const verificationToken = generateRawToken();
  user.emailVerificationToken = hashToken(verificationToken);
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  await user.save({ validateBeforeSave: false });

  // TODO: replace with real email send once the email provider is wired up
  logger.info(`[DEV] Email verification token for ${email}: ${verificationToken}`);

  const tokens = await issueTokenPair(user, meta);
  return { user, ...tokens };
}

async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Incorrect email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('This account has been deactivated', 401);
  }

  const tokens = await issueTokenPair(user, meta);
  return { user, ...tokens };
}

/**
 * Rotates a refresh token: validates it, revokes it, issues a new pair.
 * If the presented token was already revoked (reused after rotation),
 * treats it as a theft signal and revokes ALL sessions for that user.
 */
async function refresh(rawRefreshToken, meta) {
  if (!rawRefreshToken) {
    throw new AppError('No refresh token provided', 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored) {
    throw new AppError('Invalid refresh token. Please log in again.', 401);
  }

  if (stored.revokedAt) {
    logger.warn(`Refresh token reuse detected for user ${stored.user}. Revoking all sessions.`);
    await RefreshToken.updateMany(
      { user: stored.user, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new AppError('Session invalid. Please log in again.', 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw new AppError('User no longer exists or is deactivated', 401);
  }

  const newTokens = await issueTokenPair(user, meta);
  stored.revokedAt = new Date();
  stored.replacedByTokenHash = hashToken(newTokens.refreshToken);
  await stored.save();

  return { user, ...newTokens };
}

async function logout(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) return; // don't reveal whether the email exists

  const resetToken = generateRawToken();
  user.passwordResetToken = hashToken(resetToken);
  user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save({ validateBeforeSave: false });

  // TODO: replace with real email send
  logger.info(`[DEV] Password reset token for ${email}: ${resetToken}`);
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new AppError('Token is invalid or has expired', 400);
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function verifyEmail(rawToken) {
  const tokenHash = hashToken(rawToken);

  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: Date.now() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new AppError('Verification token is invalid or has expired', 400);
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return user;
}

const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  REFRESH_COOKIE_MAX_AGE_MS,
};