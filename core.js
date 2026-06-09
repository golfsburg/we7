// ═══════════════════════════════════════════════════════════
// CORE.JS  —  shared state, supabase, utilities, navigation
// ═══════════════════════════════════════════════════════════
const APP = (() => {
'use strict';

// ── CONFIG ───────────────────────────────────────────────
const SB_URL  = 'https://yhbdddzmymsfyxwxoiao.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloYmRkZHpteW1zZnl4d3hvaWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MDg1MjksImV4cCI6MjA5NTQ4NDUyOX0.LqZHFcR9mbK9HQHZlIsHGGlr2RT-QzsdCbcb7zza4Z0';
const APP_PW  = 'We7-Tracker-P!nggau';
const PW_KEY  = 'pv_unlocked';
const PV_TBL  = 'pv_entries';
const CV_TBL  = 'consumption_15min';

// ── CONSTANTS ────────────────────────────────────────────
const MONTHS      = ['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONTHS_FULL = ['Jänner','Februar','März','April','Mai','Juni','Juli','August',
                     'September','Oktober','November','Dezember'];
const BASE_H      = [25,42,85,130,158,165,178,158,115,70,30,20];
const GC = 'rgba(255,255,255,0.05)';
const TC = '#6b7080';

// ── STATE ────────────────────────────────────────────────
let cfg = {
  lat:47.52, lon:16.03, tilt:35, az:-45, wp:800,
  inv:'Growatt NEO 800M-X', price:0.30, feedRate:0.082, selfPct:50
};
let theory = [];
let entries = [];      // PV records
let consumption = [];  // Smart meter 15-min records
let tombstones    = new Set(); // PV IDs deleted locally
let cvTombstones  = new Set(); // CV IDs deleted locally
let charts = {};
let sbClient = null;
let syncTimer = null, syncPending = false;
let pages = {};        // registered page modules

// ── LOAD / SAVE ──────────────────────────────────────────
function loadStorage() {
  try { const c = localStorage.getItem('pv_cfg');  if (c) cfg         = {...cfg,...JSON.parse(c)}; } catch(e){}
  try { const e = localStorage.getItem('pv_ent');  if (e) entries     = JSON.parse(e); } catch(e){}
  try { const v = localStorage.getItem('pv_cv');
    if (v) {
      const raw = JSON.parse(v);
      consumption = raw.map(c => ({
        ...c,
        date:   String(c.date).substring(0, 10),
        hour:   parseInt(c.hour,   10),
        minute: parseInt(c.minute, 10),
        kwh:    parseFloat(c.kwh)
      }));
    }
  } catch(e){}
  // Load tombstones (deleted IDs that must never be re-imported from Supabase)
  try { const t = localStorage.getItem('pv_tombstones'); if (t) tombstones = new Set(JSON.parse(t)); } catch(e){}
  try { const t = localStorage.getItem('cv_tombstones'); if (t) cvTombstones = new Set(JSON.parse(t)); } catch(e){}
}
function saveTombstones() {
  try { localStorage.setItem('pv_tombstones', JSON.stringify([...tombstones])); } catch(e){}
}
function saveCvTombstones() {
  try { localStorage.setItem('cv_tombstones', JSON.stringify([...cvTombstones])); } catch(e){}
}
function savePv(sync=true) {
  try { localStorage.setItem('pv_cfg', JSON.stringify(cfg));
        localStorage.setItem('pv_ent', JSON.stringify(entries)); } catch(e){}
  if (sync) scheduleSync();
}
function saveCv(sync=true) {
  try { localStorage.setItem('pv_cv', JSON.stringify(consumption)); } catch(e){}
  if (sync) scheduleSync();
}

// ── THEORY ───────────────────────────────────────────────
function computeTheory() {
  const azF = {0:1.0,'-45':0.93,'45':0.93,'-90':0.80,'90':0.80,'-135':0.65,'135':0.65,'180':0.45};
  const af = azF[String(cfg.az)] || 0.93;
  const tf = Math.max(0.75, 1 - Math.abs(cfg.tilt - 35) * 0.004);
  const m2 = cfg.wp / 200;
  theory = BASE_H.map(h => parseFloat((h * af * tf * m2 * 0.82).toFixed(2)));
}
function dailyTheory(date) {
  const d = new Date(date), m = d.getMonth();
  const days = new Date(d.getFullYear(), m+1, 0).getDate();
  return parseFloat((theory[m] / days).toFixed(3));
}
function weeklyTheory(date) {
  let t = 0; const s = new Date(date);
  for (let i=0; i<7; i++) {
    const d = new Date(s); d.setDate(d.getDate()+i);
    t += dailyTheory(d.toISOString().split('T')[0]);
  }
  return parseFloat(t.toFixed(2));
}
function getTheory(e) {
  if (e.type==='day')   return dailyTheory(e.date);
  if (e.type==='week')  return weeklyTheory(e.date);
  return theory[new Date(e.date).getMonth()];
}

// ── CALCULATIONS ─────────────────────────────────────────
function calcEuro(e) {
  const s = e.self  != null ? e.self  : e.kwh * (cfg.selfPct/100);
  const f = e.feed  != null ? e.feed  : Math.max(0, e.kwh - s);
  return parseFloat(((s * cfg.price) + (f * cfg.feedRate)).toFixed(2));
}
// Direct PV use: portion of PV consumed on-site
function calcDirect(pvKwh, gridKwh) {
  const assumed = pvKwh * (cfg.selfPct / 100);
  return parseFloat(Math.min(assumed, gridKwh + assumed).toFixed(2));
}
function getDayGrid(date) {
  return consumption
    .filter(c => String(c.date).substring(0,10) === date && c.direction==='grid')
    .reduce((s,c) => s + parseFloat(c.kwh), 0);
}
function getMonthGrid(ym) {
  return consumption
    .filter(c => String(c.date).substring(0,10).startsWith(ym) && c.direction==='grid')
    .reduce((s,c) => s + parseFloat(c.kwh), 0);
}
function getDayPv(date) {
  const e = entries.find(x=>x.type==='day'&&x.date===date);
  return e ? e.kwh : 0;
}
function getMonthPv(ym) {
  const me = entries.find(x=>x.type==='month'&&x.date===ym+'-01');
  if (me) return me.kwh;
  return entries.filter(x=>x.type==='day'&&x.date.startsWith(ym)).reduce((s,x)=>s+x.kwh,0);
}

// ── UTILS ────────────────────────────────────────────────
let _idCounter = 0;
function genId() {
  _idCounter++;
  return Date.now().toString(36) + _idCounter.toString(36) + Math.random().toString(36).slice(2,6);
}
function getWeekNum(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dn);
  const y = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - y) / 86400000) + 1) / 7);
}
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type==='err' ? ' err' : '') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}
function copyCode(id) {
  const el = document.getElementById(id);
  if (el) navigator.clipboard.writeText(el.textContent).then(() => toast('✓ SQL kopiert'));
}

