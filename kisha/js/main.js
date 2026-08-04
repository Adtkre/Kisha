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
function openSheet(type){
  const content = document.getElementById('sheetContent');
  if(!content) return;
  let html = '';
  if(type==='addlog'){
    html = `<div class="sheet-handle"></div><div class="sheet-title">29 July</div>
      <div class="sheet-option" onclick="closeSheet(); openDialog('start')">🩸 Start Period</div>
      <div class="sheet-option" onclick="closeSheet(); window.location.href='dailylog.html'">📝 Add Daily Log</div>
      <div class="sheet-option danger" onclick="closeSheet()">Cancel</div>`;
  }
  content.innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('show');
}
function closeSheet(){
  const ov = document.getElementById('sheetOverlay');
  if(ov) ov.classList.remove('show');
}
function openDialog(type){
  const content = document.getElementById('sheetContent');
  let html = '';
  if(type==='start'){
    html = `<div class="dialog-box"><h3>Start your period today?</h3><p>We'll begin tracking this cycle from today.</p>
      <div class="dialog-actions">
        <button class="clay-btn btn-secondary" style="flex:1;" onclick="closeSheet()">Cancel</button>
        <button class="clay-btn btn-primary" style="flex:1;" onclick="closeSheet(); toast('Period started 🩸')">Start</button>
      </div></div>`;
  }
  content.innerHTML = html;
  document.getElementById('sheetOverlay').classList.add('show');
}

/* ============ Calendar (calendar.html) ============ */
function buildCalendar(){
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.innerHTML='';
  ['S','M','T','W','T','F','S'].forEach(d=>{
    const el = document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el);
  });
  const firstDay = 6; // Aug 1 2026 is a Saturday
  const daysInMonth = 31;
  const periodDays = [1,2,3,4,5];
  const logDays = [10,11,12,13,20,21];
  const today = 4;
  for(let i=0;i<firstDay;i++){
    const el = document.createElement('div'); el.className='cal-cell empty'; grid.appendChild(el);
  }
  for(let d=1; d<=daysInMonth; d++){
    const el = document.createElement('div'); el.className='cal-cell';
    el.textContent = d;
    if(periodDays.includes(d)) el.classList.add('period');
    if(d===today) el.classList.add('today');
    if(logDays.includes(d)){ const dot=document.createElement('div'); dot.className='dot'; if(periodDays.includes(d)) dot.style.background='#fff'; el.appendChild(dot); }
    el.onclick = ()=>openSheet('addlog');
    grid.appendChild(el);
  }
}
if(document.getElementById('calGrid')) buildCalendar();