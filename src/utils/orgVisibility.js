const Organization = require('../models/Organization');

// Organizations that must not appear in public discovery: ones that opted out of public listing
// (settings.isPublic = false) and ones that are not active (for example suspended).
// Organizations created before the setting existed have no value and count as public.
async function undiscoverableOrganizationIds() {
  return Organization.distinct('_id', {
    $or: [{ 'settings.isPublic': false }, { status: { $ne: 'active' } }],
  });
}

module.exports = { undiscoverableOrganizationIds };