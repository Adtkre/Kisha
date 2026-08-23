/* ============================================================
   Kisha backend — PostgreSQL edition
   - Real signup/login: passwords hashed with bcrypt.
   - Sessions are JWTs (30 day expiry) sent as
     Authorization: Bearer <token>.
   - Data lives in a real Postgres database (see schema.sql)
     instead of a JSON file — it survives restarts, redeploys,
     and multiple server instances.
   ============================================================ */
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const ADMIN_EMAIL = 'catpin@gmail.com';
const ADMIN_PASSWORD = '123456';
const ADMIN_NAME = 'catpin';

async function ensureAdminUser() {
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    if (existing.rows.length > 0) return;

    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, age, height, weight, avg_cycle_length, avg_period_length, exercise_frequency, conditions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ADMIN_NAME, ADMIN_EMAIL, passwordHash, 20, 152, 56, 28, 5, 'Rarely', '']
    );
    console.log('Created default admin user:', ADMIN_EMAIL);
  } catch (error) {
    console.error('Failed to ensure admin user exists:', error.message);
  }
}

function localDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function todayStr() { return localDateStr(new Date()); }
function toDateStr(d) { return localDateStr(d); }

/* group a sorted list of unique 'YYYY-MM-DD' strings into consecutive-day runs */
function groupPeriodDays(sortedDates) {
  const groups = [];
  let start = null, end = null;
  for (const d of sortedDates) {
    if (start === null) { start = d; end = d; continue; }
    const prev = new Date(end + 'T00:00:00');
    const cur = new Date(d + 'T00:00:00');
    const diff = Math.round((cur - prev) / 86400000);
    if (diff === 1) { end = d; }
    else { groups.push({ startDate: start, endDate: end }); start = d; end = d; }
  }
  if (start !== null) groups.push({ startDate: start, endDate: end });
  return groups;
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    age: row.age,
    height: row.height,
    weight: row.weight,
    avgCycleLength: row.avg_cycle_length,
    avgPeriodLength: row.avg_period_length,
    exerciseFrequency: row.exercise_frequency,
    conditions: row.conditions
  };
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

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are all required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [String(name).trim(), normalizedEmail, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong, please try again' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const inputPassword = String(password || '');

    if (normalizedEmail === ADMIN_EMAIL && inputPassword === ADMIN_PASSWORD) {
      await ensureAdminUser();
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(inputPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong, please try again' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(result.rows[0]) });
});

app.put('/api/me', requireAuth, async (req, res) => {
  const editable = {
    name: req.body.name,
    age: req.body.age,
    height: req.body.height,
    weight: req.body.weight,
    avg_cycle_length: req.body.avgCycleLength,
    avg_period_length: req.body.avgPeriodLength,
    exercise_frequency: req.body.exerciseFrequency,
    conditions: req.body.conditions
  };
  const sets = [];
  const values = [];
  let i = 1;
  for (const [col, val] of Object.entries(editable)) {
    if (val !== undefined) { sets.push(`${col} = $${i++}`); values.push(val === '' ? null : val); }
  }
  if (!sets.length) {
    const cur = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    return res.json({ user: publicUser(cur.rows[0]) });
  }
  values.push(req.userId);
  const result = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  res.json({ user: publicUser(result.rows[0]) });
});

/* ================= PERIOD DAYS (per-day marking) ================= */

async function updateUserAverages(userId) {
  const pdRes = await pool.query('SELECT date FROM period_days WHERE user_id = $1 ORDER BY date ASC', [userId]);
  const dates = pdRes.rows.map(r => toDateStr(new Date(r.date)));
  const groups = groupPeriodDays(dates);

  if (groups.length === 0) return; // No periods, rely on onboarding data

  // Analyze period lengths
  const periodLengths = groups.map(g => {
    const s = new Date(g.startDate + 'T00:00:00'), e = new Date(g.endDate + 'T00:00:00');
    return Math.round((e - s) / 86400000) + 1;
  });
  const avgPeriodLength = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);

  // Analyze cycle lengths
  if (groups.length >= 2) {
    const gaps = [];
    for (let i = 1; i < groups.length; i++) {
      const prevStart = new Date(groups[i - 1].startDate + 'T00:00:00');
      const curStart = new Date(groups[i].startDate + 'T00:00:00');
      gaps.push(Math.round((curStart - prevStart) / 86400000));
    }
    const avgCycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);

    await pool.query('UPDATE users SET avg_cycle_length = $1, avg_period_length = $2 WHERE id = $3', [avgCycleLength, avgPeriodLength, userId]);
  } else {
    // Only one cycle logged, just update period length
    await pool.query('UPDATE users SET avg_period_length = $1 WHERE id = $2', [avgPeriodLength, userId]);
  }
}

