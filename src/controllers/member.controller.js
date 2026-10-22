const asyncHandler = require('../utils/asyncHandler');
const memberService = require('../services/member.service');

const changeMemberRole = asyncHandler(async (req, res) => {
  const member = await memberService.changeMemberRole(req.organization, req.params.memberId, req.body.role);
  res.status(200).json({ success: true, message: 'Member role updated', data: { member } });
});

module.exports = { changeMemberRole };