// ── SIDEBAR KPIs ─────────────────────────────────────────
function updateSidebar() {
  const pvT  = entries.reduce((s,e)=>s+e.kwh, 0);
  const cvT  = consumption.filter(c=>c.direction==='grid').reduce((s,c)=>s+c.kwh, 0);
  const dir  = calcDirect(pvT, cvT);
  const tot  = cvT + dir;
  const au   = tot > 0 ? Math.round(dir/tot*100) : 0;
  const setV = (id, v, u) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = v + `<span class="sb-kpi-u">${u}</span>`;
  };
  setV('sb-pv', pvT.toFixed(1), 'kWh');
  setV('sb-cv', cvT.toFixed(1), 'kWh');
  setV('sb-au', au || '—', '%');
}

// ── SYNC INDICATOR ───────────────────────────────────────
function syncInd(state) {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-txt');
  if (!dot) return;
  const S = {
    syncing:{ bg:'var(--bl)', sh:'0 0 4px var(--bl)', t:'Sync…' },
    ok:     { bg:'var(--gr)', sh:'0 0 4px var(--gr)', t:'Gespeichert ' + new Date().toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'}) },
    error:  { bg:'var(--rd)', sh:'0 0 4px var(--rd)', t:'Sync-Fehler' },
    idle:   { bg:'var(--tx3)', sh:'none',             t:'Cloud ✓' }
  };
  const s = S[state] || S.idle;
  dot.style.background = s.bg; dot.style.boxShadow = s.sh;
  txt.textContent = s.t;
  if (state === 'ok') setTimeout(() => syncInd('idle'), 4000);
}

// ── SUPABASE ─────────────────────────────────────────────
function entryToRow(e) {
  return { id:e.id, type:e.type, date:e.date, kwh:e.kwh, peak:e.peak||null,
    hours:e.hours||null, self_kwh:e.self||null, feed_kwh:e.feed||null,
    weather:e.weather||null, temp:e.temp||null, note:e.note||null,
    source:e.source||'manual', updated_at:new Date().toISOString() };
}
function rowToEntry(r) {
  return { id:r.id, type:r.type, date:r.date, kwh:+r.kwh,
    peak:r.peak?+r.peak:null, hours:r.hours?+r.hours:null,
    self:r.self_kwh?+r.self_kwh:null, feed:r.feed_kwh?+r.feed_kwh:null,
    weather:r.weather||'', temp:r.temp?+r.temp:null,
    note:r.note||'', source:r.source||'manual' };
}
function scheduleSync() {
  syncPending = true;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(doSync, 1500);
}

// Immediately delete IDs from Supabase table
async function sbDeleteIds(table, ids) {
  if (!sbClient || !ids.length) return;
  for (let i=0; i<ids.length; i+=200) {
    try {
      await sbClient.from(table).delete().in('id', ids.slice(i,i+200));
    } catch(e) { console.warn(`Delete from ${table}:`, e.message); }
  }
}

// Called when PV entries are deleted — immediately removes from Supabase
async function deletePvFromSb(ids) {
  ids.forEach(id => tombstones.add(id));
  saveTombstones();
  await sbDeleteIds(PV_TBL, ids);
}

// Called when CV entries are deleted — immediately removes from Supabase
async function deleteCvFromSb(ids) {
  ids.forEach(id => cvTombstones.add(id));
  saveCvTombstones();
  await sbDeleteIds(CV_TBL, ids);
}

async function doSync() {
  if (!sbClient || !syncPending) return;
  syncPending = false; syncInd('syncing');
  try {
    // ── PV sync ──────────────────────────────────────────
    // Upsert all local PV entries
    if (entries.length > 0) {
      const seen = new Set();
      const rows = entries.map(entryToRow).filter(r => {
        if (seen.has(r.id)) return false; seen.add(r.id); return true;
      });
      for (let i=0; i<rows.length; i+=100) {
        const { error } = await sbClient.from(PV_TBL)
          .upsert(rows.slice(i,i+100), {onConflict:'id'});
        if (error) throw error;
      }
    }

    // ── CV sync ──────────────────────────────────────────
    // Upsert all local CV entries
    if (consumption.length > 0) {
      const seen = new Set();
      const rows = consumption.filter(c => {
        if (seen.has(c.id)) return false; seen.add(c.id); return true;
      });
      for (let i=0; i<rows.length; i+=200) {
        const { error } = await sbClient.from(CV_TBL)
          .upsert(rows.slice(i,i+200), {onConflict:'id'});
        if (error) throw error;
      }
    }

    // Ensure any tombstoned IDs are deleted (belt-and-suspenders)
    if (tombstones.size > 0)   await sbDeleteIds(PV_TBL, [...tombstones]);
    if (cvTombstones.size > 0) await sbDeleteIds(CV_TBL, [...cvTombstones]);

    syncInd('ok');
  } catch(e) { syncInd('error'); console.warn('Sync:', e.message); }
}

async function initialLoad() {
  if (!sbClient) return;
  syncInd('syncing');
  try {
    // PV — only load if local is empty
    if (entries.length === 0) {
      const { data, error } = await sbClient.from(PV_TBL)
        .select('*').order('date', {ascending:true});
      if (error) throw error;
      if (data && data.length > 0) {
        // Filter out tombstoned IDs
        entries = data
          .filter(r => !tombstones.has(r.id))
          .map(rowToEntry);
        savePv(false);
        refreshCurrentPage();
      }
    }

    // CV — only load if local is empty
    if (consumption.length === 0) {
      const { data: cvData, error: cvErr } = await sbClient.from(CV_TBL).select('*');
      if (cvErr) throw cvErr;
      if (cvData && cvData.length > 0) {
        consumption = cvData
          .filter(r => !cvTombstones.has(r.id))
          .map(r => ({
            id:        r.id,
            date:      String(r.date).substring(0, 10),
            hour:      parseInt(r.hour,   10),
            minute:    parseInt(r.minute, 10),
            kwh:       parseFloat(r.kwh),
            direction: r.direction || 'grid'
          }))
          .sort((a,b) => a.date !== b.date
            ? a.date.localeCompare(b.date) : a.hour - b.hour);
        saveCv(false);
      }
    }
    syncInd('ok');
  } catch(e) { syncInd('error'); console.warn('Initial load:', e.message); }
}

// Legacy wrappers — kept for compatibility
async function syncConsumption() { scheduleSync(); }
async function loadConsumption()  { /* handled by initialLoad */ }
function connectSupabase() {
  const { createClient } = supabase;
  sbClient = createClient(SB_URL, SB_KEY);
  initialLoad();
  loadConsumption();
}

// ── NAVIGATION ───────────────────────────────────────────
let currentPage = 'dashboard';
function nav(id) {
  currentPage = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.getAttribute('onclick')?.includes("'" + id + "'")) b.classList.add('active');
  });
  if (pages[id]?.onEnter) pages[id].onEnter();
}
function refreshCurrentPage() {
  if (pages[currentPage]?.onEnter) pages[currentPage].onEnter();
  updateSidebar();
}
function registerPage(id, module) {
  pages[id] = module;
  // Inject the page HTML into the container
  const container = document.getElementById('page-container');
  if (container && module.html) {
    const div = document.createElement('div');
    div.id = 'page-' + id;
    div.className = 'page' + (id === 'dashboard' ? ' active' : '');
    div.innerHTML = module.html;
    container.appendChild(div);
  }
}
function registerPages() {
  // Called after all scripts load
  [DASH, PV, SIM, CV, CV2, SETT].forEach(m => m.register());
}