app.get('/api/period-days', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT date FROM period_days WHERE user_id = $1 ORDER BY date ASC',
    [req.userId]
  );
  res.json({ dates: result.rows.map(r => toDateStr(new Date(r.date))) });
});

app.post('/api/period-days', requireAuth, async (req, res) => {
  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });
  if (date > todayStr()) return res.status(400).json({ error: "You can't mark a future date" });
  await pool.query(
    `INSERT INTO period_days (user_id, date) VALUES ($1, $2)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [req.userId, date]
  );
  await updateUserAverages(req.userId);
  res.json({ ok: true, date });
});

app.delete('/api/period-days/:date', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM period_days WHERE user_id = $1 AND date = $2', [req.userId, req.params.date]);
  await updateUserAverages(req.userId);
  res.json({ ok: true, date: req.params.date });
});

app.get('/api/period-end', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT date FROM period_end_dates WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
    [req.userId]
  );
  const date = result.rows[0] ? toDateStr(new Date(result.rows[0].date)) : null;
  res.json({ date });
});

app.post('/api/period-end', requireAuth, async (req, res) => {
  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });
  if (date > todayStr()) return res.status(400).json({ error: "You can't mark a future period end date" });

  await pool.query(
    `INSERT INTO period_end_dates (user_id, date) VALUES ($1, $2)
     ON CONFLICT (user_id, date) DO NOTHING`,
    [req.userId, date]
  );
  await updateUserAverages(req.userId);
  res.json({ ok: true, date });
});

app.delete('/api/period-end/:date', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM period_end_dates WHERE user_id = $1 AND date = $2', [req.userId, req.params.date]);
  await updateUserAverages(req.userId);
  res.json({ ok: true, date: req.params.date });
});

app.get('/api/cycles-summary', requireAuth, async (req, res) => {
  const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = userRes.rows[0];

  const pdRes = await pool.query(
    'SELECT date FROM period_days WHERE user_id = $1 ORDER BY date ASC',
    [req.userId]
  );
  const dates = pdRes.rows.map(r => toDateStr(new Date(r.date)));

  const endRes = await pool.query(
    'SELECT date FROM period_end_dates WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
    [req.userId]
  );
  const periodEndDate = endRes.rows[0] ? toDateStr(new Date(endRes.rows[0].date)) : null;

  const groups = groupPeriodDays(dates);

  let avgCycleLength = (user && user.avg_cycle_length) || 28;
  let longestCycle = null;
  if (groups.length >= 2) {
    const gaps = [];
    for (let i = 1; i < groups.length; i++) {
      const prevStart = new Date(groups[i - 1].startDate + 'T00:00:00');
      const curStart = new Date(groups[i].startDate + 'T00:00:00');
      gaps.push(Math.round((curStart - prevStart) / 86400000));
    }
    avgCycleLength = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    longestCycle = Math.max(...gaps);
  }

  const periodLengths = groups.map(g => {
    const s = new Date(g.startDate + 'T00:00:00'), e = new Date(g.endDate + 'T00:00:00');
    return Math.round((e - s) / 86400000) + 1;
  });
  const avgPeriodLength = periodLengths.length
    ? periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
    : ((user && user.avg_period_length) || 5);

  const lastGroup = groups.length ? groups[groups.length - 1] : null;
  let ongoing = false;
  const currentDate = todayStr();
  if (periodEndDate) {
    const start = lastGroup ? lastGroup.startDate : null;
    ongoing = Boolean(start && currentDate >= start && currentDate <= periodEndDate);
  } else {
    ongoing = dates.includes(currentDate);
  }
  let nextPeriodDate = null;
  if (lastGroup) {
    const base = new Date(lastGroup.startDate + 'T00:00:00');
    nextPeriodDate = toDateStr(new Date(base.getTime() + Math.round(avgCycleLength) * 86400000));
  }

  res.json({
    periodDays: dates,
    cycles: groups,
    cyclesLogged: groups.length,
    avgCycleLength: Math.round(avgCycleLength * 10) / 10,
    avgPeriodLength: Math.round(avgPeriodLength * 10) / 10,
    longestCycle,
    lastPeriodStart: lastGroup ? lastGroup.startDate : null,
    periodEndDate,
    ongoing,
    nextPeriodDate
  });
});

/* ================= DAILY LOGS ================= */

app.get('/api/logs', requireAuth, async (req, res) => {
  let query = 'SELECT * FROM logs WHERE user_id = $1';
  const params = [req.userId];
  if (req.query.month) {
    query += ` AND to_char(date, 'YYYY-MM') = $2`;
    params.push(req.query.month);
  }
  query += ' ORDER BY date ASC';
  const result = await pool.query(query, params);
  res.json({ logs: result.rows.map(rowToLog) });
});

app.get('/api/logs/:date', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM logs WHERE user_id = $1 AND date = $2',
    [req.userId, req.params.date]
  );
  res.json({ log: result.rows.length ? rowToLog(result.rows[0]) : null });
});

app.delete('/api/logs/:date', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM logs WHERE user_id = $1 AND date = $2', [req.userId, req.params.date]);
  res.json({ ok: true, date: req.params.date });
});

app.post('/api/logs', requireAuth, async (req, res) => {
  const { date, mood, flow, pain, sleep, water, exercise, stress, symptoms, notes } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });
  if (date > todayStr()) return res.status(400).json({ error: "You can't log a future date" });

  const result = await pool.query(
    `INSERT INTO logs (user_id, date, mood, flow, pain, sleep, water, exercise, stress, symptoms, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (user_id, date) DO UPDATE SET
       mood = COALESCE(EXCLUDED.mood, logs.mood),
       flow = COALESCE(EXCLUDED.flow, logs.flow),
       pain = COALESCE(EXCLUDED.pain, logs.pain),
       sleep = COALESCE(EXCLUDED.sleep, logs.sleep),
       water = COALESCE(EXCLUDED.water, logs.water),
       exercise = COALESCE(EXCLUDED.exercise, logs.exercise),
       stress = COALESCE(EXCLUDED.stress, logs.stress),
       symptoms = COALESCE(EXCLUDED.symptoms, logs.symptoms),
       notes = COALESCE(EXCLUDED.notes, logs.notes)
     RETURNING *`,
    [req.userId, date, mood || null, flow || null, pain ?? null, sleep ?? null, water ?? null,
    exercise || null, stress || null, JSON.stringify(symptoms || []), notes || null]
  );
  res.json({ log: rowToLog(result.rows[0]) });
});

function rowToLog(row) {
  return {
    id: row.id,
    userId: row.user_id,
    date: toDateStr(new Date(row.date)),
    mood: row.mood,
    flow: row.flow,
    pain: row.pain,
    sleep: row.sleep,
    water: row.water,
    exercise: row.exercise,
    stress: row.stress,
    symptoms: row.symptoms || [],
    notes: row.notes
  };
}

app.get('/api/export/csv', requireAuth, async (req, res) => {
  const [logsRes, pDaysRes, pEndsRes] = await Promise.all([
    pool.query('SELECT * FROM logs WHERE user_id = $1 ORDER BY date ASC', [req.userId]),
    pool.query('SELECT date FROM period_days WHERE user_id = $1', [req.userId]),
    pool.query('SELECT date FROM period_end_dates WHERE user_id = $1', [req.userId])
  ]);

  const map = new Map();
  const addDate = (d) => {
    if (!map.has(d)) map.set(d, { date: d });
    return map.get(d);
  };

  for (const r of logsRes.rows) {
    const d = toDateStr(new Date(r.date));
    const obj = addDate(d);
    obj.mood = r.mood || '';
    obj.flow = r.flow || '';
    obj.pain = r.pain != null ? r.pain : '';
    obj.sleep = r.sleep != null ? r.sleep : '';
    obj.water = r.water != null ? r.water : '';
    obj.exercise = r.exercise || '';
    obj.stress = r.stress || '';
    obj.symptoms = (r.symptoms || []).join(', ');
    obj.notes = (r.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
  }

  for (const r of pDaysRes.rows) {
    addDate(toDateStr(new Date(r.date))).isPeriodDay = 'Yes';
  }
  for (const r of pEndsRes.rows) {
    addDate(toDateStr(new Date(r.date))).isPeriodEnd = 'Yes';
  }

  const sortedDates = Array.from(map.keys()).sort();

  let csv = 'Date,Is_Period_Day,Is_Period_End,Mood,Flow,Pain,Sleep_Hrs,Water_Glasses,Exercise,Stress,Symptoms,Notes\n';
  for (const d of sortedDates) {
    const o = map.get(d);
    csv += `"${d}","${o.isPeriodDay || ''}","${o.isPeriodEnd || ''}","${o.mood || ''}","${o.flow || ''}","${o.pain}","${o.sleep}","${o.water}","${o.exercise || ''}","${o.stress || ''}","${o.symptoms || ''}","${o.notes || ''}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kisha_data.csv"');
  res.send(csv);
});

