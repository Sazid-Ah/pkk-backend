const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    theme: {
      type: String,
      enum: ['system', 'light', 'dark'],
      default: 'system',
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'bn', 'te', 'ta', 'kn'],
      default: 'en',
    },
    notifications: {
      push: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserSettings', userSettingsSchema);
