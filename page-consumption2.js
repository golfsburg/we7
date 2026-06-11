// ═══════════════════════════════════════════════════════════
// PAGE-CONSUMPTION2.JS  —  Verbrauchsbilanz (Zählerablesen)
// Zählerstände → Verbrauchsberechnung via Differenz
// ═══════════════════════════════════════════════════════════
const CV2 = (() => {
'use strict';

const CV2_TBL = 'meter_readings';

// ── HTML ─────────────────────────────────────────────────
const HTML = `
<div class="ph"><div>
  <div class="ph-title">📊 Verbrauchsbilanz</div>
  <div class="ph-sub">Zählerablesen · Solar · Fernwärme · Wasser · Strom</div>
</div></div>

<div id="cv2-timeline"></div>

<div class="mtabs" id="cv2-tabs">
  <button class="mtab active" onclick="CV2.tab('dashboard',this)">Dashboard</button>
  <button class="mtab"        onclick="CV2.tab('records',this)">Verbrauchsaufzeichnung</button>
</div>

<!-- ── DASHBOARD ── -->
<div id="cv2-t-dashboard">


  <!-- KPI Cards -->
  <div class="metrics">
    <div class="mc hi">
      <div class="mc-l">☀ Solar Ø/Monat</div>
      <div><span class="mc-v" id="cv2-m-solar">—</span><span class="mc-u">kWh</span></div>
      <div class="mc-d" id="cv2-m-solar2"></div>
    </div>
    <div class="mc" style="border-color:rgba(251,146,60,.3)">
      <div class="mc-l">🔥 Fernwärme Ø/Monat</div>
      <div><span class="mc-v" id="cv2-m-fw">—</span><span class="mc-u">kWh</span></div>
      <div class="mc-d" id="cv2-m-fw2"></div>
    </div>
    <div class="mc bl">
      <div class="mc-l">💧 Wasser Ø/Monat</div>
      <div><span class="mc-v" id="cv2-m-water">—</span><span class="mc-u">m³</span></div>
      <div class="mc-d" id="cv2-m-water2"></div>
    </div>
    <div class="mc" style="border-color:rgba(250,204,21,.3)">
      <div class="mc-l">⚡ Strom Ø/Monat</div>
      <div><span class="mc-v" id="cv2-m-strom">—</span><span class="mc-u">kWh</span></div>
      <div class="mc-d" id="cv2-m-strom2"></div>
    </div>
    <div class="mc gr">
      <div class="mc-l">☀ Solar Ø/Tag</div>
      <div><span class="mc-v" id="cv2-d-solar">—</span><span class="mc-u">kWh</span></div>
    </div>
    <div class="mc" style="border-color:rgba(251,146,60,.2)">
      <div class="mc-l">🔥 Fernwärme Ø/Tag</div>
      <div><span class="mc-v" id="cv2-d-fw">—</span><span class="mc-u">kWh</span></div>
    </div>
    <div class="mc bl">
      <div class="mc-l">💧 Wasser Ø/Tag</div>
      <div><span class="mc-v" id="cv2-d-water">—</span><span class="mc-u">l</span></div>
      <div class="mc-d">Liter pro Tag</div>
    </div>
    <div class="mc" style="border-color:rgba(250,204,21,.2)">
      <div class="mc-l">⚡ Strom Ø/Tag</div>
      <div><span class="mc-v" id="cv2-d-strom">—</span><span class="mc-u">kWh</span></div>
    </div>
  </div>

  <!-- Charts -->
  <div class="cgrid">
    <div class="cc full">
      <div class="cc-title">Energieverbrauch im Zeitverlauf</div>
      <div class="cc-sub" id="cv2-chart-sub">kWh pro Periode</div>
      <div class="leg">
        <div class="li"><span class="ld" style="background:#f5c842"></span>Solar</div>
        <div class="li"><span class="ld" style="background:rgba(251,146,60,.85)"></span>Fernwärme</div>
        <div class="li"><span class="ld" style="background:rgba(91,156,246,.75)"></span>Strom</div>
      </div>
      <div class="cw" style="height:260px"><canvas id="cv2-c-energy"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Wasserverbrauch</div>
      <div class="cc-sub">m³ pro Periode</div>
      <div class="cw" style="height:200px"><canvas id="cv2-c-water"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Außentemperatur</div>
      <div class="cc-sub">°C bei Ablesung</div>
      <div class="cw" style="height:200px"><canvas id="cv2-c-temp"></canvas></div>
    </div>
    <div class="cc full">
      <div class="cc-title">Energiemix Verteilung</div>
      <div class="cc-sub">Gesamtverbrauch im Zeitraum</div>
      <div class="cw" style="height:200px"><canvas id="cv2-c-donut"></canvas></div>
    </div>
  </div>
</div>

<!-- ── VERBRAUCHSAUFZEICHNUNG ── -->
<div id="cv2-t-records" style="display:none">
  <div class="mtabs" id="cv2-rec-tabs">
    <button class="mtab active" onclick="CV2.recTab('table',this)">Aufzeichnungen</button>
    <button class="mtab"        onclick="CV2.recTab('entry',this)">Eingabe</button>
    <button class="mtab"        onclick="CV2.recTab('import',this)">Import</button>
  </div>

  <!-- TABLE -->
  <div id="cv2-rt-table">
    <div class="fbar">
      <button class="btn-s btn-d" onclick="CV2.deleteSelected()">Auswahl löschen</button>
    </div>
    <div class="tcard">
      <div class="thead"><div class="thead-t" id="cv2-tcount">—</div></div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr>
            <th><input type="checkbox" id="cv2-cb-all" onchange="CV2.toggleAll(this)"></th>
            <th>Datum</th>
            <th style="color:#f5c842">Solar kWh</th>
            <th style="color:rgba(251,146,60,.9)">Fernwärme kWh</th>
            <th>FW Status</th>
            <th style="color:#5b9cf6">Wasser m³</th>
            <th style="color:rgba(250,204,21,.9)">Strom kWh</th>
            <th>Temp °C</th>
            <th>Anmerkung</th>
            <th style="text-align:center">Aktion</th>
          </tr></thead>
          <tbody id="cv2-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- MANUAL ENTRY -->
  <div id="cv2-rt-entry" style="display:none">
    <div class="fcard">
      <div class="fcard-t">✏️ Zählerstand eintragen</div>
      <div class="fgrid">
        <div class="field"><label>Datum &amp; Uhrzeit</label><input type="datetime-local" id="cv2-e-date"></div>
        <div class="field"><label>Solar (kWh)</label><input type="number" id="cv2-e-solar" step="0.001" placeholder="z.B. 37.319"></div>
        <div class="field"><label>Fernwärme (kWh)</label><input type="number" id="cv2-e-fw" step="0.001" placeholder="z.B. 40.864"></div>
        <div class="field"><label>FW Status</label>
          <select id="cv2-e-fwstatus">
            <option value="Fernwärme EIN">Fernwärme EIN</option>
            <option value="Fernwärme AUS">Fernwärme AUS</option>
            <option value="">—</option>
          </select>
        </div>
        <div class="field"><label>Wasser (m³)</label><input type="number" id="cv2-e-water" step="0.001" placeholder="z.B. 524.138"></div>
        <div class="field"><label>Strom (kWh)</label><input type="number" id="cv2-e-strom" step="0.01" placeholder="z.B. 2473.00"></div>
        <div class="field"><label>Außentemperatur (°C)</label><input type="number" id="cv2-e-temp" step="1" placeholder="z.B. 7"></div>
        <div class="field" style="grid-column:1/-1"><label>Anmerkung</label><input type="text" id="cv2-e-note" placeholder="Optional…"></div>
      </div>
      <div class="brow">
        <button class="btn-p" onclick="CV2.addEntry()">Speichern</button>
        <button class="btn-s" onclick="CV2.prefillNow()">Jetzt vorausfüllen</button>
      </div>
      <div id="cv2-entry-result" style="font-size:12px;color:var(--tx2);margin-top:8px"></div>
    </div>
    <div class="note">💡 Zählerstände ablesen und eintragen — die App berechnet den Verbrauch automatisch als Differenz zur vorherigen Ablesung.</div>
  </div>

  <!-- IMPORT -->
  <div id="cv2-rt-import" style="display:none">
    <div class="fcard">
      <div class="fcard-t">📋 CSV / Tab-Import</div>
      <p style="font-size:13px;color:var(--tx2);margin-bottom:8px">
        Daten aus Excel oder Tabelle kopieren und hier einfügen.<br>
        Format: <code>Datum&lt;Tab&gt;Solar&lt;Tab&gt;Fernwärme&lt;Tab&gt;FW-Status&lt;Tab&gt;Wasser&lt;Tab&gt;Strom&lt;Tab&gt;Temp&lt;Tab&gt;Anmerkung</code>
      </p>
      <div class="note" style="margin-bottom:12px">
        📋 Datum: <code>DD.MM.YYYY, HH:MM</code> · Zahlen: Punkt als Tausender, Komma als Dezimal (z.B. <code>2.087,83</code>)
      </div>
      <textarea class="csv-area" id="cv2-csv-in" placeholder="Daten hier einfügen…"></textarea>
      <div class="brow">
        <button class="btn-p" onclick="CV2.importCSV(false)">Importieren (hinzufügen)</button>
        <button class="btn-s" onclick="CV2.importCSV(true)">↺ Neu importieren (überschreiben)</button>
      </div>
      <div id="cv2-import-result" style="font-size:12px;color:var(--tx2);margin-top:10px"></div>
    </div>

    <div class="fcard" style="border-color:rgba(91,156,246,.2)">
      <div class="fcard-t" style="font-size:13px;color:var(--tx2)">
        <span>🗄 Supabase Tabelle <code>meter_readings</code></span>
        <button class="copy-btn" onclick="APP.copyCode('cv2-sql')">Kopieren</button>
      </div>
      <div class="code-block" id="cv2-sql">create table if not exists meter_readings (
  id text primary key,
  reading_date timestamptz not null,
  solar_kwh numeric,
  fw_kwh numeric,
  fw_status text,
  water_m3 numeric,
  strom_kwh numeric,
  temp_c numeric,
  note text,
  created_at timestamptz default now()
);
alter table meter_readings enable row level security;
create policy "allow_all" on meter_readings
  for all using (true) with check (true);</div>
    </div>

    <div class="fcard" style="border-color:rgba(242,92,92,.2)">
      <div class="fcard-t" style="color:var(--rd)">⚠ Aufzeichnungen löschen</div>
      <div class="fgrid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="field"><label>Von</label><input type="date" id="cv2-del-from"></div>
        <div class="field"><label>Bis</label><input type="date" id="cv2-del-to"></div>
      </div>
      <div class="brow">
        <button class="btn-s btn-d" onclick="CV2.deleteRange()">Zeitraum löschen</button>
        <button class="btn-s btn-d" onclick="CV2.clearAll()">Alle löschen</button>
      </div>
      <div id="cv2-del-result" style="font-size:12px;margin-top:8px"></div>
    </div>
  </div>
</div>
`;

// ── STATE ─────────────────────────────────────────────────
let readings = []; // sorted by date ascending

const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };

// ── PARSE NUMBER ──────────────────────────────────────────
// Handles: "2.087,83" → 2087.83  |  "509,138" → 509.138  |  "37.319" → 37.319
function parseNum(s) {
  if (!s || s.trim() === '') return null;
  let v = s.trim();
  // If both . and , present: . is thousands separator, , is decimal
  if (v.includes('.') && v.includes(',')) {
    v = v.replace(/\./g,'').replace(',','.');
  } else if (v.includes(',')) {
    // Only comma: could be decimal (0,5) or thousands (509,138)
    const parts = v.split(',');
    if (parts[1] && parts[1].length === 3 && !v.includes('.')) {
      // e.g. "509,138" — treat as no decimal (integer thousands)
      v = v.replace(',','');
    } else {
      v = v.replace(',','.');
    }
  }
  // Remove remaining . as thousands separators if number looks like it
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── PARSE DATE ────────────────────────────────────────────
function parseDate(s) {
  if (!s) return null;
  // "DD.MM.YYYY, HH:MM" or "DD.MM.YYYY HH:MM"
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (m) {
    const [,d,mo,y,h,min] = m;
    return new Date(+y, +mo-1, +d, +h, +min).toISOString();
  }
  // Try standard ISO
  const d = new Date(s.trim());
  return isNaN(d) ? null : d.toISOString();
}

// ── CONSUMPTION CALCULATION ───────────────────────────────
// Returns array of consumption periods between consecutive readings
// Rule: if newer value < older value → diff = 0 (meter reset/exchange)
// Exception: Solar is ENERGY GAINED, positive diff = production
function calcConsumption(data) {
  if (data.length < 2) return [];
  const sorted = [...data].sort((a,b) => a.reading_date.localeCompare(b.reading_date));
  const result = [];
  for (let i=1; i<sorted.length; i++) {
    const prev = sorted[i-1], curr = sorted[i];
    const d1   = new Date(prev.reading_date);
    const d2   = new Date(curr.reading_date);
    const days = Math.max(1, (d2-d1) / (1000*60*60*24));

    // Helper: calc diff, clamp negative to 0 (meter reset)
    const diff = (a, b) => {
      if (a == null || b == null) return null;
      const d = b - a;
      return d < 0 ? 0 : +d.toFixed(3);
    };

    // Solar: energy PRODUCED — positive diff = good
    const solar = diff(prev.solar_kwh,  curr.solar_kwh);
    // Fernwärme: energy CONSUMED — negative diff → 0
    const fw    = diff(prev.fw_kwh,     curr.fw_kwh);
    // Wasser: volume CONSUMED — negative diff → 0
    const water = diff(prev.water_m3,   curr.water_m3);
    // Strom: energy CONSUMED — negative diff → 0
    const strom = diff(prev.strom_kwh,  curr.strom_kwh);

    const entry = {
      from:       prev.reading_date,
      to:         curr.reading_date,
      days,
      solar, fw, water, strom,
      temp:       curr.temp_c,
      fw_status:  curr.fw_status,
      note:       curr.note,
      solar_day:  solar != null ? +(solar / days).toFixed(3) : null,
      fw_day:     fw    != null ? +(fw    / days).toFixed(3) : null,
      water_day:  water != null ? +(water / days).toFixed(3) : null,
      strom_day:  strom != null ? +(strom / days).toFixed(2) : null,
    };
    result.push(entry);
  }
  return result;
}

// ── TABS ──────────────────────────────────────────────────
function tab(name, btn) {
  ['dashboard','records'].forEach(t => {
    const el = document.getElementById('cv2-t-'+t);
    if (el) el.style.display = t===name ? 'block' : 'none';
  });
  document.querySelectorAll('#cv2-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name==='dashboard') renderDashboard();
  if (name==='records')   renderTable();
}
function recTab(name, btn) {
  ['table','entry','import'].forEach(t => {
    const el = document.getElementById('cv2-rt-'+t);
    if (el) el.style.display = t===name ? 'block' : 'none';
  });
  document.querySelectorAll('#cv2-rec-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name==='table') renderTable();
}

// ── FILTER ────────────────────────────────────────────────
function calcPresetRange(p) {
  const today = new Date().toISOString().split('T')[0];
  const yr    = new Date().getFullYear();
  const ym    = today.substring(0,7);
  if (p==='thismonth') return { from: ym+'-01', to: today };
  if (p==='last30')  { const d=new Date(); d.setDate(d.getDate()-30); return { from:d.toISOString().split('T')[0], to:today }; }
  if (p==='last90')  { const d=new Date(); d.setDate(d.getDate()-90); return { from:d.toISOString().split('T')[0], to:today }; }
  if (p==='thisyear') return { from: yr+'-01-01', to: today };
  return { from: null, to: null };
}

function getEarliestDate() {
  const dates = readings.map(r => r.reading_date.substring(0,10)).filter(Boolean).sort();
  return dates.length > 0 ? dates[0] : null;
}

function onPreset() {
  const p     = document.getElementById('cv2-period')?.value;
  if (p === 'custom') return;
  const today = new Date().toISOString().split('T')[0];
  const { from, to } = calcPresetRange(p);
  let actualFrom = from;
  if (p === 'all') actualFrom = getEarliestDate();
  const fEl = document.getElementById('cv2-from');
  const tEl = document.getElementById('cv2-to');
  if (fEl) fEl.value = actualFrom || '';
  if (tEl) tEl.value = to || today;
  const mEl = document.getElementById('cv2-month');
  const yEl = document.getElementById('cv2-year');
  if (mEl) mEl.value = '';
  if (yEl) yEl.value = '';
  renderDashboard();
}

function onMonthPick() {
  const val = document.getElementById('cv2-month')?.value;
  if (!val) return;
  const [yr, mo] = val.split('-').map(Number);
  const lastDay  = new Date(yr, mo, 0).getDate();
  const fEl = document.getElementById('cv2-from');
  const tEl = document.getElementById('cv2-to');
  if (fEl) fEl.value = `${val}-01`;
  if (tEl) tEl.value = `${val}-${String(lastDay).padStart(2,'0')}`;
  const yEl = document.getElementById('cv2-year');
  const pEl = document.getElementById('cv2-period');
  if (yEl) yEl.value = '';
  if (pEl) pEl.value = 'custom';
  renderDashboard();
}

function onYearPick() {
  const yr = document.getElementById('cv2-year')?.value;
  if (!yr) return;
  const fEl = document.getElementById('cv2-from');
  const tEl = document.getElementById('cv2-to');
  if (fEl) fEl.value = `${yr}-01-01`;
  if (tEl) tEl.value = `${yr}-12-31`;
  const mEl = document.getElementById('cv2-month');
  const pEl = document.getElementById('cv2-period');
  if (mEl) mEl.value = '';
  if (pEl) pEl.value = 'custom';
  renderDashboard();
}

function onCustomDate() {
  const mEl = document.getElementById('cv2-month');
  const yEl = document.getElementById('cv2-year');
  const pEl = document.getElementById('cv2-period');
  if (mEl) mEl.value = '';
  if (yEl) yEl.value = '';
  if (pEl) pEl.value = 'custom';
  renderDashboard();
}

function resetFilter() {
  const pEl = document.getElementById('cv2-period');
  const mEl = document.getElementById('cv2-month');
  const yEl = document.getElementById('cv2-year');
  if (pEl) pEl.value = 'all';
  if (mEl) mEl.value = '';
  if (yEl) yEl.value = '';
  const fEl = document.getElementById('cv2-from');
  const tEl = document.getElementById('cv2-to');
  if (fEl) fEl.value = getEarliestDate() || '';
  if (tEl) tEl.value = new Date().toISOString().split('T')[0];
  renderDashboard();
}

// ── DASHBOARD ─────────────────────────────────────────────
function renderDashboard() {
  const range = APP.FilterBar.getRange('cv2-timeline');
  const from  = range.from || document.getElementById('cv2-from')?.value;
  const to    = range.to   || document.getElementById('cv2-to')?.value;

  const cons = calcConsumption(readings).filter(c => {
    const d = c.from.substring(0,10);
    return (!from || d >= from) && (!to || d <= to);
  });

  if (!cons.length) {
    ['cv2-m-solar','cv2-m-fw','cv2-m-water','cv2-m-strom',
     'cv2-d-solar','cv2-d-fw','cv2-d-water','cv2-d-strom'].forEach(id => set(id,'—'));
    return;
  }

  const totalDays   = cons.reduce((s,c) => s+c.days, 0);
  const totalMonths = totalDays / 30.44;

  // Sum only non-null, non-zero periods (skip meter resets for averages)
  const sumSolar = cons.reduce((s,c) => s+(c.solar??0), 0);
  const sumFw    = cons.reduce((s,c) => s+(c.fw??0),    0);
  const sumWater = cons.reduce((s,c) => s+(c.water??0), 0);
  const sumStrom = cons.reduce((s,c) => s+(c.strom??0), 0);

  // Monthly averages (÷ total months in range)
  set('cv2-m-solar', totalMonths>0 ? (sumSolar/totalMonths).toFixed(1) : '—');
  set('cv2-m-fw',    totalMonths>0 ? (sumFw   /totalMonths).toFixed(1) : '—');
  set('cv2-m-water', totalMonths>0 ? (sumWater/totalMonths).toFixed(2) : '—');
  set('cv2-m-strom', totalMonths>0 ? (sumStrom/totalMonths).toFixed(1) : '—');
  set('cv2-m-solar2', `${sumSolar.toFixed(1)} kWh gesamt`);
  set('cv2-m-fw2',    `${sumFw.toFixed(1)} kWh gesamt`);
  set('cv2-m-water2', `${sumWater.toFixed(2)} m³ gesamt`);
  set('cv2-m-strom2', `${sumStrom.toFixed(1)} kWh gesamt`);

  // Daily averages (÷ total days)
  set('cv2-d-solar', totalDays>0 ? (sumSolar/totalDays).toFixed(2) : '—');
  set('cv2-d-fw',    totalDays>0 ? (sumFw   /totalDays).toFixed(2) : '—');
  set('cv2-d-water', totalDays>0 ? ((sumWater/totalDays)*1000).toFixed(0) : '—');
  set('cv2-d-strom', totalDays>0 ? (sumStrom/totalDays).toFixed(2) : '—');

  set('cv2-chart-sub', `${cons.length} Perioden · ${Math.round(totalDays)} Tage`);

  drawEnergyChart(cons);
  drawWaterChart(cons);
  drawTempChart(cons);
  drawDonut(sumSolar, sumFw, sumStrom);
}

function periodLabel(c) {
  const d = new Date(c.from);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function drawEnergyChart(cons) {
  APP.destroyChart('cv2-energy');
  const labels = cons.map(periodLabel);
  APP.charts['cv2-energy'] = new Chart(document.getElementById('cv2-c-energy'), {
    type:'bar',
    data:{ labels, datasets:[
      { label:'Solar',     data:cons.map(c=>c.solar!=null  ? +c.solar.toFixed(2):null),  backgroundColor:'rgba(245,200,66,.8)',  borderRadius:3 },
      { label:'Fernwärme', data:cons.map(c=>c.fw!=null     ? +c.fw.toFixed(2):null),     backgroundColor:'rgba(251,146,60,.75)', borderRadius:3 },
      { label:'Strom',     data:cons.map(c=>c.strom!=null  ? +c.strom.toFixed(2):null),  backgroundColor:'rgba(91,156,246,.75)', borderRadius:3 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } } },
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC},
                  title:{display:true,text:'kWh',color:APP.TC,font:{size:10}}} } }
  });
}

function drawWaterChart(cons) {
  APP.destroyChart('cv2-water');
  const labels = cons.map(periodLabel);
  APP.charts['cv2-water'] = new Chart(document.getElementById('cv2-c-water'), {
    type:'bar',
    data:{ labels, datasets:[{
      data: cons.map(c=>c.water!=null ? +c.water.toFixed(3):null),
      backgroundColor:'rgba(91,156,246,.7)', borderRadius:3
    }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC},
                  title:{display:true,text:'m³',color:APP.TC,font:{size:10}}} } }
  });
}

