/**
 * Admin - store staff who can log in to the admin panel.
 * Passwords are hashed with bcrypt before saving and never returned in JSON.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
      match: [/^[a-z0-9_.-]+$/, 'Username may only contain letters, numbers, dot, dash and underscore'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never loaded unless explicitly requested
    },
    name: {
      type: String,
      trim: true,
      maxlength: 60,
      default: 'Store Admin',
    },
    // Used to invalidate JWTs issued before a password change
    passwordChangedAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.passwordChangedAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash the password whenever it is created or changed
adminSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  if (!this.isNew) {
    // 1 second back-dated so a token issued right after the change stays valid
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

/** Compare a plain text password with the stored hash. */
adminSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(String(plain), this.password);
};

/** True when the password was changed after the JWT (iat, in seconds) was issued. */
adminSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return jwtIssuedAt < Math.floor(this.passwordChangedAt.getTime() / 1000);
};

module.exports = mongoose.model('Admin', adminSchema);
