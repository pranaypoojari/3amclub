const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

const NightOwl = require('./models/NightOwl');
const Follow = require('./models/Follow');
const LateNightRide = require('./models/LateNightRide');
const Hangout = require('./models/Hangout');
const MidnightClink = require('./models/MidnightClink');
const Confession3AM = require('./models/Confession3AM');
const NightlyCapsule = require('./models/NightlyCapsule');
const { seedData } = require('./seed/seedNightOwls');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '200kb' }));

// Dynamic SEO Sitemap & Robots routes
app.get('/sitemap.xml', (req, res) => {
  const host = process.env.SITE_URL || `${req.protocol}://${req.get('host') || 'the3amclub.in'}`;
  const today = new Date().toISOString().split('T')[0];
  const pages = [
    { path: '/', freq: 'daily', prio: '1.0' },
    { path: '/?tab=home', freq: 'hourly', prio: '0.9' },
    { path: '/?tab=map', freq: 'hourly', prio: '0.9' },
    { path: '/?tab=dive', freq: 'daily', prio: '0.8' },
    { path: '/?tab=rides', freq: 'hourly', prio: '0.8' },
    { path: '/?tab=hangouts', freq: 'hourly', prio: '0.8' },
    { path: '/?city=Thane', freq: 'daily', prio: '0.8' },
    { path: '/?city=Mumbai', freq: 'daily', prio: '0.8' },
    { path: '/?city=Bangalore', freq: 'daily', prio: '0.8' },
    { path: '/?city=Pune', freq: 'daily', prio: '0.7' },
    { path: '/?city=Delhi', freq: 'daily', prio: '0.7' },
    { path: '/?city=Hyderabad', freq: 'daily', prio: '0.7' }
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map(p => `  <url>\n    <loc>${host}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.prio}</priority>\n  </url>`).join('\n') +
    `\n</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  const host = process.env.SITE_URL || `${req.protocol}://${req.get('host') || 'the3amclub.in'}`;
  const robots = [
    'User-agent: *',
    'Allow: /',
    'Allow: /?tab=home',
    'Allow: /?tab=map',
    'Allow: /?tab=dive',
    'Allow: /?tab=rides',
    'Allow: /?tab=hangouts',
    'Disallow: /api/messages',
    'Disallow: /api/my-social-state',
    'Disallow: /api/block',
    '',
    `Sitemap: ${host}/sitemap.xml`
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(robots);
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
});

app.get(['/api/health', '/healthz'], async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const activeOwls = dbReady ? await NightOwl.countDocuments({ isOnline: true }).catch(() => 0) : 0;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'starting',
    uptimeSeconds: Math.round(process.uptime()),
    database: dbReady ? 'connected' : 'connecting',
    activeOwls,
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

let clients = [];
function broadcastSSE(event, data) {
  clients.forEach(client => {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const dataDir = path.join(__dirname, '.mongodb-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/the3amclub';
  try {
    console.log('Attempting MongoDB connection...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log('Connected to MongoDB instance');
  } catch (err) {
    console.log('Starting embedded MongoDB Server on port 27017 for MongoDB Compass...');
    const mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbName: 'the3amclub',
        dbPath: dataDir,
        storageEngine: 'wiredTiger'
      },
      binary: {
        version: '7.0.0'
      }
    });
    const uri = mongoServer.getUri();
    await mongoose.connect(uri + 'the3amclub');
    console.log('Connected to embedded MongoDB Server at mongodb://127.0.0.1:27017/the3amclub');
  }
}

async function boot() {
  await connectDB();
  await seedData();
  console.log('Database seeded.');
}

boot().catch(err => {
  console.error('Boot failed:', err);
  process.exit(1);
});


// ----------------------------------------------------
// Per-IP Write Rate Limiter & Location Privacy Helpers
// ----------------------------------------------------
const ipHits = new Map();
function writeRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'local';
  const now = Date.now();
  const entry = ipHits.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  ipHits.set(ip, entry);
  if (entry.count > 80) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  next();
}
app.use(['/api/checkin', '/api/confessions', '/api/messages', '/api/clink', '/api/follow', '/api/block'], writeRateLimit);

function deterministicFuzz(idStr, coord, scale = 0.018) {
  let hash = 0;
  const s = String(idStr || 'owl');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  const normalized = ((Math.abs(hash) % 1000) / 500) - 1; // [-1, 1]
  return Number((coord + normalized * scale).toFixed(4));
}

app.get('/api/status', async (req, res) => {
  const activeOwls = await NightOwl.countDocuments({ isOnline: true });
  res.json({ activeOwls });
});

app.get('/api/owls', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const requester = sessionId ? await NightOwl.findOne({ sessionId }).lean() : null;
    const myId = requester ? String(requester._id) : null;
    const blockedSet = new Set((requester?.blockedOwlIds || []).map(String));

    // Find requester's mutual follower IDs so exact coordinates are ONLY sent for mutuals
    const mutualSet = new Set();
    if (requester) {
      const [myFollows, theirFollows] = await Promise.all([
        Follow.find({ followerId: requester._id, status: 'accepted' }).lean(),
        Follow.find({ followingId: requester._id, status: 'accepted' }).lean()
      ]);
      const followingIds = new Set(myFollows.map(f => String(f.followingId)));
      for (const rev of theirFollows) {
        const fid = String(rev.followerId);
        if (followingIds.has(fid)) mutualSet.add(fid);
      }
    }

    const rawOwls = await NightOwl.find({ isOnline: true }).sort({ checkedInAt: -1 }).lean();
    const safeOwls = rawOwls
      .filter(o => !blockedSet.has(String(o._id)))
      .map(o => {
        const idStr = String(o._id);
        const isMe = myId && idStr === myId;
        const isMutual = isMe || mutualSet.has(idStr);

        const clone = { ...o };
        // Never leak another user's sessionId token in public API responses
        if (!isMe) {
          delete clone.sessionId;
        }

        // Server-side coordinate fuzzing for non-mutuals
        if (!isMutual && clone.coordinates) {
          const rawLat = clone.coordinates.lat || 19.2183;
          const rawLng = clone.coordinates.lng || 72.9781;
          clone.coordinates = {
            lat: deterministicFuzz(idStr + '_lat', rawLat, 0.018),
            lng: deterministicFuzz(idStr + '_lng', rawLng, 0.018)
          };
          clone.exactLocationLocked = true;
        } else {
          clone.exactLocationLocked = false;
        }
        return clone;
      });

    res.json(safeOwls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkin', async (req, res) => {
  try {
    const {
      sessionId: incomingSessionId,
      alias,
      bio,
      pronouns,
      avatarEmoji,
      profileType,
      interests,
      lookingFor,
      socialLinks,
      city,
      neighborhood,
      lat,
      lng,
      auraType,
      beverage,
      statusText,
      currentTrack
    } = req.body;

    const sanitizeStr = (s, max = 160) => String(s || '').replace(/[<>]/g, '').trim().substring(0, max);
    const sessionId = sanitizeStr(incomingSessionId, 64) || ('owl_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36));
    const sunrise = new Date();
    sunrise.setHours(sunrise.getHours() + 6);

    const owl = await NightOwl.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        alias: sanitizeStr(alias, 28) || 'NightOwl',
        bio: sanitizeStr(bio, 160),
        pronouns: sanitizeStr(pronouns, 24),
        avatarEmoji: sanitizeStr(avatarEmoji, 8) || '🦉',
        profileType: profileType === 'closed' ? 'closed' : 'open',
        interests: Array.isArray(interests) ? interests.slice(0, 5).map(i => sanitizeStr(i, 24)) : [],
        lookingFor: Array.isArray(lookingFor) ? lookingFor.slice(0, 5).map(i => sanitizeStr(i, 24)) : [],
        socialLinks: socialLinks || {},
        city: sanitizeStr(city, 40) || 'Thane',
        neighborhood: sanitizeStr(neighborhood, 48),
        coordinates: { lat: Number(lat) || 19.2183, lng: Number(lng) || 72.9781 },
        auraType: ['grind', 'exam', 'vibe', 'gaming'].includes(auraType) ? auraType : 'vibe',
        beverage: sanitizeStr(beverage, 32) || '☕ Coffee',
        statusText: sanitizeStr(statusText, 140),
        currentTrack: sanitizeStr(currentTrack, 80),
        isOnline: true,
        checkedInAt: new Date(),
        lastActiveAt: new Date(),
        sunriseExpiresAt: sunrise
      },
      { new: true, upsert: true }
    );

    broadcastSSE('owl-joined', owl);
    res.json(owl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { sessionId } = req.body;
  await NightOwl.findOneAndUpdate({ sessionId }, { isOnline: false });
  broadcastSSE('owl-left', { sessionId });
  res.json({ success: true });
});

app.post('/api/clink', async (req, res) => {
  try {
    const { fromSessionId, toOwlId, reactionType } = req.body;
    const fromOwl = await NightOwl.findOne({ sessionId: fromSessionId });
    const toOwl = await NightOwl.findById(toOwlId);
    if (!fromOwl || !toOwl) return res.status(404).json({ error: 'Owl not found' });

    // Enforce 1 Cheers per person
    const existing = await MidnightClink.findOne({ fromOwlId: fromOwl._id, toOwlId: toOwl._id });
    if (existing) {
      return res.status(400).json({ alreadyClinked: true, error: 'Already sent Cheers to this person' });
    }

    const sunrise = new Date();
    sunrise.setHours(sunrise.getHours() + 6);

    const fromLat = fromOwl.coordinates?.lat || 19.2183;
    const fromLng = fromOwl.coordinates?.lng || 72.9781;
    const toLat = toOwl.coordinates?.lat || 19.2183;
    const toLng = toOwl.coordinates?.lng || 72.9781;
    const distanceKm = Number(haversineDistance(fromLat, fromLng, toLat, toLng).toFixed(2));

    await MidnightClink.create({
      fromOwlId: fromOwl._id,
      fromAlias: fromOwl.alias,
      fromCity: fromOwl.city || 'Thane',
      fromCoordinates: { lat: fromLat, lng: fromLng },
      toOwlId: toOwl._id,
      toAlias: toOwl.alias,
      toCity: toOwl.city || 'Thane',
      toCoordinates: { lat: toLat, lng: toLng },
      reactionType: ['☕', '⚡', '🫂'].includes(reactionType) ? reactionType : '☕',
      distanceKm,
      sunriseExpiresAt: sunrise
    });

    fromOwl.clinksSent += 1;
    toOwl.clinksReceived += 1;
    await fromOwl.save();
    await toOwl.save();

    broadcastSSE('clink', { fromAlias: fromOwl.alias, toOwlId });
    res.json({ success: true, clinksReceived: toOwl.clinksReceived });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/confessions', async (req, res) => {
  try {
    const { sessionId } = req.query;
    let confessions = await Confession3AM.find().sort({ createdAt: -1 });

    if (sessionId) {
      const requester = await NightOwl.findOne({ sessionId });
      if (requester) {
        const follows = await Follow.find({ followerId: requester._id, status: 'accepted' });
        const followingIds = follows.map(f => f.followingId.toString());

        const filtered = [];
        for (let conf of confessions) {
          const authorId = conf.authorOwlId || conf.authorId;
          if (!authorId) {
            filtered.push(conf);
            continue;
          }

          if (authorId.toString() === requester._id.toString()) {
            filtered.push(conf);
            continue;
          }

          const author = await NightOwl.findById(authorId);
          if (!author || author.profileType === 'open') {
            filtered.push(conf);
          } else if (followingIds.includes(authorId.toString())) {
            filtered.push(conf);
          }
        }
        return res.json(filtered);
      }
    }

    res.json(confessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/confessions', async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    const owl = await NightOwl.findOne({ sessionId });
    if (!owl) return res.status(404).json({ error: 'Check in first to post' });

    const cleanContent = String(content || '').replace(/[<>]/g, '').trim().substring(0, 140);
    owl.statusText = cleanContent;
    owl.lastActiveAt = new Date();
    await owl.save();

    const sunrise = new Date();
    sunrise.setHours(sunrise.getHours() + 6);

    const conf = await Confession3AM.create({
      authorOwlId: owl._id,
      authorAlias: owl.alias,
      city: owl.city || 'Thane',
      auraType: owl.auraType || 'vibe',
      content: cleanContent,
      sunriseExpiresAt: sunrise
    });
    broadcastSSE('confession', conf);
    res.json({ ...conf.toObject(), updatedOwl: owl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/confessions/:id/react', async (req, res) => {
  try {
    const key = req.body.reaction || req.body.emoji || 'fire';
    const conf = await Confession3AM.findById(req.params.id);
    if (!conf) return res.status(404).json({ error: 'Confession not found' });

    if (conf.reactions && typeof conf.reactions[key] === 'number') {
      conf.reactions[key] += 1;
    } else if (conf.reactions) {
      conf.reactions.fire = (conf.reactions.fire || 0) + 1;
    }
    await conf.save();
    broadcastSSE('confession', conf);
    res.json(conf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/confessions/:id/reply', async (req, res) => {
  try {
    const { sessionId, text } = req.body;
    const cleanReply = String(text || '').replace(/[<>]/g, '').trim().substring(0, 140);
    if (!cleanReply) return res.status(400).json({ error: 'Reply text required' });

    const owl = sessionId ? await NightOwl.findOne({ sessionId }) : null;
    if (!owl) return res.status(401).json({ error: 'Check in first to reply' });

    const conf = await Confession3AM.findById(req.params.id);
    if (!conf) return res.status(404).json({ error: 'Post not found' });

    conf.replies = conf.replies || [];
    conf.replies.push({
      authorOwlId: String(owl._id),
      authorAlias: owl.alias,
      authorAvatar: owl.avatarEmoji || '🦉',
      text: cleanReply,
      createdAt: new Date()
    });
    await conf.save();
    broadcastSSE('confession', conf);
    res.json(conf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/block', async (req, res) => {
  try {
    const { sessionId, targetOwlId } = req.body;
    if (!sessionId || !targetOwlId) return res.status(400).json({ error: 'Missing fields' });
    const me = await NightOwl.findOne({ sessionId });
    if (!me) return res.status(401).json({ error: 'Not found' });

    const targetStr = String(targetOwlId);
    me.blockedOwlIds = Array.from(new Set([...(me.blockedOwlIds || []), targetStr]));
    await me.save();

    // Remove any follows & pending message requests between them
    await Follow.deleteMany({
      $or: [
        { followerId: me._id, followingId: targetOwlId },
        { followerId: targetOwlId, followingId: me._id }
      ]
    });
    await MidnightWhisper.deleteMany({
      $or: [
        { fromOwlId: targetStr, toOwlId: String(me._id) },
        { fromOwlId: String(me._id), toOwlId: targetStr }
      ]
    });

    res.json({ success: true, blockedOwlIds: me.blockedOwlIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rsvp', async (req, res) => {
  res.json({ success: true });
});

app.post('/api/sprint', async (req, res) => {
  res.json({ success: true });
});

app.get('/api/capsule/:dateKey', async (req, res) => {
  res.json({ success: true });
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  clients.push({ res });
  req.on('close', () => {
    clients = clients.filter(c => c.res !== res);
  });
});

// ----------------------------------------------------
// New endpoints
// ----------------------------------------------------

app.get('/api/profile/:owlId', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const profile = await NightOwl.findById(req.params.owlId).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    let isFollowing = false;
    let isMutual = false;
    let isOwner = false;
    if (sessionId) {
      const requester = await NightOwl.findOne({ sessionId });
      if (requester) {
        if (requester._id.toString() === profile._id.toString()) {
          isOwner = true;
          isFollowing = true;
          isMutual = true;
        } else {
          const follow = await Follow.findOne({ followerId: requester._id, followingId: profile._id, status: 'accepted' });
          if (follow) isFollowing = true;
          isMutual = await areMutualFollowers(requester._id, profile._id);
        }
      }
    }

    if (!isOwner) {
      delete profile.sessionId;
    }
    if (!isMutual && profile.coordinates) {
      const idStr = String(profile._id);
      profile.coordinates = {
        lat: deterministicFuzz(idStr + '_lat', profile.coordinates.lat || 19.2183, 0.018),
        lng: deterministicFuzz(idStr + '_lng', profile.coordinates.lng || 72.9781, 0.018)
      };
      profile.exactLocationLocked = true;
    }

    if (!isFollowing && !isOwner && profile.socialLinks) {
      for (let platform in profile.socialLinks) {
        if (profile.socialLinks[platform] && profile.socialLinks[platform].handle) {
          if (profile.profileType === 'closed' || !profile.socialLinks[platform].isPublic) {
            profile.socialLinks[platform].handle = '';
            profile.socialLinks[platform].locked = true;
          }
        }
      }
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const { sessionId, bio, age, pronouns, avatarEmoji, profileType, interests, lookingFor, socialLinks, statusText, currentTrack } = req.body;
    const owl = await NightOwl.findOneAndUpdate(
      { sessionId },
      { bio, age, pronouns, avatarEmoji, profileType, interests, lookingFor, socialLinks, statusText, currentTrack },
      { new: true }
    );
    res.json(owl);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/discover', async (req, res) => {
  try {
    const { interests, city } = req.query;
    const query = { isOnline: true };
    if (city) query.city = city;
    
    let owls = await NightOwl.find(query).lean();
    
    if (interests) {
      const interestArr = interests.split(',');
      owls = owls.map(owl => {
        const shared = (owl.interests || []).filter(i => interestArr.includes(i));
        return {
          ...owl,
          sharedInterests: shared.length,
          sharedInterestsList: shared
        };
      });
      owls.sort((a, b) => b.sharedInterests - a.sharedInterests);
    } else {
      owls = owls.map(owl => ({ ...owl, sharedInterests: 0, sharedInterestsList: [] }));
    }
    
    res.json(owls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/follow', async (req, res) => {
  try {
    const { sessionId, targetOwlId } = req.body;
    const follower = await NightOwl.findOne({ sessionId });
    const target = await NightOwl.findById(targetOwlId);
    if (!follower || !target) return res.status(404).json({ error: 'Not found' });

    const existing = await Follow.findOne({ followerId: follower._id, followingId: target._id });
    if (existing) {
      return res.json(existing);
    }

    const status = target.profileType === 'closed' ? 'pending' : 'accepted';

    const follow = await Follow.create({
      followerId: follower._id,
      followerAlias: follower.alias,
      followingId: target._id,
      followingAlias: target.alias,
      status
    });

    if (status === 'accepted') {
      follower.followingCount += 1;
      target.followersCount += 1;
      await follower.save();
      await target.save();

      // For open profiles in the live radar, auto-establish mutual follow back so Pin & DM Inbox unlock
      const reverse = await Follow.findOne({ followerId: target._id, followingId: follower._id });
      if (!reverse) {
        await Follow.create({
          followerId: target._id,
          followerAlias: target.alias,
          followingId: follower._id,
          followingAlias: follower.alias,
          status: 'accepted'
        });
      }
    }

    broadcastSSE('follow', { followerId: follower._id, followingId: target._id, status });
    res.json(follow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unfollow', async (req, res) => {
  try {
    const { sessionId, targetOwlId } = req.body;
    const follower = await NightOwl.findOne({ sessionId });
    const target = await NightOwl.findById(targetOwlId);
    if(!follower || !target) return res.status(404).json({ error: 'Not found' });

    const follow = await Follow.findOneAndDelete({ followerId: follower._id, followingId: target._id });
    if (follow && follow.status === 'accepted') {
      follower.followingCount = Math.max(0, follower.followingCount - 1);
      target.followersCount = Math.max(0, target.followersCount - 1);
      await follower.save();
      await target.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/follow/accept', async (req, res) => {
  try {
    const { sessionId, followId } = req.body;
    const target = await NightOwl.findOne({ sessionId });
    const follow = await Follow.findById(followId);
    if (!target || !follow || follow.followingId.toString() !== target._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    follow.status = 'accepted';
    await follow.save();

    const follower = await NightOwl.findById(follow.followerId);
    follower.followingCount += 1;
    target.followersCount += 1;
    await follower.save();
    await target.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/follow/reject', async (req, res) => {
  try {
    const { sessionId, followId } = req.body;
    const target = await NightOwl.findOne({ sessionId });
    const follow = await Follow.findById(followId);
    if (!target || !follow || follow.followingId.toString() !== target._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await Follow.findByIdAndDelete(followId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/followers/:owlId', async (req, res) => {
  const follows = await Follow.find({ followingId: req.params.owlId, status: 'accepted' });
  res.json(follows);
});

app.get('/api/following/:owlId', async (req, res) => {
  const follows = await Follow.find({ followerId: req.params.owlId, status: 'accepted' });
  res.json(follows);
});

app.get('/api/follow/pending', async (req, res) => {
  const { sessionId } = req.query;
  const target = await NightOwl.findOne({ sessionId });
  if (!target) return res.status(404).json({ error: 'Not found' });
  const follows = await Follow.find({ followingId: target._id, status: 'pending' });
  res.json(follows);
});

app.get('/api/is-following', async (req, res) => {
  const { sessionId, targetOwlId } = req.query;
  const follower = await NightOwl.findOne({ sessionId });
  if(!follower) return res.json({ following: false });
  const follow = await Follow.findOne({ followerId: follower._id, followingId: targetOwlId });
  res.json({ following: !!follow, status: follow ? follow.status : null });
});

app.get('/api/rides', async (req, res) => {
  const { city } = req.query;
  const query = { status: 'active' };
  if (city) query.city = city;
  const rides = await LateNightRide.find(query).sort({ createdAt: -1 });
  res.json(rides);
});

app.post('/api/rides', async (req, res) => {
  try {
    const { sessionId, city, fromArea, toArea, departureTime, seatsAvailable, rideType, note } = req.body;
    const owner = await NightOwl.findOne({ sessionId });
    if (!owner) return res.status(404).json({ error: 'Not found' });
    
    const sunrise = new Date();
    sunrise.setHours(sunrise.getHours() + 6);
    
    const ride = await LateNightRide.create({
      ownerOwlId: owner._id,
      ownerAlias: owner.alias,
      ownerAvatarEmoji: owner.avatarEmoji,
      city, fromArea, toArea, departureTime, seatsAvailable, rideType, note,
      sunriseExpiresAt: sunrise
    });
    broadcastSSE('ride-created', ride);
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rides/:id/join', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const owl = await NightOwl.findOne({ sessionId });
    const ride = await LateNightRide.findById(req.params.id);
    if(!owl || !ride) return res.status(404).json({ error: 'Not found' });
    
    if (ride.seatsAvailable <= 0) return res.status(400).json({ error: 'Ride is full' });
    
    ride.joinedOwls.push({ owlId: owl._id, alias: owl.alias });
    ride.seatsAvailable -= 1;
    await ride.save();
    
    broadcastSSE('ride-joined', ride);
    res.json(ride);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rides/:id', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const owl = await NightOwl.findOne({ sessionId });
    const ride = await LateNightRide.findById(req.params.id);
    
    if (!owl || !ride || ride.ownerOwlId.toString() !== owl._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    ride.status = 'cancelled';
    await ride.save();
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hangouts', async (req, res) => {
  const { city, activity } = req.query;
  const query = { status: 'open' };
  if (city) query.city = city;
  if (activity) query.activity = activity;
  
  const hangouts = await Hangout.find(query).sort({ createdAt: -1 });
  res.json(hangouts);
});

app.post('/api/hangouts', async (req, res) => {
  try {
    const { sessionId, city, spot, activity, maxPeople, description, startsAt } = req.body;
    const owner = await NightOwl.findOne({ sessionId });
    if (!owner) return res.status(404).json({ error: 'Not found' });
    
    const sunrise = new Date();
    sunrise.setHours(sunrise.getHours() + 6);
    
    const hangout = await Hangout.create({
      ownerOwlId: owner._id,
      ownerAlias: owner.alias,
      ownerAvatarEmoji: owner.avatarEmoji,
      city, spot, activity, maxPeople, description, startsAt,
      sunriseExpiresAt: sunrise
    });
    broadcastSSE('hangout-created', hangout);
    res.json(hangout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hangouts/:id/join', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const owl = await NightOwl.findOne({ sessionId });
    const hangout = await Hangout.findById(req.params.id);
    if(!owl || !hangout) return res.status(404).json({ error: 'Not found' });
    
    if (hangout.status !== 'open') return res.status(400).json({ error: 'Hangout not open' });
    
    hangout.joinedOwls.push({ owlId: owl._id, alias: owl.alias, avatarEmoji: owl.avatarEmoji });
    if (hangout.joinedOwls.length >= hangout.maxPeople) {
      hangout.status = 'full';
    }
    await hangout.save();
    
    broadcastSSE('hangout-joined', hangout);
    res.json(hangout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/hangouts/:id', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const owl = await NightOwl.findOne({ sessionId });
    const hangout = await Hangout.findById(req.params.id);
    
    if (!owl || !hangout || hangout.ownerOwlId.toString() !== owl._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    hangout.status = 'cancelled';
    await hangout.save();
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Midnight Whispers (Direct Messages / Chat & Message Requests)
// ----------------------------------------------------
const whisperSchema = new mongoose.Schema({
  fromOwlId: String,
  fromAlias: String,
  fromAvatar: String,
  toOwlId: String,
  toAlias: String,
  text: String,
  isRequest: { type: Boolean, default: false },
  requestStatus: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'accepted' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const MidnightWhisper = mongoose.models.MidnightWhisper || mongoose.model('MidnightWhisper', whisperSchema);

async function areMutualFollowers(owlIdA, owlIdB) {
  if (!owlIdA || !owlIdB) return false;
  const [ab, ba] = await Promise.all([
    Follow.findOne({ followerId: owlIdA, followingId: owlIdB, status: 'accepted' }),
    Follow.findOne({ followerId: owlIdB, followingId: owlIdA, status: 'accepted' })
  ]);
  return !!(ab && ba);
}

app.get('/api/my-social-state', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.json({ clinkedOwlIds: [], mutualOwlIds: [], followingOwlIds: [], pendingOwlIds: [] });
    const me = await NightOwl.findOne({ sessionId });
    if (!me) return res.json({ clinkedOwlIds: [], mutualOwlIds: [], followingOwlIds: [], pendingOwlIds: [] });

    // Seed initial mutuals + 2 incoming Message Requests if user has no follows yet
    const existingFollows = await Follow.countDocuments({ followerId: me._id });
    if (existingFollows === 0) {
      const otherOwls = await NightOwl.find({ _id: { $ne: me._id } }).limit(8);
      // Make first 4 owls mutual followers so they appear in Primary Inbox & Mutual Search
      for (let i = 0; i < Math.min(4, otherOwls.length); i++) {
        const peer = otherOwls[i];
        await Follow.findOneAndUpdate(
          { followerId: me._id, followingId: peer._id },
          { followerId: me._id, followerAlias: me.alias, followingId: peer._id, followingAlias: peer.alias, status: 'accepted' },
          { upsert: true }
        );
        await Follow.findOneAndUpdate(
          { followerId: peer._id, followingId: me._id },
          { followerId: peer._id, followerAlias: peer.alias, followingId: me._id, followingAlias: me.alias, status: 'accepted' },
          { upsert: true }
        );
      }
      // Seed 2 unread Message Requests from non-mutual owls (indices 4 and 5)
      if (otherOwls[4]) {
        await MidnightWhisper.create({
          fromOwlId: String(otherOwls[4]._id),
          fromAlias: otherOwls[4].alias,
          fromAvatar: otherOwls[4].avatarEmoji || '🦉',
          toOwlId: String(me._id),
          toAlias: me.alias,
          text: 'Hey! Saw you are up in Thane too — down for a 3 AM cold coffee run? ☕',
          isRequest: true,
          requestStatus: 'pending',
          isRead: false
        });
      }
      if (otherOwls[5]) {
        await MidnightWhisper.create({
          fromOwlId: String(otherOwls[5]._id),
          fromAlias: otherOwls[5].alias,
          fromAvatar: otherOwls[5].avatarEmoji || '🌙',
          toOwlId: String(me._id),
          toAlias: me.alias,
          text: 'We matched on coding & music! What are you working on tonight? 💻',
          isRequest: true,
          requestStatus: 'pending',
          isRead: false
        });
      }
    }

    const [clinks, myFollows, followersOfMe] = await Promise.all([
      MidnightClink.find({ fromOwlId: me._id }),
      Follow.find({ followerId: me._id }),
      Follow.find({ followingId: me._id, status: 'accepted' })
    ]);

    const clinkedOwlIds = clinks.map(c => String(c.toOwlId));
    const followingOwlIds = myFollows.filter(f => f.status === 'accepted').map(f => String(f.followingId));
    const pendingOwlIds = myFollows.filter(f => f.status === 'pending').map(f => String(f.followingId));
    const followerIdsSet = new Set(followersOfMe.map(f => String(f.followerId)));
    const mutualOwlIds = followingOwlIds.filter(id => followerIdsSet.has(id));

    res.json({ clinkedOwlIds, mutualOwlIds, followingOwlIds, pendingOwlIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.json([]);
    }
    const me = await NightOwl.findOne({ sessionId }).lean();
    if (!me) {
      return res.json([]);
    }
    const myId = String(me._id);
    const blockedSet = new Set((me.blockedOwlIds || []).map(String));

    const msgs = await MidnightWhisper.find({
      requestStatus: { $ne: 'rejected' },
      $or: [
        { fromOwlId: myId },
        { toOwlId: myId }
      ]
    }).sort({ createdAt: 1 }).limit(300).lean();

    const filteredMsgs = msgs.filter(m => !blockedSet.has(String(m.fromOwlId)) && !blockedSet.has(String(m.toOwlId)));
    res.json(filteredMsgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { sessionId, fromSessionId, fromOwlId, fromAlias, fromAvatar, toOwlId, toAlias, text } = req.body;
    const cleanText = String(text || '').replace(/[<>]/g, '').trim().substring(0, 280);
    if (!cleanText || !toOwlId) return res.status(400).json({ error: 'Missing fields' });

    const sid = sessionId || fromSessionId;
    const sender = sid ? await NightOwl.findOne({ sessionId: sid }) : (fromOwlId ? await NightOwl.findById(fromOwlId) : null);
    const senderId = sender ? String(sender._id) : String(fromOwlId || '');
    if (!senderId) return res.status(401).json({ error: 'Check in first to send messages' });

    const isMutual = await areMutualFollowers(senderId, toOwlId);

    // Instagram Rule: If NOT mutual followers, user can only send 1 message request attempt!
    if (!isMutual) {
      const existingAttempt = await MidnightWhisper.findOne({
        fromOwlId: senderId,
        toOwlId: String(toOwlId)
      });
      if (existingAttempt) {
        return res.status(400).json({
          limitReached: true,
          error: 'Message request already sent. You can send more messages once they accept.'
        });
      }
    }

    const msg = await MidnightWhisper.create({
      fromOwlId: senderId,
      fromAlias: sender ? sender.alias : String(fromAlias || 'NightOwl').replace(/[<>]/g, ''),
      fromAvatar: sender ? sender.avatarEmoji : (fromAvatar || '🦉'),
      toOwlId: String(toOwlId),
      toAlias: String(toAlias || 'NightOwl').replace(/[<>]/g, ''),
      text: cleanText,
      isRequest: !isMutual,
      requestStatus: isMutual ? 'accepted' : 'pending',
      isRead: false
    });
    broadcastSSE('whisper', msg);
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/read', async (req, res) => {
  try {
    const { myOwlId, partnerOwlId } = req.body;
    if (myOwlId && partnerOwlId) {
      await MidnightWhisper.updateMany(
        { fromOwlId: String(partnerOwlId), toOwlId: String(myOwlId), isRead: false },
        { $set: { isRead: true } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/accept-request', async (req, res) => {
  try {
    const { sessionId, partnerOwlId } = req.body;
    const me = await NightOwl.findOne({ sessionId });
    const partner = await NightOwl.findById(partnerOwlId);
    if (!me || !partner) return res.status(404).json({ error: 'Not found' });

    // Establish mutual follow
    await Follow.findOneAndUpdate(
      { followerId: me._id, followingId: partner._id },
      { followerId: me._id, followerAlias: me.alias, followingId: partner._id, followingAlias: partner.alias, status: 'accepted' },
      { upsert: true }
    );
    await Follow.findOneAndUpdate(
      { followerId: partner._id, followingId: me._id },
      { followerId: partner._id, followerAlias: partner.alias, followingId: me._id, followingAlias: me.alias, status: 'accepted' },
      { upsert: true }
    );

    // Move messages from Requests to Primary Inbox
    await MidnightWhisper.updateMany(
      {
        $or: [
          { fromOwlId: String(partner._id), toOwlId: String(me._id) },
          { fromOwlId: String(me._id), toOwlId: String(partner._id) }
        ]
      },
      { $set: { isRequest: false, requestStatus: 'accepted', isRead: true } }
    );

    broadcastSSE('follow', { followerId: me._id, followingId: partner._id, status: 'accepted' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/decline-request', async (req, res) => {
  try {
    const { sessionId, partnerOwlId } = req.body;
    const me = await NightOwl.findOne({ sessionId });
    if (!me || !partnerOwlId) return res.status(404).json({ error: 'Not found' });

    await MidnightWhisper.deleteMany({
      $or: [
        { fromOwlId: String(partnerOwlId), toOwlId: String(me._id) },
        { fromOwlId: String(me._id), toOwlId: String(partnerOwlId) }
      ]
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Closing server gracefully...`);
  clients.forEach(c => {
    try { c.res.end(); } catch (_) {}
  });
  clients = [];
  server.close(async () => {
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});


