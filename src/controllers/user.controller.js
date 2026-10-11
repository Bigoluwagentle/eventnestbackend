const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/user.service');
const { clearRefreshCookie } = require('./auth.controller');

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user, req.body);
  res.status(200).json({ success: true, message: 'Profile updated', data: { user } });
});

const updatePrivacy = asyncHandler(async (req, res) => {
  const user = await userService.updatePrivacy(req.user, req.body);
  res.status(200).json({ success: true, message: 'Privacy settings updated', data: { user } });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: 'Password changed. All sessions were signed out - please log in again.',
  });
});

const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getPublicProfile(req.user._id, req.params.userId);
  res.status(200).json({ success: true, data: { user: profile } });
});

module.exports = { getMe, updateProfile, updatePrivacy, changePassword, getPublicProfile };