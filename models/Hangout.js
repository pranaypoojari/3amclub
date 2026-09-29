const mongoose = require('mongoose');

const hangoutSchema = new mongoose.Schema({
  ownerOwlId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl', required: true },
  ownerAlias: { type: String, required: true },
  ownerAvatarEmoji: { type: String },
  city: { type: String, required: true },
  spot: { type: String, required: true },
  activity: { type: String, enum: ['coffee', 'study', 'walk', 'food', 'gaming', 'music', 'drive', 'photography', 'just-chill'], required: true },
  maxPeople: { type: Number, min: 2, max: 10, default: 4 },
  joinedOwls: [{
    owlId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl' },
    alias: String,
    avatarEmoji: String
  }],
  description: { type: String, maxlength: 140 },
  startsAt: { type: String },
  status: { type: String, enum: ['open', 'full', 'cancelled'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  sunriseExpiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

module.exports = mongoose.models.Hangout || mongoose.model('Hangout', hangoutSchema);
