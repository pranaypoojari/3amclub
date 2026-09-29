const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl', required: true },
  followerAlias: { type: String },
  followingId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl', required: true },
  followingAlias: { type: String },
  status: { type: String, enum: ['accepted', 'pending'], default: 'accepted' },
  createdAt: { type: Date, default: Date.now }
});

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

module.exports = mongoose.models.Follow || mongoose.model('Follow', followSchema);
