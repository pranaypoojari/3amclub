const mongoose = require('mongoose');

const lateNightRideSchema = new mongoose.Schema({
  ownerOwlId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl', required: true },
  ownerAlias: { type: String, required: true },
  ownerAvatarEmoji: { type: String },
  city: { type: String, required: true },
  fromArea: { type: String, required: true },
  toArea: { type: String, required: true },
  departureTime: { type: String },
  seatsAvailable: { type: Number, min: 1, max: 6, default: 1 },
  rideType: { type: String, enum: ['offering', 'looking'], required: true },
  note: { type: String, maxlength: 100 },
  joinedOwls: [{
    owlId: { type: mongoose.Schema.Types.ObjectId, ref: 'NightOwl' },
    alias: String
  }],
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  sunriseExpiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

module.exports = mongoose.models.LateNightRide || mongoose.model('LateNightRide', lateNightRideSchema);