function drawTempChart(cons) {
  APP.destroyChart('cv2-temp');
  const labels = cons.map(periodLabel);
  APP.charts['cv2-temp'] = new Chart(document.getElementById('cv2-c-temp'), {
    type:'line',
    data:{ labels, datasets:[{
      data: cons.map(c=>c.temp),
      borderColor:'#a78bfa', backgroundColor:'rgba(167,139,250,.1)',
      fill:true, tension:0.35, pointRadius:4, borderWidth:2, pointBackgroundColor:'#a78bfa'
    }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10},callback:v=>v+'°'},grid:{color:APP.GC}} } }
  });
}

function drawDonut(solar, fw, strom) {
  APP.destroyChart('cv2-donut');
  APP.charts['cv2-donut'] = new Chart(document.getElementById('cv2-c-donut'), {
    type:'doughnut',
    data:{ labels:['Solar','Fernwärme','Strom'],
      datasets:[{ data:[+solar.toFixed(1),+fw.toFixed(1),+strom.toFixed(1)],
        backgroundColor:['rgba(245,200,66,.8)','rgba(251,146,60,.75)','rgba(91,156,246,.75)'],
        borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'55%',
      plugins:{ legend:{ labels:{color:APP.TC,font:{size:12},boxWidth:12} },
        tooltip:{ callbacks:{ label:ctx=>ctx.parsed.toFixed(1)+' kWh' } } } }
  });
}

// ── TABLE ─────────────────────────────────────────────────
function renderTable() {
  const sorted = [...readings].sort((a,b) => b.reading_date.localeCompare(a.reading_date));
  set('cv2-tcount', sorted.length + ' Ablesungen');
  const tbody = document.getElementById('cv2-tbody');
  if (!tbody) return;
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--tx3)">Noch keine Aufzeichnungen</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(r => {
    const d  = new Date(r.reading_date);
    const dt = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const btnStyle = 'border-radius:5px;padding:3px 7px;font-size:11px;cursor:pointer;background:transparent;';
    return `<tr id="cv2-row-${r.id}">
      <td><input type="checkbox" class="cv2-cb" data-id="${r.id}"></td>
      <td style="font-weight:500;white-space:nowrap">${dt}</td>
      <td style="color:#f5c842">${r.solar_kwh??'—'}</td>
      <td style="color:rgba(251,146,60,.9)">${r.fw_kwh??'—'}</td>
      <td style="font-size:11px;color:var(--tx3)">${r.fw_status||'—'}</td>
      <td style="color:#5b9cf6">${r.water_m3??'—'}</td>
      <td style="color:rgba(250,204,21,.9)">${r.strom_kwh??'—'}</td>
      <td>${r.temp_c??'—'}</td>
      <td style="font-size:11px;color:var(--tx3);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.note||''}</td>
      <td style="white-space:nowrap;display:flex;gap:4px">
        <button onclick="CV2.editEntry('${r.id}')" title="Bearbeiten"
          style="${btnStyle}border:1px solid var(--b2);color:var(--tx2)">✎</button>
        <button onclick="CV2.copyEntry('${r.id}')" title="Kopieren / als Basis verwenden"
          style="${btnStyle}border:1px solid var(--b2);color:var(--tx2)">⧉</button>
        <button onclick="CV2.deleteSingle('${r.id}')" title="Löschen"
          style="${btnStyle}border:1px solid rgba(242,92,92,.4);color:var(--rd)">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function toggleAll(cb) { document.querySelectorAll('.cv2-cb').forEach(c => c.checked=cb.checked); }

// ── ENTRY ─────────────────────────────────────────────────
function prefillNow() {
  const el = document.getElementById('cv2-e-date');
  if (el) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    el.value = now.toISOString().slice(0,16);
  }
}

function editEntry(id) {
  const r = readings.find(x => x.id === id);
  if (!r) return;
  // Scroll to form and fill fields
  const tab = document.getElementById('cv2-tab-records');
  if (tab) tab.click();
  const d  = new Date(r.reading_date);
  const local = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const g = id => document.getElementById(id);
  if (g('cv2-e-date'))     g('cv2-e-date').value     = local;
  if (g('cv2-e-solar'))    g('cv2-e-solar').value    = r.solar_kwh ?? '';
  if (g('cv2-e-fw'))       g('cv2-e-fw').value       = r.fw_kwh    ?? '';
  if (g('cv2-e-fwstatus')) g('cv2-e-fwstatus').value = r.fw_status ?? '';
  if (g('cv2-e-water'))    g('cv2-e-water').value    = r.water_m3  ?? '';
  if (g('cv2-e-strom'))    g('cv2-e-strom').value    = r.strom_kwh ?? '';
  if (g('cv2-e-temp'))     g('cv2-e-temp').value     = r.temp_c    ?? '';
  if (g('cv2-e-note'))     g('cv2-e-note').value     = r.note      ?? '';
  // Mark as edit mode: store original ID, remove old entry on save
  const form = g('cv2-e-date')?.closest('.fcard');
  if (form) {
    form.dataset.editId = id;
    const btn = form.querySelector('button.btn-p');
    if (btn) btn.textContent = '✎ Speichern';
    const hint = form.querySelector('#cv2-edit-hint') || (() => {
      const el = document.createElement('div');
      el.id = 'cv2-edit-hint';
      el.style.cssText = 'font-size:11px;color:var(--ac);margin-top:6px';
      btn?.parentNode.appendChild(el);
      return el;
    })();
    hint.textContent = `Bearbeite Eintrag vom ${local.substring(0,10).split('-').reverse().join('.')}`;
    form.scrollIntoView({ behavior:'smooth', block:'center' });
  }
}

function copyEntry(id) {
  const r = readings.find(x => x.id === id);
  if (!r) return;
  const tab = document.getElementById('cv2-tab-records');
  if (tab) tab.click();
  const g = id => document.getElementById(id);
  // Prefill form with same values but new date = now
  prefillNow();
  if (g('cv2-e-solar'))    g('cv2-e-solar').value    = r.solar_kwh ?? '';
  if (g('cv2-e-fw'))       g('cv2-e-fw').value       = r.fw_kwh    ?? '';
  if (g('cv2-e-fwstatus')) g('cv2-e-fwstatus').value = r.fw_status ?? '';
  if (g('cv2-e-water'))    g('cv2-e-water').value    = r.water_m3  ?? '';
  if (g('cv2-e-strom'))    g('cv2-e-strom').value    = r.strom_kwh ?? '';
  if (g('cv2-e-temp'))     g('cv2-e-temp').value     = r.temp_c    ?? '';
  if (g('cv2-e-note'))     g('cv2-e-note').value     = r.note      ?? '';
  const form = g('cv2-e-date')?.closest('.fcard');
  if (form) {
    delete form.dataset.editId;
    const btn = form.querySelector('button.btn-p');
    if (btn) btn.textContent = 'Eintrag speichern';
    const hint = form.querySelector('#cv2-edit-hint');
    if (hint) hint.textContent = 'Werte aus kopiertem Eintrag übernommen — bitte Datum prüfen';
    form.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  APP.toast('Werte kopiert — bitte Datum anpassen');
}

function addEntry() {
  const dateStr = document.getElementById('cv2-e-date')?.value;
  if (!dateStr) { APP.toast('Datum ist Pflichtfeld','err'); return; }
  const reading_date = new Date(dateStr).toISOString();

  // Check if editing existing entry
  const form   = document.getElementById('cv2-e-date')?.closest('.fcard');
  const editId = form?.dataset.editId;
  if (editId) {
    // Replace existing entry
    const idx = readings.findIndex(x => x.id === editId);
    if (idx >= 0) {
      readings[idx] = {
        ...readings[idx],
        reading_date,
        solar_kwh: parseFloat(document.getElementById('cv2-e-solar')?.value)||null,
        fw_kwh:    parseFloat(document.getElementById('cv2-e-fw')?.value)||null,
        fw_status: document.getElementById('cv2-e-fwstatus')?.value||null,
        water_m3:  parseFloat(document.getElementById('cv2-e-water')?.value)||null,
        strom_kwh: parseFloat(document.getElementById('cv2-e-strom')?.value)||null,
        temp_c:    parseFloat(document.getElementById('cv2-e-temp')?.value)||null,
        note:      document.getElementById('cv2-e-note')?.value||null
      };
      readings.sort((a,b) => a.reading_date.localeCompare(b.reading_date));
      saveReadings();
      // Reset form
      delete form.dataset.editId;
      const btn = form.querySelector('button.btn-p');
      if (btn) btn.textContent = 'Eintrag speichern';
      const hint = form.querySelector('#cv2-edit-hint');
      if (hint) hint.textContent = '';
      renderTable(); renderDashboard();
      APP.toast('✓ Eintrag aktualisiert');
      return;
    }
  }

  const entry = {
    id:           APP.genId(),
    reading_date,
    solar_kwh:    parseFloat(document.getElementById('cv2-e-solar')?.value)||null,
    fw_kwh:       parseFloat(document.getElementById('cv2-e-fw')?.value)||null,
    fw_status:    document.getElementById('cv2-e-fwstatus')?.value||null,
    water_m3:     parseFloat(document.getElementById('cv2-e-water')?.value)||null,
    strom_kwh:    parseFloat(document.getElementById('cv2-e-strom')?.value)||null,
    temp_c:       parseFloat(document.getElementById('cv2-e-temp')?.value)||null,
    note:         document.getElementById('cv2-e-note')?.value||null
  };
  readings.push(entry);
  readings.sort((a,b) => a.reading_date.localeCompare(b.reading_date));
  saveReadings();
  renderTable();
  renderDashboard();
  const resEl = document.getElementById('cv2-entry-result');
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ Ablesung gespeichert (${dateStr})</span>`;
  APP.toast('✓ Ablesung gespeichert');
  ['cv2-e-solar','cv2-e-fw','cv2-e-water','cv2-e-strom','cv2-e-temp','cv2-e-note']
    .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

// ── CSV IMPORT ────────────────────────────────────────────
function importCSV(overwrite=false) {
  const raw   = document.getElementById('cv2-csv-in')?.value.trim();
  const resEl = document.getElementById('cv2-import-result');
  if (!raw) { APP.toast('Kein Text eingefügt','err'); return; }

  const lines = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')
    .map(l=>l.trim()).filter(l=>l.length>0);

  const parsed = []; let skipped=0;
  lines.forEach(line => {
    // Skip header line
    if (line.toLowerCase().startsWith('datum')) return;
    const cols = line.split('\t');
    if (cols.length < 2) { skipped++; return; }
    const reading_date = parseDate(cols[0]);
    if (!reading_date) { skipped++; return; }
    parsed.push({
      id:           APP.genId(),
      reading_date,
      solar_kwh:    parseNum(cols[1]),
      fw_kwh:       parseNum(cols[2]),
      fw_status:    cols[3]?.trim()||null,
      water_m3:     parseNum(cols[4]),
      strom_kwh:    parseNum(cols[5]),
      temp_c:       parseNum(cols[6]),
      note:         cols[7]?.trim()||null
    });
  });

  if (!parsed.length) {
    if (resEl) resEl.innerHTML = '<span style="color:var(--rd)">Keine gültigen Zeilen. Format prüfen.</span>';
    return;
  }

  if (overwrite) {
    readings = parsed;
  } else {
    const existDates = new Set(readings.map(r => r.reading_date));
    const fresh = parsed.filter(p => !existDates.has(p.reading_date));
    readings = [...readings, ...fresh];
    if (!fresh.length) {
      if (resEl) resEl.innerHTML = '<span style="color:var(--ac)">Alle Einträge bereits vorhanden. "↺ Neu importieren" verwenden.</span>';
      return;
    }
  }
  readings.sort((a,b) => a.reading_date.localeCompare(b.reading_date));
  saveReadings();
  renderTable();
  renderDashboard();
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ ${parsed.length} Ablesungen importiert.</span>`;
  APP.toast(`✓ ${parsed.length} Ablesungen importiert`);
}

// ── DELETE ────────────────────────────────────────────────
function deleteSingle(id) {
  if (!confirm('Ablesung löschen?')) return;
  readings = readings.filter(r => r.id !== id);
  deleteFromSb([id]);
  saveReadings(false); renderTable(); renderDashboard();
  APP.toast('✓ gelöscht');
}
function deleteSelected() {
  const sel = [...document.querySelectorAll('.cv2-cb:checked')].map(c=>c.dataset.id);
  if (!sel.length) { APP.toast('Keine Zeilen ausgewählt','err'); return; }
  if (!confirm(sel.length+' Ablesungen löschen?')) return;
  readings = readings.filter(r => !sel.includes(r.id));
  deleteFromSb(sel);
  saveReadings(false); renderTable(); renderDashboard();
  APP.toast('✓ '+sel.length+' gelöscht');
}
function deleteRange() {
  const from=document.getElementById('cv2-del-from')?.value;
  const to  =document.getElementById('cv2-del-to')?.value;
  const resEl=document.getElementById('cv2-del-result');
  if (!from||!to) { APP.toast('Von und Bis wählen','err'); return; }
  const toDelete=readings.filter(r=>r.reading_date.substring(0,10)>=from&&r.reading_date.substring(0,10)<=to);
  if (!toDelete.length) { if(resEl) resEl.innerHTML='<span style="color:var(--tx2)">Keine Einträge in diesem Zeitraum.</span>'; return; }
  if (!confirm(toDelete.length+' Ablesungen löschen?')) return;
  const ids=toDelete.map(r=>r.id);
  readings=readings.filter(r=>!ids.includes(r.id));
  deleteFromSb(ids);
  saveReadings(false); renderTable(); renderDashboard();
  if(resEl) resEl.innerHTML=`<span style="color:var(--gr)">✓ ${toDelete.length} gelöscht.</span>`;
}
function clearAll() {
  if (!confirm('Alle Ablesungen löschen?')) return;
  const ids=readings.map(r=>r.id);
  readings=[];
  deleteFromSb(ids);
  saveReadings(false); renderTable(); renderDashboard();
  APP.toast('Alle Ablesungen gelöscht');
}

// ── SUPABASE ──────────────────────────────────────────────
async function deleteFromSb(ids) {
  if (!APP.sbClient||!ids.length) return;
  try { await APP.sbClient.from(CV2_TBL).delete().in('id',ids); }
  catch(e) { console.warn('CV2 delete:',e.message); }
}

function saveReadings(sync=true) {
  try { localStorage.setItem('cv2_readings', JSON.stringify(readings)); } catch(e){}
  if (sync) syncReadings();
}

async function syncReadings() {
  let tries=0;
  while (!APP.sbClient && tries<10) { await new Promise(r=>setTimeout(r,500)); tries++; }
  if (!APP.sbClient) return;
  try {
    if (readings.length > 0) {
      const seen=new Set();
      const rows=readings.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;});
      for (let i=0;i<rows.length;i+=100) {
        const {error}=await APP.sbClient.from(CV2_TBL).upsert(rows.slice(i,i+100),{onConflict:'id'});
        if (error) throw error;
      }
    }
  } catch(e) { console.warn('CV2 sync:',e.message); }
}
// ── INIT ──────────────────────────────────────────────────
function populateDropdowns() {
  const today    = new Date().toISOString().split('T')[0];
  const earliest = getEarliestDate();

  // Always rebuild month dropdown from current readings
  const mEl = document.getElementById('cv2-month');
  if (mEl) {
    const current = mEl.value;
    mEl.innerHTML = '<option value="">—</option>';
    const dates  = readings.map(r => r.reading_date.substring(0,7)).filter(Boolean);
    const months = [...new Set(dates)].sort().reverse();
    const MN = ['','Jänner','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
    months.forEach(ym => {
      const [yr, mo] = ym.split('-').map(Number);
      const opt = document.createElement('option');
      opt.value = ym; opt.textContent = `${MN[mo]} ${yr}`;
      if (ym === current) opt.selected = true;
      mEl.appendChild(opt);
    });
  }

  // Always rebuild year dropdown from current readings
  const yEl = document.getElementById('cv2-year');
  if (yEl) {
    const current = yEl.value;
    yEl.innerHTML = '<option value="">—</option>';
    const years = [...new Set(readings.map(r => r.reading_date.substring(0,4)))].sort().reverse();
    years.forEach(yr => {
      const opt = document.createElement('option');
      opt.value = yr; opt.textContent = yr;
      if (yr === current) opt.selected = true;
      yEl.appendChild(opt);
    });
  }

  // Set Von to earliest, Bis to today
  const fEl = document.getElementById('cv2-from');
  const tEl = document.getElementById('cv2-to');
  if (fEl && !fEl.value) fEl.value = earliest || today;
  if (tEl && !tEl.value) tEl.value = today;

  prefillNow();
  const d30 = new Date(); d30.setDate(d30.getDate()-30);
  const df = document.getElementById('cv2-del-from');
  const dt = document.getElementById('cv2-del-to');
  if (df && !df.value) df.value = d30.toISOString().split('T')[0];
  if (dt && !dt.value) dt.value = today;
}

async function loadReadings() {
  // Load from localStorage first
  try {
    const v = localStorage.getItem('cv2_readings');
    if (v) readings = JSON.parse(v);
  } catch(e) {}

  // Always sync from Supabase — merge any new entries
  let tries = 0;
  while (!APP.sbClient && tries < 10) { await new Promise(r => setTimeout(r,500)); tries++; }
  if (APP.sbClient) {
    try {
      const { data, error } = await APP.sbClient.from(CV2_TBL).select('*').order('reading_date');
      if (!error && data && data.length > 0) {
        // Merge: keep local + add any from Supabase not yet local
        const localIds = new Set(readings.map(r => r.id));
        const newFromSb = data.filter(r => !localIds.has(r.id));
        if (newFromSb.length > 0) {
          readings = [...readings, ...newFromSb]
            .sort((a,b) => a.reading_date.localeCompare(b.reading_date));
          saveReadings(false);
        }
        // If local was empty, use Supabase data directly
        if (readings.length === 0) {
          readings = data;
          saveReadings(false);
        }
      }
    } catch(e) { console.warn('CV2 load:', e.message); }
  }

  // Populate dropdowns and render
  populateDropdowns();
  const fEl = document.getElementById('cv2-from');
  if (fEl && !fEl.value) fEl.value = getEarliestDate() || new Date().toISOString().split('T')[0];
  renderDashboard();
  renderTable();
}

function register() {
  APP.registerPage('consumption2', {
    html: HTML,
    onEnter: async () => {
      await loadReadings();
      APP.FilterBar.create('cv2-timeline', {
        extraDates: readings.map(r => r.reading_date.substring(0,10)),
        onRange: (f, t) => {
          const fe=document.getElementById('cv2-from'); if(fe) fe.value=f;
          const te=document.getElementById('cv2-to');   if(te) te.value=t;
          const pe=document.getElementById('cv2-period'); if(pe) pe.value='custom';
          renderDashboard();
        }
      });
    }
  });
}

return { tab, recTab, onPreset, onMonthPick, onYearPick, onCustomDate,
         resetFilter, renderDashboard, renderTable,
         toggleAll, prefillNow, addEntry, editEntry, copyEntry, importCSV,
         deleteSingle, deleteSelected, deleteRange, clearAll, register };
})();
