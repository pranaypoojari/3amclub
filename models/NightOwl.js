const mongoose = require('mongoose');

const nightOwlSchema = new mongoose.Schema({
  alias: { type: String, required: true, maxlength: 24 },
  sessionId: { type: String, required: true, unique: true },
  bio: { type: String, maxlength: 160, default: '' },
  age: { type: Number, min: 16, max: 99 },
  pronouns: { type: String, default: '' },
  avatarEmoji: { type: String, default: '🦉' },
  profileType: { type: String, enum: ['open', 'closed'], default: 'open' },
  interests: [{
    type: String
  }],
  lookingFor: [{
    type: String
  }],
  socialLinks: {
    instagram: { handle: { type: String, default: '' }, isPublic: { type: Boolean, default: true } },
    snapchat: { handle: { type: String, default: '' }, isPublic: { type: Boolean, default: false } },
    spotify: { handle: { type: String, default: '' }, isPublic: { type: Boolean, default: true } },
    discord: { handle: { type: String, default: '' }, isPublic: { type: Boolean, default: false } },
    twitter: { handle: { type: String, default: '' }, isPublic: { type: Boolean, default: true } }
  },
  city: { type: String, required: true },
  neighborhood: { type: String, default: '' },
  coordinates: {
    lat: Number,
    lng: Number
  },
  auraType: { type: String, enum: ['grind', 'exam', 'vibe', 'gaming'], default: 'vibe' },
  beverage: { type: String, default: '☕ Coffee' },
  statusText: { type: String, maxlength: 80 },
  currentTrack: { type: String, maxlength: 100 },
  clinksReceived: { type: Number, default: 0 },
  clinksSent: { type: Number, default: 0 },
  sprintCount: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: true },
  checkedInAt: { type: Date },
  lastActiveAt: { type: Date },
  sunriseExpiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

module.exports = mongoose.models.NightOwl || mongoose.model('NightOwl', nightOwlSchema);