/* ================= MACHINE LEARNING ================= */
app.get('/api/predictions/next-period', requireAuth, (req, res) => {
  const pythonProcess = spawn('python', ['ml/predict.py', req.userId], { cwd: __dirname });
  let dataString = '';
  pythonProcess.stdout.on('data', (data) => dataString += data.toString());
  pythonProcess.stderr.on('data', (data) => console.error(data.toString()));
  pythonProcess.on('close', (code) => {
    try {
      let filtered = dataString.slice(dataString.indexOf('{'));
      res.json(JSON.parse(filtered));
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse ML output' });
    }
  });
});

app.post('/api/ml/train', requireAuth, (req, res) => {
  const pythonProcess = spawn('python', ['ml/train.py', req.userId], { cwd: __dirname });
  let dataString = '';
  pythonProcess.stdout.on('data', (data) => dataString += data.toString());
  pythonProcess.stderr.on('data', (data) => console.error(data.toString()));
  pythonProcess.on('close', (code) => {
    try {
      let filtered = dataString.slice(dataString.indexOf('{'));
      res.json(JSON.parse(filtered));
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse ML output' });
    }
  });
});

app.get('/api/ml/status', requireAuth, (req, res) => {
  const metaPath = path.join(__dirname, 'ml', 'artifacts', 'metadata.json');
  if (fs.existsSync(metaPath)) {
    res.json(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
  } else {
    res.json({ model_available: false, reason: 'Model not trained yet' });
  }
});

/* ================= static frontend ================= */
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 4000;
(async function startServer() {
  await ensureAdminUser();
  app.listen(PORT, () => {
    console.log(`Kisha server running → http://localhost:${PORT}`);
  });
})();
