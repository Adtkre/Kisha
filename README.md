# Kisha — real auth + real data

This is no longer a demo. Signup/login talk to a real backend:

- Passwords are hashed with **bcrypt** before they ever touch disk — the
  plain password is never stored.
- Sessions are **JWTs** (30-day expiry) issued after a real password check.
- Users, cycles, and daily logs are persisted to
  `server/data/db.json` on your machine.
- If you type a wrong password, login **fails** — there is no bypass.

## Run it

You need [Node.js](https://nodejs.org) (v18+) **and PostgreSQL** installed.

**First time setup** — see `POSTGRES_SETUP.md` for the full step-by-step
(installing Postgres, creating the database, running the schema, setting
up `.env`). Short version:

```
cd server
cp .env.example .env      # then edit .env with your DB password + a JWT secret
psql -U postgres -c "CREATE DATABASE kisha;"
psql -U postgres -d kisha -f schema.sql
npm install
npm start
```

That starts everything — API **and** the website — on one server. Open:

```
http://localhost:4000
```

Data now lives in a real Postgres database, so it survives server
restarts, redeploys, and crashes — unlike the old JSON-file version.

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

Real PostgreSQL — `users`, `period_days`, and `logs` tables, defined in
`server/schema.sql`. Connection details live in `server/.env` (see
`.env.example` and `POSTGRES_SETUP.md`). Restarting the server, your
computer, or redeploying no longer wipes anything.

The older single-file JSON version is kept as
`server/server-jsonfile-legacy.js` for reference only — it is not used
unless you run it directly.

## Folder structure

```
kisha/
├── index.html, login.html, signup.html, onboarding.html,
│   dashboard.html, calendar.html, dailylog.html,
│   analytics.html, profile.html, settings.html
├── css/style.css
├── js/main.js         shared UI behavior (sheets, selectors, calendar render)
├── js/auth.js          token storage + authFetch + requireAuth guard
├── POSTGRES_SETUP.md   step-by-step Postgres setup guide
└── server/
    ├── server.js               Express API (Postgres) + static file server
    ├── server-jsonfile-legacy.js   old JSON-file version, kept for reference
    ├── schema.sql               table definitions
    ├── .env.example              config template — copy to .env
    └── package.json
```
