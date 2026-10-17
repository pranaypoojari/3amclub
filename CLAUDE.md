# The 3AM Club — Developer & Claude Code Guide

## Architecture
- **Stack**: Express.js + Mongoose / Zero-Dependency in-memory fallback + Vanilla JS + CSS.
- **Entry point**: `server.js` (Express backend & API routes, rate-limits, auth, SSE).
- **Frontend**: `public/index.html`, `public/js/app.js` (SPA navigation, radar, DMs), `public/css/styles.css`.
- **Database**: Mongoose connects to `MONGODB_URI` or gracefully falls back to `models/inMemoryFallback.js`.

## Token-Saving Rules for Claude Code
- **Never dump whole files**: `app.js` and `styles.css` are large (>2,000 lines). Never `cat` or read the entire file. Use grep with line numbers and read targeted chunks (<150 lines).
- **Narrow command output**: Always limit command outputs (e.g. `head -n 30`) to avoid tool results exceeding 10k tokens.
- **Run tests locally**: Verify backend and edge cases via `node scratch/run_full_e2e_tests.js`.

## Key Commands
- Start dev server: `npm start` or `node server.js`
- Run 56 E2E tests: `node scratch/run_full_e2e_tests.js`
- Generate Excel audit report: `python3 scratch/generate_excel_report.py`
