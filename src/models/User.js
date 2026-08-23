const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned by default on queries
    },
    role: {
      type: String,
      enum: ['super_admin', 'organizer', 'attendee'],
      default: 'attendee',
      // Note: "organizer" here just means "can create an organization" —
      // event-level and org-level permissions are handled separately via
      // OrganizationMember roles, not this global field. Staff permissions
      // are also handled per-event, not globally.
    },
    avatar: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // for Cloudinary deletion
    },
    bio: { type: String, maxlength: 500, default: '' },
    phone: { type: String, default: null },
    socialLinks: {
      twitter: { type: String, default: null },
      linkedin: { type: String, default: null },
      website: { type: String, default: null },
    },
    interests: [{ type: String }],
    skills: [{ type: String }],

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },

    isActive: { type: Boolean, default: true }, // for soft-deactivation / abuse handling
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

// ---- Hash password before save ----
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);

  // if this is a password change (not initial creation), record when,
  // so we can invalidate tokens issued before this change
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // -1s to avoid JWT timing edge case
  }

  next();
});

// ---- Instance methods ----
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtTimestamp) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtTimestamp < changedTimestamp;
};

// ---- Remove sensitive fields whenever a user doc is serialized ----
userSchema.methods.toJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);