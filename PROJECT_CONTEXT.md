# 🎃 THE 3AM CLUB — Full Project Context & Handoff Document

## 1. Project Overview & Core Vision
**The 3AM Club** is a time-gated, Halloween-nightlife-themed social & lowkey-dating radar web application for Gen Z Night Owls across India (with dense coverage in **Thane / Mumbai MMR**, Pune, Bangalore, Delhi NCR, Hyderabad, Chennai, etc.).
- **Core Hook:** The club is locked during the day (`5:00 AM – 11:00 PM`) behind a haunted countdown vault (with a **`🌊 Dive In Now (3AM Override)`** button for daytime testing). At night, everything comes alive on a live GPS map & Instagram-style feed, and **everything wipes clean at 5:00 AM Sunrise** via MongoDB TTL indexes.
- **Vibe & Positioning:** A mix of a late-night social radar, interest-based meeting/lowkey dating app (see who shares your interests and is down for late-night drives or 3 AM coffee), and Instagram-style open/private profile system.

---

## 2. Project Location & Tech Stack
- **Workspace Root:** `./3amclub`
- **Backend:** Node.js + Express (`server.js`) running on **`http://localhost:3000`**
- **Database:** MongoDB + Mongoose (`models/`).
  - Automatically tries connecting to local `mongodb://127.0.0.1:27017/the3amclub`.
  - If no local `mongod` service is running, it automatically boots an embedded **`mongodb-memory-server-core` (v7.0.0)** bound to **port `27017`** with disk persistence in `.mongodb-data/`, so **MongoDB Compass** can always connect to **`mongodb://127.0.0.1:27017/the3amclub`**.
- **Real-Time Sync:** Server-Sent Events (`GET /api/stream` SSE hub) broadcasting live check-ins, clinks, rides, hangouts, follows, confessions, and whispers.
- **Frontend:** Vanilla HTML5 / CSS3 / JS (`public/`) with:
  - **Leaflet.js** + OpenStreetMap tiles styled with a custom `.dark-tiles` CSS filter (no API key required).
  - **ReactBits Interactive Engine (`public/js/reactbits.js`)**: `ClickSpark` (radial neon spark burst on click), `SpotlightCard` (cursor-following radial neon glow), `TiltedCard` (3D perspective hover tilt), `DecryptedText` (cyber-glyph text scramble), and `MagnetButton`.

---

## 3. Complete File Structure
```text
./3amclub/
├── package.json                  # Dependencies: express, mongoose, cors, mongodb-memory-server-core
├── server.js                     # Express server, MongoDB port 27017 auto-boot, SSE hub, all REST APIs
├── .mongodb-data/                # Persistent WiredTiger data files for MongoDB Compass
├── models/
│   ├── NightOwl.js               # User profile, coordinates, auraType, interests, lookingFor, socialLinks, open/closed flag
│   ├── Follow.js                 # Instagram-style follow/request relationships (accepted vs pending for closed profiles)
│   ├── LateNightRide.js          # Late Night Rides (offering vs looking, pickup -> drop, seats, joinedOwls)
│   ├── Hangout.js                # Spontaneous Night Hangouts (spot, activity, maxPeople, joinedOwls)
│   ├── Confession3AM.js          # 3AM Thought Wall posts (with follower-gated visibility for closed profiles)
│   ├── MidnightClink.js          # Cheers / Vibe / Wave interactions with Haversine distance
│   └── NightlyCapsule.js         # Nightly recap stats & daytime RSVPs
├── seed/
│   └── seedNightOwls.js          # Seeds 100 realistic Indian Gen Z profiles (28 in Thane & Mumbai MMR + 72 across India), 6 Rides, 5 Hangouts, 5 Confessions
└── public/
    ├── index.html                # Vault Screen + Instagram-style 5-Tab Swipeable Club Screen
    ├── css/
    │   └── styles.css            # Halloween Nightlife theme, 500%-width swipe track, SpotlightCard glow, responsive DM drawer
    └── js/
        ├── reactbits.js          # ClickSpark, SpotlightCard, TiltedCard, DecryptedText, MagnetButton
        ├── map.js                # NightMap Leaflet module, Thane default geo + live GPS pin, Haversine km distance
        └── app.js                # Main controller: 5-tab navigation, touch swipe engine, Search dropdown, Dive In, Messages DM, Profile
```