// ── PW ───────────────────────────────────────────────────
function checkPw() {
  const v = document.getElementById('pw-in').value;
  if (v === APP_PW) {
    sessionStorage.setItem(PW_KEY, '1');
    document.getElementById('pw-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'grid';
    document.getElementById('pw-err').textContent = '';
    initApp();
  } else {
    document.getElementById('pw-err').textContent = 'Falsches Passwort';
    document.getElementById('pw-in').value = '';
  }
}
function boot() {
  initApp();
}
function initApp() {
  loadStorage(); computeTheory();
  updateSidebar();
  connectSupabase();
  // Setup modal close on bg click
  const mb = document.getElementById('edit-modal-bg');
  if (mb) mb.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  // nav() is called AFTER registerPages() in the boot script
}

// ── EDIT MODAL ───────────────────────────────────────────
function openModal(id) {
  const e = entries.find(x=>x.id===id); if (!e) return;
  document.getElementById('em-id').value = e.id;
  document.getElementById('em-type').value = e.type;
  document.getElementById('em-title').textContent =
    e.type==='day' ? 'Tag bearbeiten' : e.type==='week' ? 'Woche bearbeiten' : 'Monat bearbeiten';
  const wO = ['☀️','🌤️','⛅','☁️','🌧️','🌨️']
    .map(w=>`<option value="${w}"${e.weather===w?' selected':''}>${w}</option>`).join('');
  let f = '';
  if (e.type === 'day') {
    f = `<div class="field"><label>Datum</label><input type="date" id="em-date" value="${e.date}"></div>
    <div class="field"><label>Ertrag (kWh)</label><input type="number" id="em-kwh" value="${e.kwh}" step="0.01"></div>
    <div class="field"><label>Peak (W)</label><input type="number" id="em-peak" value="${e.peak||''}"></div>
    <div class="field"><label>Stunden</label><input type="number" id="em-hours" value="${e.hours||''}"></div>
    <div class="field"><label>Eigenstrom</label><input type="number" id="em-self" value="${e.self||''}"></div>
    <div class="field"><label>Einspeisung</label><input type="number" id="em-feed" value="${e.feed||''}"></div>
    <div class="field"><label>Wetter</label><select id="em-weather">${wO}</select></div>
    <div class="field"><label>Temp °C</label><input type="number" id="em-temp" value="${e.temp||''}"></div>
    <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="em-note" value="${e.note||''}"></div>`;
  } else if (e.type === 'week') {
    f = `<div class="field"><label>Datum</label><input type="date" id="em-date" value="${e.date}"></div>
    <div class="field"><label>KW</label><input type="number" id="em-kw" value="${e.kw||''}"></div>
    <div class="field"><label>Ertrag (kWh)</label><input type="number" id="em-kwh" value="${e.kwh}"></div>
    <div class="field"><label>Wetter</label><select id="em-weather">${wO}</select></div>
    <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="em-note" value="${e.note||''}"></div>`;
  } else {
    const mO = MONTHS_FULL.map((m,i)=>`<option value="${i}"${new Date(e.date).getMonth()===i?' selected':''}>${m}</option>`).join('');
    const yr = new Date(e.date).getFullYear();
    f = `<div class="field"><label>Monat</label><select id="em-month">${mO}</select></div>
    <div class="field"><label>Jahr</label><input type="number" id="em-year" value="${yr}"></div>
    <div class="field"><label>Ertrag (kWh)</label><input type="number" id="em-kwh" value="${e.kwh}"></div>
    <div class="field"><label>Eigenstrom</label><input type="number" id="em-self" value="${e.self||''}"></div>
    <div class="field"><label>Einspeisung</label><input type="number" id="em-feed" value="${e.feed||''}"></div>
    <div class="field"><label>Wetter</label><select id="em-weather">${wO}</select></div>
    <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="em-note" value="${e.note||''}"></div>`;
  }
  document.getElementById('em-fields').innerHTML = f;
  document.getElementById('edit-modal-bg').style.display = 'flex';
}
function saveModal() {
  const id = document.getElementById('em-id').value;
  const type = document.getElementById('em-type').value;
  const idx = entries.findIndex(x=>x.id===id); if (idx < 0) return;
  const kwh = parseFloat(document.getElementById('em-kwh').value);
  if (isNaN(kwh)) { toast('kWh ist Pflichtfeld', 'err'); return; }
  let date = entries[idx].date;
  if (type==='day'||type==='week') date = document.getElementById('em-date')?.value || date;
  else {
    const m=parseInt(document.getElementById('em-month').value);
    const y=parseInt(document.getElementById('em-year').value);
    date = y+'-'+String(m+1).padStart(2,'0')+'-01';
  }
  const gv = id => { const el=document.getElementById(id); return el?el.value:null; };
  const gpv = id => { const v=parseFloat(gv(id)); return isNaN(v)?null:v; };
  entries[idx] = { ...entries[idx], date, kwh,
    weather: gv('em-weather') || entries[idx].weather,
    note: gv('em-note') || '',
    peak: gpv('em-peak'), hours: gpv('em-hours'),
    self: gpv('em-self'), feed: gpv('em-feed'),
    temp: gpv('em-temp'), kw: gpv('em-kw')
  };
  entries.sort((a,b) => a.date.localeCompare(b.date));
  savePv(); closeModal(); refreshCurrentPage();
  toast('✓ Eintrag gespeichert');
}
function closeModal() {
  document.getElementById('edit-modal-bg').style.display = 'none';
}

// ── PUBLIC API ───────────────────────────────────────────
return {
  // Pending import slot (used by CV module)
  _pendingImport: null,
  get sbClient()    { return sbClient; },
  // state (read-only references)
  get cfg()         { return cfg; },
  get theory()      { return theory; },
  get entries()     { return entries; },
  get consumption() { return consumption; },
  get charts()      { return charts; },
  get MONTHS()      { return MONTHS; },
  get MONTHS_FULL() { return MONTHS_FULL; },
  get GC()          { return GC; },
  get TC()          { return TC; },
  // state mutation
  setEntries(v)     { entries = v; },
  setCfg(v)         { cfg = {...cfg, ...v}; },
  setConsumption(v) { consumption = v; },
  // delete helpers — immediately remove from Supabase + add to tombstone
  deletePvIds:  (ids) => deletePvFromSb(ids),
  deleteCvIds:  (ids) => deleteCvFromSb(ids),
  // utils
  genId, getWeekNum, getTheory, calcEuro, calcDirect,
  getDayGrid, getMonthGrid, getDayPv, getMonthPv,
  computeTheory, dailyTheory, weeklyTheory,
  destroyChart, toast, copyCode, updateSidebar,
  savePv, saveCv, syncConsumption, scheduleSync,
  // app control
  boot, checkPw, nav, registerPage, registerPages, refreshCurrentPage,
  openModal, saveModal, closeModal,
  // sync
  syncInd,
};
})();
