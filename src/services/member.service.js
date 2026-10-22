const OrganizationMember = require('../models/OrganizationMember');
const AppError = require('../utils/AppError');

/**
 * Changes a member's organization role (owner only, enforced by the route).
 * The owner's own role is never touched here: it only moves by transferring ownership.
 */
async function changeMemberRole(organization, memberId, role) {
  // one atomic, conditional update: the member must belong to THIS organization and must not be the owner
  const member = await OrganizationMember.findOneAndUpdate(
    { _id: memberId, organization: organization._id, role: { $ne: 'owner' } },
    { $set: { role } },
    { new: true }
  ).populate('user', 'name email avatar');

  if (!member) {
    const exists = await OrganizationMember.exists({ _id: memberId, organization: organization._id });
    throw exists
      ? new AppError("The owner's role can only be changed by transferring ownership", 400)
      : new AppError('Member not found', 404);
  }

  return member;
}

module.exports = { changeMemberRole };