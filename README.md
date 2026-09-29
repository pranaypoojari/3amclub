# 🌙 The 3AM Club — Midnight Social Radar

**The 3AM Club** is a late-night social radar, interest-matching community, and spontaneous night-drive / hangout platform built for Night Owls (`11:00 PM – 5:00 AM`).

---

## ✨ Key Features

1. **🔥 Live Midnight Home Feed & 3AM Thoughts**
   - Discover nearby Night Owls sorted by real-time distance (`km`), shared interests (`#coding`, `#music`, `#anime`, `#gaming`, etc.), and current aura (`🎧 Vibing`, `💻 Grind`, `📚 Exam`, `🎮 Gaming`).
   - Post live 3 AM thoughts (`#wall-form`), send a 1-time highlighted **`☕ Cheers`** (`☕ Cheered ✓`), and reply inline (`💬 Reply`).

2. **🔒 Mutual-Only Live GPS Radar (`🔍 Search Map`)**
   - Built on dark-mode Leaflet.js + OpenStreetMap tiles.
   - **Server-Side Location Privacy:** Exact map pins (`📍 Pin`) are unlocked **exclusively for Mutual Followers**. Non-mutual coordinates are deterministically fuzzed (`±1.8 km`) on the backend (`exactLocationLocked: true`).

3. **🌊 1-Screen Compact `Dive In` + Multi-Select Interests (`Max 5`)**
   - Broadcast your midnight persona on a single compact mobile screen with a horizontal emoji strip and a **Max-5 Multi-Select Interests Dropdown**.
   - Host or join **Late Night Rides (`🚗`)** and **Spontaneous Hangouts (`🎯`)**.

4. **💬 Instagram-Style Messages (`Primary Inbox` vs `Message Requests`)**
   - **Mutual-Only Search Bar** searches exclusively across mutual followers.
   - Non-mutual DMs route to the top-right **`Requests`** inbox (with a glowing unread dot `.unread-dot`) and enforce a **1-message request limit** until accepted (`✓ Accept`, `✕ Decline`, or `🚫 Block`).

5. **🚀 Production & SEO Ready**
   - Dynamic XML Sitemap (`/sitemap.xml`), `/robots.txt`, PWA Web App Manifest (`/manifest.json`), Open Graph + Twitter Cards, and Schema.org `WebApplication` JSON-LD structured data.
   - Health check endpoint at `GET /api/health` (`GET /healthz`), per-IP write rate limiting, XSS input sanitization, session token stripping, and graceful shutdown (`SIGTERM`/`SIGINT`).

---

## 🛠️ Quick Start

```bash
npm install
npm start
```

- **App URL:** `http://localhost:3000`
- **Health Check:** `http://localhost:3000/api/health`
- **Sitemap:** `http://localhost:3000/sitemap.xml`
- **Environment Variables (`.env.example`):**
  - `PORT=3000`
  - `MONGODB_URI=mongodb://127.0.0.1:27017/the3amclub` (automatically falls back to an embedded WiredTiger MongoDB server on port `27017` if no external MongoDB is running)
  - `SITE_URL=https://the3amclub.in`
