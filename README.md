# Kisha — real auth + real data

This is no longer a demo. Signup/login talk to a real backend:

- Passwords are hashed with **bcrypt** before they ever touch disk — the
  plain password is never stored.
- Sessions are **JWTs** (30-day expiry) issued after a real password check.
- Users, cycles, and daily logs are persisted to
  `server/data/db.json` on your machine.
- If you type a wrong password, login **fails** — there is no bypass.

## Run it

You need [Node.js](https://nodejs.org) installed (v18+ recommended).

```
cd server
npm install
npm start
```

That starts everything — API **and** the website — on one server. Open:

```
http://localhost:4000
```

You'll land on the intro story (`index.html`). Create a real account from
there; it will actually be saved.

## What's real now

- **Signup / Login** — `POST /api/auth/signup`, `POST /api/auth/login`.
  Wrong email or password is rejected with a real error message.
- **Onboarding** — the profile info and last-period dates you enter are
  saved to your account and used immediately on the dashboard.
- **Dashboard** — cycle day, phase, and "next period" countdown are
  computed from your actual saved cycle data, not hardcoded.
- **Start Period / End Period** (via the Quick Log sheet on Dashboard or
  Calendar) write to the database immediately.
- **Daily Log** — saves per-day entries for real; reopening the page on
  the same day loads back what you already entered.
- **Calendar** — period days and "log completed" dots are read from your
  real cycles/logs for the current month.
- **Analytics** — the four stat cards (avg cycle, avg period, cycles
  logged, longest cycle) are computed from your real cycle history. The
  line/bar charts underneath are still illustrative.
- **Profile** — loads and saves your real data via the API.
- **Logout** (Profile & Settings) clears your session and returns to
  `index.html`.

## Where the data lives

`server/data/db.json` — a plain JSON file acting as the database, plus
`server/data/secret.txt` holding the auto-generated JWT signing secret.
Delete `db.json` any time to wipe all accounts and start fresh. For a real
production deployment you'd swap this file for Postgres/MongoDB/etc. —
the route logic in `server/server.js` is written so that swap only touches
the `readDB()`/`writeDB()` helpers.

## Folder structure

```
kisha/
├── index.html, login.html, signup.html, onboarding.html,
│   dashboard.html, calendar.html, dailylog.html,
│   analytics.html, profile.html, settings.html
├── css/style.css
├── js/main.js        shared UI behavior (sheets, selectors, calendar render)
├── js/auth.js         token storage + authFetch + requireAuth guard
└── server/
    ├── server.js       Express API + static file server
    ├── package.json
    └── data/           created automatically on first run
```
