const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const env = require('../config/env');

function requestMeta(req) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: authService.REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
}

const signup = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.signup(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ success: true, message: 'Account created', data: { user, accessToken } });
});

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, message: 'Logged in', data: { user, accessToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies.refreshToken;
  const { user, accessToken, refreshToken } = await authService.refresh(rawRefreshToken, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ success: true, message: 'Token refreshed', data: { user, accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies.refreshToken;
  await authService.logout(rawRefreshToken);
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: 'Logged out' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  res.status(200).json({
    success: true,
    message: 'If an account with that email exists, a reset link has been sent.',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ success: true, message: 'Password reset successful. Please log in again.' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.params.token);
  res.status(200).json({ success: true, message: 'Email verified successfully' });
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

module.exports = {
  signup,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  getMe,
};