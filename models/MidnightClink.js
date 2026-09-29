const mongoose = require('mongoose');

const midnightClinkSchema = new mongoose.Schema({
  fromOwlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NightOwl',
    required: true
  },
  fromAlias: {
    type: String,
    required: true
  },
  fromCity: {
    type: String,
    required: true
  },
  fromCoordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  toOwlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NightOwl',
    required: true
  },
  toAlias: {
    type: String,
    required: true
  },
  toCity: {
    type: String,
    required: true
  },
  toCoordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },

  reactionType: {
    type: String,
    enum: ['☕', '⚡', '🫂'],
    default: '☕'
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  sunriseExpiresAt: {
    type: Date,
    required: true
  }
});

// Auto-expire clink records after sunrise
midnightClinkSchema.index({ sunriseExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MidnightClink', midnightClinkSchema);
