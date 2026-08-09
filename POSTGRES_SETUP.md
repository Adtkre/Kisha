# Kisha ko PostgreSQL ke saath chalana — step by step

Pehle jo `server/data/db.json` file thi, wo ek plain JSON file thi — server
restart/redeploy hone pe ya file accidentally delete hone pe data gayab ho
sakta tha. Ab backend real **PostgreSQL** database use karta hai
(`server/server.js` — maine test bhi kiya hai, server restart karne ke baad
bhi saara data (account, period marks) waisa hi rehta hai).

---

## Step 1 — Postgres install karo

**Windows / Mac:** [postgresql.org/download](https://www.postgresql.org/download/)
se installer download karo aur normal install kar lo. Install ke dauraan jo
password set karoge (superuser `postgres` ke liye), wo yaad rakhna.

**Mac (Homebrew):**
```
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Ya phir Docker se** (agar Docker install hai, sabse aasaan):
```
docker run --name kisha-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```
Isse `postgres`/`postgres` credentials ke saath ek Postgres turant chal jaayega
— upar wale "install" steps skip kar sakte ho.

## Step 2 — Database banao

Terminal me:
```
psql -U postgres -c "CREATE DATABASE kisha;"
```
(Password maangega agar tumne set kiya tha — install ke time wala password
dalo. Docker wale flow me password `postgres` hai.)

## Step 3 — Schema (tables) banao

`server/schema.sql` file me saari tables (`users`, `period_days`, `logs`)
already likhi hui hain. Bas run karo:
```
psql -U postgres -d kisha -f server/schema.sql
```
Isse 3 tables + indexes ban jaayenge. Isko sirf **ek baar** karna hai.

## Step 4 — `.env` file banao

`server` folder ke andar `.env.example` ko copy karke `.env` banao:
```
cd server
cp .env.example .env
```
Ab `.env` file kholo aur values apne hisaab se set karo:
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kisha
JWT_SECRET=kuch_bhi_lamba_random_string
PORT=4000
```
`DATABASE_URL` ka format: `postgres://USER:PASSWORD@HOST:PORT/DATABASE`
— agar tumne apna password set kiya tha to `postgres:postgres` ki jagah
`postgres:TUMHARA_PASSWORD` likho.

`JWT_SECRET` ke liye ek random string generate karne ka aasaan tareeka:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Jo output aaye, wahi `.env` me paste kar do.

## Step 5 — Install & run

```
npm install
npm start
```
Browser me `http://localhost:4000` kholo — bas, ab data real Postgres me
save ho raha hai. Server restart karo, computer restart karo, kuch bhi karo
— account aur period data waisa hi milega.

---

## Kya badla hai

- `server/server.js` ab `pg` library se Postgres se baat karta hai
  (pehle wala plain-JSON-file wala server `server-jsonfile-legacy.js` naam
  se rakha hai reference ke liye — use nahi hoga jab tak tum khud
  `node server-jsonfile-legacy.js` na chalao).
- Saare API routes (`/api/auth/*`, `/api/period-days`, `/api/logs`,
  `/api/cycles-summary`, `/api/me`) bilkul same hain — koi frontend file
  change nahi karni padi, sirf storage layer badla hai.
- `server/schema.sql` — tables ka structure.
- `server/.env.example` — konsi config values chahiye, uska template.

## Common issues

- **`Missing DATABASE_URL`** error aaye to matlab `.env` file nahi bani ya
  `server` folder ke andar nahi hai.
- **`ECONNREFUSED`** aaye to matlab Postgres chal hi nahi raha — `service
  postgresql start` (Linux) ya Docker container check karo.
- **`password authentication failed`** to matlab `.env` me password galat
  hai — jo password Postgres install/Docker ke time set kiya tha, wahi
  daalo.
- Password bhool gaye ho to reset kar sakte ho:
  ```
  psql -U postgres -c "ALTER USER postgres PASSWORD 'naya_password';"
  ```
