const crypto = require('crypto');
const NightOwl = require('../models/NightOwl');
const Follow = require('../models/Follow');
const LateNightRide = require('../models/LateNightRide');
const Hangout = require('../models/Hangout');
const Confession3AM = require('../models/Confession3AM');

const emojis = ['🦉', '🐺', '🌙', '🔮', '👻', '🎃', '🦇', '💀', '🐱', '🦊', '🐸', '🍄', '🌸', '⚡', '🔥', '🎵', '🎮', '📚', '💻', '🧃'];
const allInterests = ['coding', 'music', 'anime', 'gaming', 'photography', 'fitness', 'travel', 'reading', 'art', 'cooking', 'movies', 'crypto', 'startups', 'poetry', 'fashion', 'sports', 'design'];
const allLookingFor = ['study-buddy', 'late-night-ride', 'hangout', 'just-vibing', 'workout-partner', 'creative-collab', 'coffee-walk'];
const auraTypes = ['grind', 'exam', 'vibe', 'gaming'];
const beverages = ['☕ Coffee', '🍵 Chai', '⚡ Energy', '🥛 Milk', '🧃 Juice'];
const pronounsList = ['he/him', 'she/her', 'they/them', 'he/him', 'she/her'];

// Comprehensive Indian locations with high density around Thane / Mumbai MMR + all major Indian cities
const INDIA_HUBS = [
  // Thane & Surrounding MMR (Dense cluster so opening in Thane shows many nearby owls!)
  { city: 'Thane', neighborhood: 'Hiranandani Estate', lat: 19.2552, lng: 72.9841 },
  { city: 'Thane', neighborhood: 'Majiwada', lat: 19.2130, lng: 72.9791 },
  { city: 'Thane', neighborhood: 'Vasant Vihar', lat: 19.2244, lng: 72.9675 },
  { city: 'Thane', neighborhood: 'Upvan Lake', lat: 19.2240, lng: 72.9535 },
  { city: 'Thane', neighborhood: 'Panchpakhadi', lat: 19.1982, lng: 72.9647 },
  { city: 'Thane', neighborhood: 'Ghodbunder Road', lat: 19.2610, lng: 72.9690 },
  { city: 'Thane', neighborhood: 'Naupada', lat: 19.1905, lng: 72.9710 },
  { city: 'Thane', neighborhood: 'Kasarvadavali', lat: 19.2695, lng: 72.9668 },
  { city: 'Thane', neighborhood: 'Manpada', lat: 19.2365, lng: 72.9760 },
  { city: 'Thane', neighborhood: 'Thane East Kopri', lat: 19.1846, lng: 72.9790 },
  // Navi Mumbai & Eastern Suburbs near Thane
  { city: 'Mumbai', neighborhood: 'Mulund West', lat: 19.1726, lng: 72.9425 },
  { city: 'Mumbai', neighborhood: 'Bhandup', lat: 19.1511, lng: 72.9372 },
  { city: 'Navi Mumbai', neighborhood: 'Airoli', lat: 19.1590, lng: 72.9986 },
  { city: 'Navi Mumbai', neighborhood: 'Ghansoli', lat: 19.1197, lng: 73.0053 },
  { city: 'Navi Mumbai', neighborhood: 'Vashi', lat: 19.0771, lng: 72.9986 },
  { city: 'Navi Mumbai', neighborhood: 'Nerul Seawoods', lat: 19.0330, lng: 73.0197 },
  { city: 'Kalyan', neighborhood: 'Kalyan West', lat: 19.2403, lng: 73.1305 },
  { city: 'Dombivli', neighborhood: 'Palava City', lat: 19.1680, lng: 73.0760 },
  // Mumbai Core & Suburbs
  { city: 'Mumbai', neighborhood: 'Powai', lat: 19.1176, lng: 72.9060 },
  { city: 'Mumbai', neighborhood: 'Andheri West', lat: 19.1364, lng: 72.8296 },
  { city: 'Mumbai', neighborhood: 'Bandra Carter Rd', lat: 19.0596, lng: 72.8295 },
  { city: 'Mumbai', neighborhood: 'Juhu Tara Rd', lat: 19.1075, lng: 72.8263 },
  { city: 'Mumbai', neighborhood: 'Ghatkopar East', lat: 19.0860, lng: 72.9090 },
  { city: 'Mumbai', neighborhood: 'Borivali West', lat: 19.2307, lng: 72.8567 },
  { city: 'Mumbai', neighborhood: 'Goregaon Film City', lat: 19.1663, lng: 72.8526 },
  { city: 'Mumbai', neighborhood: 'Dadar Shivaji Park', lat: 19.0178, lng: 72.8478 },
  { city: 'Mumbai', neighborhood: 'Lower Parel', lat: 18.9953, lng: 72.8256 },
  { city: 'Mumbai', neighborhood: 'Marine Drive', lat: 18.9432, lng: 72.8235 },
  // Pune
  { city: 'Pune', neighborhood: 'Koregaon Park', lat: 18.5362, lng: 73.8935 },
  { city: 'Pune', neighborhood: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
  { city: 'Pune', neighborhood: 'Baner', lat: 18.5590, lng: 73.7868 },
  { city: 'Pune', neighborhood: 'Hinjewadi Phase 1', lat: 18.5912, lng: 73.7390 },
  { city: 'Pune', neighborhood: 'FC Road', lat: 18.5236, lng: 73.8410 },
  // Bangalore
  { city: 'Bangalore', neighborhood: 'Indiranagar 100ft Rd', lat: 12.9784, lng: 77.6408 },
  { city: 'Bangalore', neighborhood: 'Koramangala 5th Block', lat: 12.9352, lng: 77.6245 },
  { city: 'Bangalore', neighborhood: 'HSR Layout Sector 2', lat: 12.9116, lng: 77.6474 },
  { city: 'Bangalore', neighborhood: 'Whitefield ITPL', lat: 12.9698, lng: 77.7499 },
  { city: 'Bangalore', neighborhood: 'Church Street', lat: 12.9756, lng: 77.6066 },
  { city: 'Bangalore', neighborhood: 'Jayanagar 4th Block', lat: 12.9308, lng: 77.5838 },
  // Delhi NCR
  { city: 'Delhi', neighborhood: 'Hauz Khas Village', lat: 28.5494, lng: 77.2001 },
  { city: 'Delhi', neighborhood: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
  { city: 'Delhi', neighborhood: 'Saket Select City', lat: 28.5246, lng: 77.2066 },
  { city: 'Gurgaon', neighborhood: 'Cyber Hub', lat: 28.4949, lng: 77.0886 },
  { city: 'Noida', neighborhood: 'Sector 62', lat: 28.6270, lng: 77.3650 },
  // Other Major Indian Cities
  { city: 'Hyderabad', neighborhood: 'Jubilee Hills', lat: 17.4319, lng: 78.4071 },
  { city: 'Hyderabad', neighborhood: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
  { city: 'Chennai', neighborhood: 'Besant Nagar Beach', lat: 13.0003, lng: 80.2667 },
  { city: 'Chennai', neighborhood: 'Anna Nagar', lat: 13.0850, lng: 80.2101 },
  { city: 'Kolkata', neighborhood: 'Park Street', lat: 22.5552, lng: 88.3521 },
  { city: 'Kolkata', neighborhood: 'Salt Lake Sector V', lat: 22.5800, lng: 88.4200 },
  { city: 'Ahmedabad', neighborhood: 'SG Highway', lat: 23.0469, lng: 72.5301 },
  { city: 'Surat', neighborhood: 'Vesu', lat: 21.1418, lng: 72.7709 },
  { city: 'Jaipur', neighborhood: 'C-Scheme', lat: 26.9048, lng: 75.8021 },
  { city: 'Chandigarh', neighborhood: 'Sector 17 Plaza', lat: 30.7415, lng: 76.7787 },
  { city: 'Indore', neighborhood: 'Vijay Nagar', lat: 22.7520, lng: 75.8870 },
  { city: 'Bhopal', neighborhood: 'MP Nagar', lat: 23.2332, lng: 77.4343 },
  { city: 'Nagpur', neighborhood: 'Dharampeth', lat: 21.1410, lng: 79.0600 },
  { city: 'Lucknow', neighborhood: 'Gomti Nagar', lat: 26.8567, lng: 80.9900 },
  { city: 'Kochi', neighborhood: 'Marine Drive Kochi', lat: 9.9772, lng: 76.2773 },
  { city: 'Goa', neighborhood: 'Anjuna / Vagator', lat: 15.5860, lng: 73.7440 }
];

const FIRST_NAMES = [
  'Aarav', 'Riya', 'Kabir', 'Ananya', 'Vihaan', 'Zoya', 'Aditya', 'Meera', 'Ishaan', 'Tara',
  'Rohan', 'Neha', 'Dev', 'Sanya', 'Aryan', 'Kritika', 'Siddharth', 'Pooja', 'Yash', 'Nisha',
  'Karan', 'Aditi', 'Dhruv', 'Shreya', 'Harsh', 'Tanvi', 'Pranav', 'Aisha', 'Varun', 'Dia',
  'Samarth', 'Kiara', 'Nikhil', 'Sneha', 'Arjun', 'Roshni', 'Kunal', 'palak', 'Tushar', 'Mansi'
];

const VIBES_SUFFIX = [
  'AfterDark', 'At3AM', 'NoSleep', 'NightRider', 'Vibes', 'Codes', 'Drifts', 'ChaiLover', 'Midnight', 'Insomniac'
];

const BIOS = [
  'Down for late night Upvan lake drives & chai ☕🚗',
  'Software dev by day, overthinker by 3 AM 💻🌙',
  'Looking for someone to share Spotify playlists & 3AM Maggi with 🎵',
  'Architecture student pulling an all-nighter again 📐',
  'If you listen to The Weeknd or Cigarettes After Sex, hit follow 🎧',
  'Grinding DSA & LeetCode but lowkey want a late night coffee walk',
  'CA Finalist surviving on cold coffee and delusions 📚',
  'Night rides around Hiranandani Estate / Marine Drive 🏍️✨',
  'Valorant till 4 AM or deep existential talks, no in-between 🎮',
  'Just here to meet cool night owls in my city 🦉'
];

const STATUSES = [
  'Craving 3 AM Maggi & cold coffee right now, anyone up?',
  'Debugging production while the city sleeps 💀',
  'Anyone near Thane / Powai down for a quick night drive?',
  'Listening to KK & Arijit on loop in the balcony 🌧️',
  'Need a study accountability partner till 4:30 AM!',
  'Bored out of my mind, swipe my profile & say hi 👋',
  'Late night gym + protein shake done, wide awake ⚡',
  'Who else is wide awake scrolling instead of sleeping?'
];

const TRACKS = [
  'Apocalypse - Cigarettes After Sex',
  'Dil Ibaadat - KK',
  'After Hours - The Weeknd',
  'Tum Ho - Mohit Chauhan',
  'No Pole - Don Toliver',
  'Labon Ko - KK',
  'Starboy - The Weeknd',
  'Dooriyan - Love Aaj Kal',
  'Night Changes - One Direction',
  'Alag Aasmaan - Anuv Jain'
];

function getRandomSubset(arr, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateSeedOwls(count = 100) {
  const owls = [];
  const sunrise = new Date();
  sunrise.setHours(sunrise.getHours() + 6);

  for (let i = 0; i < count; i++) {
    // Ensure first 28 users are densely placed in Thane & Mumbai MMR so Thane users immediately see lots of nearby people!
    const hub = i < 28
      ? INDIA_HUBS[i % 28]
      : INDIA_HUBS[i % INDIA_HUBS.length];

    const name = FIRST_NAMES[i % FIRST_NAMES.length];
    const suffix = VIBES_SUFFIX[Math.floor(i / FIRST_NAMES.length) % VIBES_SUFFIX.length];
    const alias = `${name}_${suffix}${i % 9}`;
    const isClosed = i % 5 === 0; // 20% closed profiles (Instagram private style)
    const aura = auraTypes[i % auraTypes.length];

    // Add slight ~1.2km fuzz around the hub so pins don't stack on the exact same pixel
    const latOffset = (Math.random() - 0.5) * 0.022;
    const lngOffset = (Math.random() - 0.5) * 0.022;

    const owl = new NightOwl({
      alias,
      sessionId: `seed_${i}_${crypto.randomBytes(6).toString('hex')}`,
      bio: BIOS[i % BIOS.length],
      age: 19 + (i % 9),
      pronouns: pronounsList[i % pronounsList.length],
      avatarEmoji: emojis[i % emojis.length],
      profileType: isClosed ? 'closed' : 'open',
      auraType: aura,
      beverage: beverages[i % beverages.length],
      statusText: STATUSES[i % STATUSES.length],
      currentTrack: TRACKS[i % TRACKS.length],
      interests: getRandomSubset(allInterests, 3, 5),
      lookingFor: getRandomSubset(allLookingFor, 1, 3),
      socialLinks: {
        instagram: { handle: `${name.toLowerCase()}.3am_${i}`, isPublic: !isClosed },
        snapchat: { handle: `${name.toLowerCase()}_snap${i}`, isPublic: i % 3 === 0 },
        spotify: { handle: `${name}_playlists`, isPublic: true },
        discord: { handle: `${name}#${1000 + i}`, isPublic: true },
        twitter: { handle: `${name.toLowerCase()}_tweets`, isPublic: !isClosed }
      },
      city: hub.city,
      neighborhood: hub.neighborhood,
      coordinates: {
        lat: Number((hub.lat + latOffset).toFixed(5)),
        lng: Number((hub.lng + lngOffset).toFixed(5))
      },
      clinksReceived: Math.floor(Math.random() * 24) + 1,
      followersCount: Math.floor(Math.random() * 18) + 2,
      followingCount: Math.floor(Math.random() * 15) + 1,
      isOnline: true,
      checkedInAt: new Date(Date.now() - Math.floor(Math.random() * 7200000)),
      lastActiveAt: new Date(),
      sunriseExpiresAt: sunrise
    });
    owls.push(owl);
  }
  return owls;
}

async function seedData() {
  const existingCount = await NightOwl.countDocuments();
  if (existingCount > 0) {
    console.log(`[Seed] Database already contains ${existingCount} Night Owls — skipping destructive re-seed.`);
    return;
  }

  const owls = await generateSeedOwls(100);
  const savedOwls = await NightOwl.insertMany(owls);

  const sunrise = new Date();
  sunrise.setHours(sunrise.getHours() + 6);

  // Seed Realistic Late Night Rides (Thane, Mumbai, Bangalore, Pune, Delhi)
  const rideSeeds = [
    { owlIdx: 0, city: 'Thane', fromArea: 'Hiranandani Estate, Thane', toArea: 'Upvan Lake & Yeoor Foothills', departureTime: '2:15 AM', seatsAvailable: 3, rideType: 'offering', note: 'Cruising in my Swift with sunroof + Arijit Singh playlist. Join for chai!' },
    { owlIdx: 2, city: 'Thane', fromArea: 'Majiwada / Viviana Mall', toArea: 'Marine Drive (via Eastern Express)', departureTime: '2:45 AM', seatsAvailable: 2, rideType: 'offering', note: 'Zero traffic night drive to South Bombay for 3 AM cold coffee 🚗✨' },
    { owlIdx: 4, city: 'Thane', fromArea: 'Vasant Vihar, Thane West', toArea: 'Ghatkopar / Powai', departureTime: '1:50 AM', seatsAvailable: 1, rideType: 'looking', note: 'Anyone riding towards Powai / Hiranandani for late night snacks?' },
    { owlIdx: 20, city: 'Mumbai', fromArea: 'Bandra Carter Road', toArea: 'Worli Sea Face', departureTime: '3:00 AM', seatsAvailable: 2, rideType: 'offering', note: 'Sea Link night drive + Cigarettes After Sex on AUX 🎧' },
    { owlIdx: 28, city: 'Pune', fromArea: 'Koregaon Park', toArea: 'Viman Nagar Symbiosis', departureTime: '2:30 AM', seatsAvailable: 2, rideType: 'offering', note: 'Post-study Maggi & tea run!' },
    { owlIdx: 33, city: 'Bangalore', fromArea: 'Indiranagar 100ft Rd', toArea: 'KIA Airport Toll / Devanahalli', departureTime: '3:15 AM', seatsAvailable: 3, rideType: 'offering', note: 'Classic Bangalore 3 AM airport highway coffee drive ☕' }
  ];

  for (const r of rideSeeds) {
    const owner = savedOwls[r.owlIdx];
    await LateNightRide.create({
      ownerOwlId: owner._id,
      ownerAlias: owner.alias,
      ownerAvatarEmoji: owner.avatarEmoji,
      city: r.city,
      fromArea: r.fromArea,
      toArea: r.toArea,
      departureTime: r.departureTime,
      seatsAvailable: r.seatsAvailable,
      rideType: r.rideType,
      note: r.note,
      sunriseExpiresAt: sunrise
    });
  }

  // Seed Realistic Night Hangouts
  const hangoutSeeds = [
    { owlIdx: 1, city: 'Thane', spot: 'Upvan Lake Promenade, Thane West', activity: 'walk', maxPeople: 5, startsAt: '2:00 AM', description: 'Late night lake breeze + acoustic guitar & deep talks. Chill vibes only!' },
    { owlIdx: 3, city: 'Thane', spot: 'The Walk, Hiranandani Estate Thane', activity: 'coffee', maxPeople: 4, startsAt: '2:30 AM', description: 'Grabbing late night cold coffee & meeting fellow night owls in Thane ☕' },
    { owlIdx: 18, city: 'Mumbai', spot: 'Powai Lake Galleria', activity: 'food', maxPeople: 6, startsAt: '2:45 AM', description: '3 AM Shawarma & Maggi run after coding sprint!' },
    { owlIdx: 34, city: 'Bangalore', spot: 'Empire / Third Wave Koramangala', activity: 'study', maxPeople: 4, startsAt: '1:45 AM', description: 'Co-working & startup brainstorming session till 4 AM 💻' },
    { owlIdx: 39, city: 'Delhi', spot: 'Hauz Khas Social / IIT Gate', activity: 'music', maxPeople: 5, startsAt: '2:15 AM', description: 'Jamming & swapping playlists before sunrise 🎵' }
  ];

  for (const h of hangoutSeeds) {
    const owner = savedOwls[h.owlIdx];
    await Hangout.create({
      ownerOwlId: owner._id,
      ownerAlias: owner.alias,
      ownerAvatarEmoji: owner.avatarEmoji,
      city: h.city,
      spot: h.spot,
      activity: h.activity,
      maxPeople: h.maxPeople,
      startsAt: h.startsAt,
      description: h.description,
      sunriseExpiresAt: sunrise
    });
  }

  // Seed 3AM Confessions
  const confessions = [
    { idx: 0, text: 'Thane at 3 AM hits different when the roads are empty and KK is playing on the stereo 🚗🌙' },
    { idx: 2, text: 'Lowkey came here to study for placements but ended up stalking cute profiles in my neighborhood 👀' },
    { idx: 5, text: 'Why are people awake at 3 AM 10x more interesting than people awake at 10 AM?' },
    { idx: 18, text: 'If we match on 3+ interests (music, coding, late-night rides), I am buying the first round of cold coffee ☕' },
    { idx: 33, text: 'Just pushed to main at 3:14 AM without testing. Pray for my team tomorrow morning 💀' }
  ];

  for (const c of confessions) {
    const author = savedOwls[c.idx];
    await Confession3AM.create({
      authorOwlId: author._id,
      authorAlias: author.alias,
      city: author.city,
      auraType: author.auraType,
      content: c.text,
      reactions: { fire: 14, clink: 9, skull: 5, hug: 11 },
      sunriseExpiresAt: sunrise
    });
  }

  console.log(`[Seed] Successfully seeded ${savedOwls.length} Night Owls across India (including Thane & MMR cluster)!`);
}

module.exports = { seedData };
