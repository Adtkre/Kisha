/* ============ Kisha shared behavior ============ */

/* Highlight the active bottom-nav item on load */
function highlightNav(current) {
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.target === current);
  });
}

/* ============ Onboarding wizard (onboarding.html) ============ */
let obStep = 1;
function updateObCards() {
  const cards = document.querySelectorAll('.ob-card');
  if (!cards.length) return;
  cards.forEach(card => {
    const step = parseInt(card.getAttribute('data-step'));
    card.className = 'ob-card';
    if (step < obStep) {
      card.classList.add('swiped-up');
    } else if (step === obStep) {
      card.classList.add('active');
    } else if (step === obStep + 1) {
      card.classList.add('next-1');
    } else if (step === obStep + 2) {
      card.classList.add('next-2');
    } else {
      card.classList.add('next-more');
    }
  });
}

function obChange(dir) {
  const next = obStep + dir;
  if (next < 1 || next > 5) return;
  obStep = next;
  updateObCards();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.ob-stack')) updateObCards();
});

/* ============ Selectors ============ */
function selectPill(el) { el.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('selected')); el.classList.add('selected'); }
function selectSeg(el) { el.parentElement.querySelectorAll('.seg-opt').forEach(p => p.classList.remove('selected')); el.classList.add('selected'); }
function selectEmoji(el) { el.parentElement.querySelectorAll('.emoji-btn').forEach(p => p.classList.remove('selected')); el.classList.add('selected'); }
function toggleChip(el) { el.classList.toggle('selected'); }

/* ============ Toast ============ */
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(-100px)'; }, 2200);
}

/* ============ Bottom Sheets (used on dashboard.html / calendar.html) ============
   Every sheet acts on a specific date (defaults to today when
   opened from the Dashboard's Quick Log button). */
function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function todayISO() { return localDateString(new Date()); }
function formatDateLabel(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
}

async function openSheet(type, dateStr) {
  const content = document.getElementById('sheetContent');
  if (!content) return;
  dateStr = dateStr || todayISO();
  if (dateStr > todayISO()) { return; } // future dates are never actionable

  if (type === 'addlog') {
    let marked = false;
    let periodEnded = false;
    try {
      const [periodRes, endRes] = await Promise.all([
        authFetch('/api/period-days'),
        authFetch('/api/period-end')
      ]);
      const periodData = await periodRes.json();
      const endData = await endRes.json();
      marked = (periodData.dates || []).includes(dateStr);
      periodEnded = endData.date === dateStr;
    } catch (e) { /* offline fallback: assume unmarked */ }

    let html = `<div class="sheet-handle"></div><div class="sheet-title">${formatDateLabel(dateStr)}</div>`;
    if (marked) {
      html += `<div class="sheet-option danger" onclick="closeSheet(); openDialog('remove', '${dateStr}')">Remove Period Mark</div>`;
    } else {
      html += `<div class="sheet-option" onclick="closeSheet(); openDialog('start', '${dateStr}')">Mark as Period Day</div>`;
    }
    if (periodEnded) {
      html += `<div class="sheet-option danger" onclick="closeSheet(); openDialog('remove-end', '${dateStr}')">Remove End of Period Mark</div>`;
    } else {
      html += `<div class="sheet-option" onclick="closeSheet(); openDialog('end', '${dateStr}')">Mark End of Period</div>`;
    }
    html += `<div class="sheet-option" onclick="closeSheet(); window.location.href='dailylog.html?date=${dateStr}'">Add Daily Log</div>
      <div class="sheet-option danger" onclick="closeSheet()">Cancel</div>`;
    content.innerHTML = html;
  }
  document.getElementById('sheetOverlay').classList.add('show');
}
function closeSheet() {
  const ov = document.getElementById('sheetOverlay');
  if (ov) ov.classList.remove('show');
}
function openDialog(type, dateStr) {
  const content = document.getElementById('sheetContent');
  const label = formatDateLabel(dateStr);
  let html = '';
  if (type === 'start') {
    html = `<div class="dialog-box"><h3>Mark ${label} as a period day?</h3><p>You can remove this any time by tapping the date again.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmMarkPeriod('${dateStr}')">Mark</button>
      </div></div>`;
  } else if (type === 'remove') {
    html = `<div class="dialog-box"><h3>Remove period mark?</h3><p>${label} will no longer be counted as a period day.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmUnmarkPeriod('${dateStr}')">Remove</button>
      </div></div>`;
  } else if (type === 'end') {
    html = `<div class="dialog-box"><h3>Mark ${label} as the end of your period?</h3><p>This records the last day of your period for cycle tracking.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmMarkEndPeriod('${dateStr}')">Mark End</button>
      </div></div>`;
  } else if (type === 'remove-end') {
    html = `<div class="dialog-box"><h3>Remove end-of-period mark?</h3><p>${label} will no longer be treated as the end of your period.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmUnmarkEndPeriod('${dateStr}')">Remove</button>
      </div></div>`;
  }
  content.innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('show');
}
async function afterCycleWrite(successMsg) {
  closeSheet();
  toast(successMsg);
  if (typeof onCycleChanged === 'function') onCycleChanged();
  if (typeof buildCalendar === 'function' && document.getElementById('calGrid')) buildCalendar();
}
async function confirmMarkPeriod(dateStr) {
  try {
    await authFetch('/api/period-days', { method: 'POST', body: JSON.stringify({ date: dateStr }) });
    afterCycleWrite('Marked as period day');
  } catch (e) {
    closeSheet();
    toast('Could not save — is the server running?');
  }
}
async function confirmUnmarkPeriod(dateStr) {
  try {
    await authFetch('/api/period-days/' + dateStr, { method: 'DELETE' });
    afterCycleWrite('Mark removed');
  } catch (e) {
    closeSheet();
    toast('Could not save — is the server running?');
  }
}
async function confirmMarkEndPeriod(dateStr) {
  try {
    await authFetch('/api/period-end', { method: 'POST', body: JSON.stringify({ date: dateStr }) });
    afterCycleWrite('End of period saved');
  } catch (e) {
    closeSheet();
    toast('Could not save — is the server running?');
  }
}
async function confirmUnmarkEndPeriod(dateStr) {
  try {
    await authFetch('/api/period-end/' + dateStr, { method: 'DELETE' });
    afterCycleWrite('End mark removed');
  } catch (e) {
    closeSheet();
    toast('Could not save — is the server running?');
  }
}

