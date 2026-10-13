const User = require('../models/User');
const Registration = require('../models/Registration');
const RefreshToken = require('../models/RefreshToken');
const AppError = require('../utils/AppError');

const PROFILE_FIELDS = ['name', 'bio', 'phone', 'interests', 'skills'];
const SOCIAL_FIELDS = ['twitter', 'linkedin', 'website'];
const PRIVACY_FIELDS = ['showEmail', 'showPhone', 'showSocialLinks', 'showInterestsAndSkills'];
const emailService = require('./email.service');

async function updateProfile(user, updates) {
  // explicit whitelist: nothing else (role, email, isActive...) can be changed through this path
  PROFILE_FIELDS.forEach((field) => {
    if (updates[field] !== undefined) user.set(field, updates[field]);
  });

  if (updates.socialLinks) {
    SOCIAL_FIELDS.forEach((field) => {
      if (updates.socialLinks[field] !== undefined) user.set(`socialLinks.${field}`, updates.socialLinks[field]);
    });
  }

  await user.save();
  return user;
}

async function updatePrivacy(user, settings) {
  PRIVACY_FIELDS.forEach((field) => {
    if (settings[field] !== undefined) user.set(`privacy.${field}`, settings[field]);
  });
  await user.save();
  return user;
}

async function changePassword(user, currentPassword, newPassword) {
  const fullUser = await User.findById(user._id).select('+password');

  if (!(await fullUser.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }

  fullUser.password = newPassword; // hashed by the pre-save hook, which also records passwordChangedAt
  await fullUser.save();

  emailService.sendPasswordChangedEmail(fullUser);

  // sign out everywhere: an attacker holding a stolen session loses it too
  await RefreshToken.updateMany({ user: fullUser._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

// True if both users have a confirmed registration for at least one common event.
async function sharesEvent(viewerId, targetId) {
  const targetEvents = await Registration.find({ user: targetId, status: 'confirmed' }).distinct('event');
  if (!targetEvents.length) return false;
  return !!(await Registration.exists({ user: viewerId, status: 'confirmed', event: { $in: targetEvents } }));
}

function toPublicProfile(user) {
  const p = user.privacy || {};
  const profile = {
    _id: user._id,
    name: user.name,
    avatar: { url: user.avatar?.url || null }, // never expose the storage publicId
    bio: user.bio,
  };
  if (p.showEmail) profile.email = user.email;
  if (p.showPhone) profile.phone = user.phone;
  if (p.showSocialLinks) profile.socialLinks = user.socialLinks;
  if (p.showInterestsAndSkills) {
    profile.interests = user.interests;
    profile.skills = user.skills;
  }
  return profile;
}

async function getPublicProfile(viewerId, targetId) {
  const target = await User.findOne({ _id: targetId, isActive: true });
  if (!target) throw new AppError('User not found', 404);

  if (target._id.equals(viewerId)) return target; // your own profile: everything

  // 404, not 403: don't reveal that the account exists to people with no shared context
  if (!(await sharesEvent(viewerId, target._id))) throw new AppError('User not found', 404);

  return toPublicProfile(target);
}

module.exports = { updateProfile, updatePrivacy, changePassword, getPublicProfile };