---

## 4. Current UI Architecture (Instagram-Style 5-Tab + Swipeable Deck)
The Club screen uses a **5-Tab Bottom Navigation Bar** (`#insta-bottom-nav`) with **Horizontal Touch Swipe** (`swipe-viewport` / `swipe-track` in `public/index.html` & `public/js/app.js`):

1. **Tab 0 — `🏠 Home` (`#page-home`):**
   - **Instagram-style Top Story Rings (`#insta-stories-bar`):** Switch between `🔥 Nearby All`, `🚗 Night Rides`, `🎯 Hangouts`, `💭 3AM Wall`, plus dynamic avatar rings of the closest Night Owls near you.
   - **Quick Compose Bar (`#wall-form`):** Post a 3 AM thought/status right at the top.
   - **Unified Feed (`#home-unified-feed`):** Cards sorted by closest distance (`km` away from Thane / your live GPS), highlighting **`🔥 X Shared Interests`**, `✨ Down For Tonight` tags, and 1-tap buttons: `🗺️ Pin`, `💬 DM`, `☕ Cheers`, `⚡ Vibe`, `👋 Say Hi`, and `➕ Follow` / `🔒 Request`.
2. **Tab 1 — `🔍 Search Map` (`#page-search`):**
   - **Main View:** Full-screen dark Leaflet map (`#map`) centered on **Thane (`19.2183, 72.9781`) / Live GPS** (`zoom: 12`).
   - **Top Floating Search Bar (`#map-user-search`):** Search any `@username`, `#interest` (*coding, music, anime*), or area (*Thane, Hiranandani, Bandra, Powai*) with a live dropdown (`#search-results-dropdown`) to jump to their pin or DM them.
   - **Expandable Radar Filter Pill (`#legend-toggle-btn`):** Sits cleanly below the top search bar (`🌐 All Owls (100)`, `📍 Nearby Me (< 15 km)`, `💻 Grind`, `📚 Exam`, `🎧 Vibe`, `🎮 Gaming`, `🚗 Down for Late Night Ride`).
3. **Tab 2 — `🌊 Dive In` (`#page-dive` — Center Glowing Orb Button):**
   - Replaces traditional "Check In" with a 3-mode action deck:
     - `⚡ Broadcast My Vibe` (Set avatar, `@alias`, bio, city/area, aura, interests, lookingFor, public/private social links, and `🔓 Open` vs `🔒 Private` account mode).
     - `🚗 Host / Find Ride` (Post or join late-night drives).
     - `🎯 Start Hangout` (Host or join spontaneous midnight hangouts).
4. **Tab 3 — `💬 Messages` (`#page-messages` — Midnight Whispers DM Inbox):**
   - Backed by the `MidnightWhisper` collection (`GET /api/messages`, `POST /api/messages`).
   - Shows nearby Night Owls in a thread list (`#dm-thread-list`) + live chat drawer (`#dm-chat-panel`) with 1-tap icebreaker pills (`🚗 Night Drive?`, `☕ 3AM Coffee?`, `🎧 Song check?`).
5. **Tab 4 — `👤 Profile` (`#page-profile`):**
   - Instagram-style profile header with gradient avatar ring, `@Alias`, `🔓 Public` / `🔒 Private` badge, `Followers | Following | ☕ Cheers` counters, bio, interest pills, and connected social handles (locked with `🔒 Follow to unlock @handle` if private and not followed).

---

## 5. How to Start & Run in the New Chat
```bash
cd ./3amclub
node server.js
```
- **Web App URL:** `http://localhost:3000`
- **MongoDB Compass URI:** `mongodb://127.0.0.1:27017/the3amclub`
