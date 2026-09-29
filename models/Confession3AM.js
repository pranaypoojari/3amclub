const mongoose = require('mongoose');

const confession3AMSchema = new mongoose.Schema({
  authorOwlId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NightOwl',
    required: true
  },
  authorAlias: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  auraType: {
    type: String,
    enum: ['grind', 'exam', 'vibe', 'gaming'],
    default: 'vibe'
  },

  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140
  },

  reactions: {
    fire: { type: Number, default: 0, min: 0 },    // 🔥
    heart: { type: Number, default: 0, min: 0 },   // 💜
    ghost: { type: Number, default: 0, min: 0 },   // 👻
    clink: { type: Number, default: 0, min: 0 },   // ☕
    skull: { type: Number, default: 0, min: 0 },   // 💀
    hug: { type: Number, default: 0, min: 0 }      // 🫂
  },

  replies: [{
    authorOwlId: { type: String },
    authorAlias: { type: String, required: true },
    authorAvatar: { type: String, default: '🦉' },
    text: { type: String, required: true, maxlength: 140 },
    createdAt: { type: Date, default: Date.now }
  }],

  isPinned: {
    type: Boolean,
    default: false
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

// Auto-expire posts at sunrise
confession3AMSchema.index({ sunriseExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Confession3AM', confession3AMSchema);
