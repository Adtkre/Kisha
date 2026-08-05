/* ============ Kisha shared behavior ============ */

/* Highlight the active bottom-nav item on load */
function highlightNav(current){
  document.querySelectorAll('.nav-item').forEach(i=>{
    i.classList.toggle('active', i.dataset.target === current);
  });
}

/* ============ Onboarding wizard (onboarding.html) ============ */
let obStep = 1;
function obChange(dir){
  const next = obStep + dir;
  if(next < 1 || next > 5) return;
  document.querySelector('.ob-step[data-step="'+obStep+'"]').classList.remove('active');
  obStep = next;
  document.querySelector('.ob-step[data-step="'+obStep+'"]').classList.add('active');
  document.getElementById('obProgress').style.width = (obStep*20)+'%';
  document.getElementById('obNav').style.display = obStep===5 ? 'none' : 'flex';
  document.getElementById('obBack').style.visibility = obStep===1 ? 'hidden' : 'visible';
  document.getElementById('obNext').textContent = obStep===4 ? 'Finish' : 'Continue';
}

/* ============ Selectors ============ */
function selectPill(el){ el.parentElement.querySelectorAll('.pill').forEach(p=>p.classList.remove('selected')); el.classList.add('selected'); }
function selectSeg(el){ el.parentElement.querySelectorAll('.seg-opt').forEach(p=>p.classList.remove('selected')); el.classList.add('selected'); }
function selectEmoji(el){ el.parentElement.querySelectorAll('.emoji-btn').forEach(p=>p.classList.remove('selected')); el.classList.add('selected'); }
function toggleChip(el){ el.classList.toggle('selected'); }

/* ============ Toast ============ */
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.style.transform='translateX(-50%) translateY(-100px)'; }, 2200);
}

/* ============ Bottom Sheets (used on dashboard.html / calendar.html) ============ */
async function openSheet(type){
  const content = document.getElementById('sheetContent');
  if(!content) return;
  let html = '';
  if(type==='addlog'){
    const dateLabel = new Date().toLocaleDateString('en-US', { day:'numeric', month:'long' });
    let ongoing = null;
    try{
      const res = await authFetch('/api/cycles');
      const data = await res.json();
      ongoing = data.cycles.find(c => !c.endDate) || null;
    }catch(e){ /* offline fallback: assume no active period */ }

    html = `<div class="sheet-handle"></div><div class="sheet-title">${dateLabel}</div>`;
    if(ongoing){
      html += `<div class="sheet-option danger" onclick="closeSheet(); openDialog('end')">🛑 End Period</div>`;
    } else {
      html += `<div class="sheet-option" onclick="closeSheet(); openDialog('start')">🩸 Start Period</div>`;
    }
    html += `<div class="sheet-option" onclick="closeSheet(); window.location.href='dailylog.html'">📝 Add Daily Log</div>
      <div class="sheet-option danger" onclick="closeSheet()">Cancel</div>`;
  }
  content.innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('show');
}
function closeSheet(){
  const ov = document.getElementById('sheetOverlay');
  if(ov) ov.classList.remove('show');
}
async function openDialog(type){
  const content = document.getElementById('sheetContent');
  let html = '';
  if(type==='start'){
    html = `<div class="dialog-box"><h3>Start your period today?</h3><p>We'll begin tracking this cycle from today.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmStartPeriod()">Start</button>
      </div></div>`;
  } else if(type==='end'){
    html = `<div class="dialog-box"><h3>Period ended today?</h3><p>We'll close out this cycle and add it to your history.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="confirmEndPeriod()">End</button>
      </div></div>`;
  }
  content.innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('show');
}
async function confirmStartPeriod(){
  try{
    await authFetch('/api/cycles/start', { method:'POST', body: JSON.stringify({}) });
    closeSheet();
    toast('Period started 🩸');
    if(typeof onCycleChanged === 'function') onCycleChanged();
  }catch(e){
    closeSheet();
    toast('Could not save — is the server running?');
  }
}
async function confirmEndPeriod(){
  try{
    await authFetch('/api/cycles/end', { method:'POST', body: JSON.stringify({}) });
    closeSheet();
    toast('Period ended ✓');
    if(typeof onCycleChanged === 'function') onCycleChanged();
  }catch(e){
    closeSheet();
    toast('Could not save — is the server running?');
  }
}

/* ============ Calendar (calendar.html) — driven by real data ============ */
async function buildCalendar(){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.innerHTML='';
  ['S','M','T','W','T','F','S'].forEach(d=>{
    const el = document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el);
  });

  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(); // 0-indexed
  const monthStr = year + '-' + String(month+1).padStart(2,'0');
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayDate = now.getDate();
  const monthLabelEl = document.getElementById('calMonthLabel');
  if(monthLabelEl) monthLabelEl.textContent = now.toLocaleDateString('en-US',{month:'long', year:'numeric'});

  let periodDaySet = new Set();
  let logDaySet = new Set();
  try{
    const cyclesRes = await authFetch('/api/cycles');
    const cyclesData = await cyclesRes.json();
    (cyclesData.cycles || []).forEach(c=>{
      const start = new Date(c.startDate + 'T00:00:00');
      const end = c.endDate ? new Date(c.endDate + 'T00:00:00') : new Date();
      for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
        if(d.getFullYear()===year && d.getMonth()===month) periodDaySet.add(d.getDate());
      }
    });
    const logsRes = await authFetch('/api/logs?month=' + monthStr);
    const logsData = await logsRes.json();
    (logsData.logs || []).forEach(l => logDaySet.add(Number(l.date.slice(8,10))));
  }catch(e){ /* offline fallback: render empty calendar */ }

  for(let i=0;i<firstDay;i++){
    const el = document.createElement('div'); el.className='cal-cell empty'; grid.appendChild(el);
  }
  for(let d=1; d<=daysInMonth; d++){
    const el = document.createElement('div'); el.className='cal-cell';
    el.textContent = d;
    if(periodDaySet.has(d)) el.classList.add('period');
    if(d===todayDate) el.classList.add('today');
    if(logDaySet.has(d)){ const dot=document.createElement('div'); dot.className='dot'; if(periodDaySet.has(d)) dot.style.background='#fff'; el.appendChild(dot); }
    el.onclick = ()=>openSheet('addlog');
    grid.appendChild(el);
  }
}
if(document.getElementById('calGrid')) buildCalendar();
