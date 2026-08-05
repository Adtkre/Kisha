/* ============================================================
   Kisha backend
   - Real signup/login: passwords hashed with bcrypt, never
     stored or returned in plain text.
   - Sessions are JWTs (30 day expiry) sent as
     Authorization: Bearer <token>.
   - Data (users, cycles, daily logs) is persisted to a JSON
     file on disk at server/data/db.json — swap this file's
     read/write helpers for a real database later without
     touching the route logic.
   ============================================================ */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.txt');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], cycles: [], logs: [] }, null, 2));
}
if (!fs.existsSync(SECRET_FILE)) {
  fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'));
}
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

function readDB() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

const app = express();
app.use(express.json());

/* ---------- auth middleware ---------- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    req.userId = payload.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

/* ================= AUTH ================= */

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are all required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const db = readDB();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.users.find(u => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
    age: null, height: null, weight: null,
    avgCycleLength: 28, avgPeriodLength: 5,
    exerciseFrequency: null, conditions: ''
  };
  db.users.push(user);
  writeDB(db);
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = readDB();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = db.users.find(u => u.email === normalizedEmail);
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

app.put('/api/me', requireAuth, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const editable = ['name', 'age', 'height', 'weight', 'avgCycleLength', 'avgPeriodLength', 'exerciseFrequency', 'conditions'];
  editable.forEach(f => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
  writeDB(db);
  res.json({ user: publicUser(user) });
});

/* ================= CYCLES ================= */

app.get('/api/cycles', requireAuth, (req, res) => {
  const db = readDB();
  const cycles = db.cycles.filter(c => c.userId === req.userId).sort((a, b) => a.startDate.localeCompare(b.startDate));
  res.json({ cycles });
});

app.post('/api/cycles/start', requireAuth, (req, res) => {
  const db = readDB();
  const ongoing = db.cycles.find(c => c.userId === req.userId && !c.endDate);
  if (ongoing) return res.status(409).json({ error: 'A period is already being tracked' });
  const cycle = { id: crypto.randomUUID(), userId: req.userId, startDate: req.body.startDate || todayStr(), endDate: null };
  db.cycles.push(cycle);
  writeDB(db);
  res.json({ cycle });
});

app.post('/api/cycles/end', requireAuth, (req, res) => {
  const db = readDB();
  const ongoing = db.cycles.find(c => c.userId === req.userId && !c.endDate);
  if (!ongoing) return res.status(404).json({ error: 'No period is currently being tracked' });
  ongoing.endDate = req.body.endDate || todayStr();
  writeDB(db);
  res.json({ cycle: ongoing });
});

/* ================= DAILY LOGS ================= */

app.get('/api/logs', requireAuth, (req, res) => {
  const db = readDB();
  let logs = db.logs.filter(l => l.userId === req.userId);
  if (req.query.month) logs = logs.filter(l => l.date.startsWith(req.query.month));
  res.json({ logs });
});

app.get('/api/logs/:date', requireAuth, (req, res) => {
  const db = readDB();
  const log = db.logs.find(l => l.userId === req.userId && l.date === req.params.date);
  res.json({ log: log || null });
});

app.post('/api/logs', requireAuth, (req, res) => {
  const db = readDB();
  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });
  const fields = ['mood', 'flow', 'sleep', 'water', 'exercise', 'stress', 'symptoms', 'notes'];
  let log = db.logs.find(l => l.userId === req.userId && l.date === date);
  if (log) {
    fields.forEach(f => { if (req.body[f] !== undefined) log[f] = req.body[f]; });
  } else {
    log = { id: crypto.randomUUID(), userId: req.userId, date };
    fields.forEach(f => { log[f] = req.body[f] !== undefined ? req.body[f] : null; });
    db.logs.push(log);
  }
  writeDB(db);
  res.json({ log });
});

/* ================= static frontend ================= */
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Kisha server running → http://localhost:${PORT}`);
});
