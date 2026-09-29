const mongoose = require('mongoose');

const nightlyCapsuleSchema = new mongoose.Schema({
  // Unique date key (e.g., "2026-09-28")
  dateKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Nightly aggregate stats (updated live, frozen at 5 AM)
  totalOwls: {
    type: Number,
    default: 0,
    min: 0
  },
  totalClinks: {
    type: Number,
    default: 0,
    min: 0
  },
  totalConfessions: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSprints: {
    type: Number,
    default: 0,
    min: 0
  },

  topCity: {
    type: String,
    default: ''
  },
  topAura: {
    type: String,
    enum: ['grind', 'exam', 'vibe', 'gaming', ''],
    default: ''
  },

  // Daytime RSVPs ("Reserve My Spot for Tonight")
  rsvpList: [{
    alias: { type: String, required: true },
    city: { type: String, default: '' },
    goalForTonight: { type: String, default: '', maxlength: 100 },
    createdAt: { type: Date, default: Date.now }
  }],

  // Lifecycle
  isFrozen: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('NightlyCapsule', nightlyCapsuleSchema);
