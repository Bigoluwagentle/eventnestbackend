const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'manager'],
      // owner: full control, only one per org, can delete org / transfer ownership
      // admin: manage events, staff, settings - cannot delete org or remove owner
      // manager: manage events and day-to-day operations - cannot manage members/settings
      default: 'manager',
      required: true,
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// a user can only have one membership record per organization
organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);