/* ============ Calendar (calendar.html) — driven by real data ============ */
let currentCalDate = new Date();

function prevMonth() {
  currentCalDate.setMonth(currentCalDate.getMonth() - 1);
  buildCalendar();
}
function nextMonth() {
  currentCalDate.setMonth(currentCalDate.getMonth() + 1);
  buildCalendar();
}

async function buildCalendar() {
  const grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-dow'; el.textContent = d; grid.appendChild(el);
  });

  const year = currentCalDate.getFullYear(), month = currentCalDate.getMonth(); // 0-indexed
  const monthStr = year + '-' + String(month + 1).padStart(2, '0');
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayISO();
  const monthLabelEl = document.getElementById('calMonthLabel');
  if (monthLabelEl) monthLabelEl.textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let periodDateSet = new Set();
  let periodEndSet = new Set();
  let logDateSet = new Set();
  try {
    const [pdRes, endRes, logsRes] = await Promise.all([
      authFetch('/api/period-days'),
      authFetch('/api/period-end'),
      authFetch('/api/logs?month=' + monthStr)
    ]);
    const pdData = await pdRes.json();
    const endData = await endRes.json();
    const logsData = await logsRes.json();
    (pdData.dates || []).forEach(d => periodDateSet.add(d));
    if (endData.date) periodEndSet.add(endData.date);
    (logsData.logs || []).forEach(l => logDateSet.add(l.date));
  } catch (e) { /* offline fallback: render empty calendar */ }

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-cell empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = monthStr + '-' + String(d).padStart(2, '0');
    const el = document.createElement('div'); el.className = 'cal-cell';
    el.textContent = d;
    const isFuture = dateStr > todayStr;
    if (periodDateSet.has(dateStr)) el.classList.add('period');
    if (periodEndSet.has(dateStr)) el.classList.add('period-end');
    if (dateStr === todayStr) el.classList.add('today');
    if (logDateSet.has(dateStr)) { const dot = document.createElement('div'); dot.className = 'dot'; if (periodDateSet.has(dateStr) || periodEndSet.has(dateStr)) dot.style.background = '#fff'; el.appendChild(dot); }
    if (isFuture) {
      el.classList.add('future');
    } else {
      el.onclick = () => openSheet('addlog', dateStr);
    }
    grid.appendChild(el);
  }
}
/* buildCalendar() is invoked explicitly by calendar.html
   after both main.js and auth.js have loaded — calling it
   here at module-load time would race ahead of authFetch
   being defined. */
