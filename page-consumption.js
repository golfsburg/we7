// ═══════════════════════════════════════════════════════════
// PAGE-CONSUMPTION.JS  —  Stromverbrauch
// Analog zu page-pv.js — gleiche Struktur, gleiche Patterns
// ═══════════════════════════════════════════════════════════
const CV = (() => {
'use strict';

// ── HTML ─────────────────────────────────────────────────
const HTML = `
<div class="ph"><div>
  <div class="ph-title">⚡ Stromverbrauch</div>
  <div class="ph-sub">Smart Meter · Viertelstundenwerte · EVN / Netz NÖ</div>
</div></div>

<div class="mtabs" id="cv-tabs">
  <button class="mtab active" onclick="CV.tab('overview',this)">Übersicht</button>
  <button class="mtab"        onclick="CV.tab('profile',this)">Lastprofil</button>
  <button class="mtab"        onclick="CV.tab('data',this)">Daten</button>
  <button class="mtab"        onclick="CV.tab('import',this)">Import / Löschen</button>
</div>

<!-- ÜBERSICHT -->
<div id="cv-t-overview">
  <div class="fbar">
    <label>Granularität</label>
    <select id="cv-gran" onchange="CV.renderOverview()">
      <option value="day">Täglich</option>
      <option value="month" selected>Monatlich</option>
    </select>
    <span class="fsep">|</span>
    <label>Von</label><input type="date"  id="cv-from" onchange="CV.renderOverview()">
    <label>Bis</label><input type="date"  id="cv-to"   onchange="CV.renderOverview()">
    <button class="btn-p" onclick="CV.renderOverview()">Anwenden</button>
    <button class="btn-s" onclick="CV.resetFilter()">Reset</button>
  </div>
  <div class="metrics">
    <div class="mc bl"><div class="mc-l">Netzbezug</div><div><span class="mc-v" id="cv-m-grid">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="cv-m-grid2"></div></div>
    <div class="mc hi"><div class="mc-l">PV Ertrag</div><div><span class="mc-v" id="cv-m-pv">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Gesamtverbrauch</div><div><span class="mc-v" id="cv-m-total">—</span><span class="mc-u">kWh</span></div><div class="mc-d">Netz + PV direkt</div></div>
    <div class="mc gr"><div class="mc-l">Autarkiegrad</div><div><span class="mc-v" id="cv-m-autarky">—</span><span class="mc-u">%</span></div><div class="mc-d" id="cv-m-autarky2"></div></div>
    <div class="mc"><div class="mc-l">Eigenverbrauch</div><div><span class="mc-v" id="cv-m-self">—</span><span class="mc-u">%</span></div><div class="mc-d">PV direkt genutzt</div></div>
    <div class="mc gr"><div class="mc-l">Ersparnis</div><div><span class="mc-v" id="cv-m-saving">—</span><span class="mc-u">€</span></div><div class="mc-d pos" id="cv-m-saving2"></div></div>
  </div>
  <div class="cgrid">
    <div class="cc full">
      <div class="cc-title" id="cv-chart-title">Verbrauch vs. PV-Ertrag</div>
      <div class="cc-sub"   id="cv-chart-sub">kWh</div>
      <div class="leg">
        <div class="li"><span class="ld" style="background:rgba(91,156,246,.75)"></span>Netzbezug</div>
        <div class="li"><span class="ld" style="background:rgba(63,207,142,.75)"></span>PV direkt</div>
        <div class="li"><span class="ld" style="background:#f5c842"></span>PV Ertrag (Linie)</div>
      </div>
      <div class="cw" style="height:240px"><canvas id="cv-c-main"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Autarkiegrad</div>
      <div class="cc-sub">% durch PV gedeckt</div>
      <div class="cw" style="height:185px"><canvas id="cv-c-autarky"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Energiebilanz</div>
      <div class="cc-sub">Verteilung im Zeitraum</div>
      <div class="cw" style="height:185px"><canvas id="cv-c-donut"></canvas></div>
    </div>
  </div>
</div>

<!-- LASTPROFIL -->
<div id="cv-t-profile" style="display:none">
  <div class="fbar">
    <label>Monat</label>
    <input type="month" id="cv-pm" onchange="CV.renderProfile()">
    <button class="btn-p" onclick="CV.renderProfile()">Anzeigen</button>
  </div>
  <div class="metrics">
    <div class="mc"><div class="mc-l">Ø Tagesverbrauch</div><div><span class="mc-v" id="pr-avg">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Spitzenstunde</div><div><span class="mc-v" id="pr-peak">—</span><span class="mc-u">Uhr</span></div></div>
    <div class="mc"><div class="mc-l">Tage mit Daten</div><div><span class="mc-v" id="pr-days">—</span></div></div>
    <div class="mc"><div class="mc-l">Messpunkte</div><div><span class="mc-v" id="pr-pts">—</span></div></div>
  </div>
  <div class="cc full">
    <div class="cc-title">Ø Lastprofil</div>
    <div class="cc-sub">Durchschnittlicher Stundenwert — 🔴 Spitze · 🟡 hoch · 🔵 normal</div>
    <div class="cw" style="height:260px"><canvas id="cv-c-profile"></canvas></div>
  </div>
</div>

<!-- DATEN -->
<div id="cv-t-data" style="display:none">
  <div class="fbar">
    <label>Von</label><input type="date" id="cv-tf-from" onchange="CV.renderTable()">
    <label>Bis</label><input type="date" id="cv-tf-to"   onchange="CV.renderTable()">
    <label>Richtung</label>
    <select id="cv-tf-dir" onchange="CV.renderTable()">
      <option value="all">Alle</option>
      <option value="grid">Netzbezug</option>
      <option value="feed">Einspeisung</option>
    </select>
    <label>Sort</label>
    <select id="cv-tf-sort" onchange="CV.renderTable()">
      <option value="date-desc">Datum ↓</option>
      <option value="date-asc">Datum ↑</option>
      <option value="kwh-desc">kWh ↓</option>
    </select>
    <button class="btn-s btn-d" onclick="CV.deleteSelected()">Auswahl löschen</button>
  </div>
  <div class="tcard">
    <div class="thead"><div class="thead-t" id="cv-tcount">—</div></div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th><input type="checkbox" id="cv-cb-all" onchange="CV.toggleAll(this)"></th>
          <th>Datum</th><th>Stunde</th><th>Minute</th><th>kWh</th><th>Richtung</th>
        </tr></thead>
        <tbody id="cv-tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- IMPORT / LÖSCHEN -->
<div id="cv-t-import" style="display:none">
  <div class="fcard">
    <div class="fcard-t">📥 Smart Meter Import (EVN / Netz NÖ)</div>
    <p style="font-size:13px;color:var(--tx2);margin-bottom:8px">
      Export unter <strong>meinestrom.at</strong> → Verbrauch → Viertelstundenwerte → CSV → hier einfügen.
    </p>
    <div class="note" style="margin-bottom:12px">
      📋 Semikolon-getrennt · Spalte 7 = Von-Zeit (DD.MM.YYYY HH:MM) · Spalte 15 = kWh · <strong>Lieferung</strong> = Netzbezug · <strong>Einspeisung</strong> = Einspeisung
    </div>
    <textarea class="csv-area" id="cv-csv-in" placeholder='Export_Bezeichnung;...;Energierichtung;Von;Zeitzone;Bis;...;Wert;Einheit&#10;"2026-04";...;Lieferung;01.04.2026 00:00:00;MESZ;...;0,069000;kWh;gemessen;'></textarea>
    <div class="brow">
      <button class="btn-p" onclick="CV.importCSV(false)">Importieren (hinzufügen)</button>
      <button class="btn-s" onclick="CV.importCSV(true)">↺ Neu importieren (überschreiben)</button>
    </div>
    <div id="cv-import-result" style="font-size:12px;color:var(--tx2);margin-top:10px"></div>
  </div>

  <div class="fcard" style="border-color:rgba(91,156,246,.2)">
    <div class="fcard-t" style="font-size:13px;color:var(--tx2)">
      <span>🗄 Supabase Datenbank — Tabelle <code>consumption_15min</code></span>
      <button class="copy-btn" onclick="APP.copyCode('cv-sql')">Kopieren</button>
    </div>
    <div style="font-size:12px;color:var(--tx2);line-height:2;margin-bottom:8px">
      Verbrauchsdaten werden automatisch mit Supabase synchronisiert.<br>
      Falls die Tabelle noch nicht existiert, einmalig im <strong>Supabase SQL Editor</strong> ausführen:
    </div>
    <div class="code-block" id="cv-sql">create table if not exists consumption_15min (
  id text primary key,
  date date not null,
  hour smallint not null,
  minute smallint not null,
  kwh numeric not null,
  direction text default 'grid',
  created_at timestamptz default now()
);
alter table consumption_15min enable row level security;
create policy "allow_all" on consumption_15min
  for all using (true) with check (true);
create index if not exists idx_cv_date on consumption_15min(date);</div>
  </div>

  <div class="fcard" style="border-color:rgba(242,92,92,.2)">
    <div class="fcard-t" style="color:var(--rd)">⚠ Daten löschen</div>
    <div style="margin-bottom:14px">
      <p style="font-size:12px;color:var(--tx2);margin-bottom:10px">Zeitraum wählen und alle Messpunkte darin löschen:</p>
      <div class="fgrid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="field"><label>Von</label><input type="date" id="cv-del-from"></div>
        <div class="field"><label>Bis</label><input type="date" id="cv-del-to"></div>
      </div>
      <div class="brow">
        <button class="btn-s btn-d" onclick="CV.deleteRange()">Zeitraum löschen</button>
        <button class="btn-s btn-d" onclick="CV.clearAll()">Alle Verbrauchsdaten löschen</button>
      </div>
      <div id="cv-del-result" style="font-size:12px;color:var(--tx2);margin-top:8px"></div>
    </div>
  </div>
</div>
`;

// ── HELPERS ───────────────────────────────────────────────
// Normalize a raw consumption record — always call this on data from any source
function norm(c) {
  return {
    id:        c.id,
    date:      String(c.date).substring(0, 10),   // always YYYY-MM-DD
    hour:      parseInt(c.hour,   10),              // always integer
    minute:    parseInt(c.minute, 10),              // always integer
    kwh:       parseFloat(c.kwh),                   // always float
    direction: c.direction || 'grid'
  };
}

// Get normalized consumption array (always use this, never APP.consumption directly)
function getCv() {
  return APP.consumption.map(norm);
}

const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// ── TABS ─────────────────────────────────────────────────
function tab(name, btn) {
  ['overview','profile','data','import'].forEach(t => {
    const el = document.getElementById('cv-t-' + t);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('#cv-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name === 'overview') renderOverview();
  if (name === 'profile')  renderProfile();
  if (name === 'data')     renderTable();
}

// ── FILTER RESET ──────────────────────────────────────────
function resetFilter() {
  const yr = new Date().getFullYear(), today = new Date().toISOString().split('T')[0];
  const f = document.getElementById('cv-from'), t = document.getElementById('cv-to');
  if (f) f.value = yr + '-01-01';
  if (t) t.value = today;
  const g = document.getElementById('cv-gran'); if (g) g.value = 'month';
  renderOverview();
}

// ── OVERVIEW ─────────────────────────────────────────────
function renderOverview() {
  const gran = document.getElementById('cv-gran')?.value || 'month';
  const from = document.getElementById('cv-from')?.value;
  const to   = document.getElementById('cv-to')?.value;

  const cv = getCv().filter(c =>
    c.direction === 'grid' &&
    (!from || c.date >= from) &&
    (!to   || c.date <= to)
  );

  // Aggregate into buckets (day or month)
  const map = {};
  cv.forEach(c => {
    const key = gran === 'day' ? c.date : c.date.substring(0, 7);
    if (!map[key]) map[key] = 0;
    map[key] += c.kwh;
  });
  const bk     = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
  const labels  = bk.map(([k]) => k);
  const gridArr = bk.map(([,v]) => +v.toFixed(3));

  // PV data for same buckets
  const pvArr = labels.map(k => {
    if (gran === 'day') return APP.getDayPv(k);
    return APP.getMonthPv(k);
  });
  const directArr = gridArr.map((g, i) => +APP.calcDirect(pvArr[i], g).toFixed(3));

  // Totals
  const gridTotal   = gridArr.reduce((a,b)  => a+b, 0);
  const pvTotal     = pvArr.reduce((a,b)    => a+b, 0);
  const directTotal = directArr.reduce((a,b)=> a+b, 0);
  const totalC      = gridTotal + directTotal;
  const autarky     = totalC > 0 ? Math.round(directTotal / totalC * 100) : 0;
  const selfUse     = pvTotal > 0 ? Math.round(directTotal / pvTotal * 100) : 0;
  const saving      = directTotal * APP.cfg.price;
  const granLabel   = gran === 'day' ? 'Tage' : 'Monate';

  set('cv-m-grid',     gridTotal.toFixed(2));
  set('cv-m-pv',       pvTotal.toFixed(2));
  set('cv-m-total',    totalC.toFixed(2));
  set('cv-m-autarky',  autarky || '—');
  set('cv-m-self',     selfUse || '—');
  set('cv-m-saving',   saving.toFixed(2));
  set('cv-m-saving2',  directTotal.toFixed(2) + ' kWh direkt genutzt');
  set('cv-m-grid2',    cv.length + ' Messpunkte');
  set('cv-chart-title', gran === 'day' ? 'Tagesverbrauch' : 'Monatsverbrauch');
  set('cv-chart-sub',  bk.length + ' ' + granLabel);

  const auEl = document.getElementById('cv-m-autarky2');
  if (auEl) {
    auEl.textContent = autarky>=50?'✓ Gut':autarky>=25?'~ Mittel':pvTotal>0?'⚠ Niedrig':'Keine PV-Daten';
    auEl.className   = 'mc-d' + (autarky>=50?' pos':autarky>=25?'':' neg');
  }

  // Charts
  const autarkyArr = gridArr.map((g,i) => {
    const tot = g + directArr[i];
    return tot > 0 ? Math.round(directArr[i] / tot * 100) : 0;
  });
  const feedArr = pvArr.map((p,i) => +Math.max(0, p - directArr[i]).toFixed(3));

  ['cv-m','cv-au','cv-dn'].forEach(id => APP.destroyChart(id));

  APP.charts['cv-m'] = new Chart(document.getElementById('cv-c-main'), {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Netzbezug', data:gridArr,   backgroundColor:'rgba(91,156,246,.75)', borderRadius:3, stack:'s' },
      { label:'PV direkt', data:directArr, backgroundColor:'rgba(63,207,142,.75)', borderRadius:3, stack:'s' },
      { label:'PV Ertrag', data:pvArr, type:'line', borderColor:'#f5c842',
        backgroundColor:'transparent', fill:false, tension:0.35,
        pointRadius:3, borderWidth:2, pointBackgroundColor:'#f5c842' }
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{stacked:true, ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC}} } }
  });

  APP.charts['cv-au'] = new Chart(document.getElementById('cv-c-autarky'), {
    type: 'line',
    data: { labels, datasets:[{ data:autarkyArr, borderColor:'#3fcf8e',
      backgroundColor:'rgba(63,207,142,.1)', fill:true, tension:0.35, pointRadius:2, borderWidth:1.5 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC}},
               y:{min:0, max:100, ticks:{color:APP.TC,font:{size:10},callback:v=>v+'%'}, grid:{color:APP.GC}} } }
  });

  APP.charts['cv-dn'] = new Chart(document.getElementById('cv-c-donut'), {
    type: 'doughnut',
    data: { labels:['Netzbezug','PV Eigenverbrauch','PV Einspeisung'],
      datasets:[{ data:[+gridTotal.toFixed(2), +directTotal.toFixed(2), +feedArr.reduce((a,b)=>a+b,0).toFixed(2)],
        backgroundColor:['rgba(91,156,246,.75)','rgba(63,207,142,.75)','rgba(245,200,66,.65)'], borderWidth:0 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{ legend:{ labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } },
        tooltip:{ callbacks:{ label:ctx=>ctx.parsed.toFixed(3)+' kWh' } } } }
  });
}

// ── LASTPROFIL ────────────────────────────────────────────
function renderProfile() {
  const ym   = document.getElementById('cv-pm')?.value || new Date().toISOString().substring(0,7);
  const data = getCv().filter(c => c.date.startsWith(ym) && c.direction === 'grid');

  // Build per-day hourly sums:  dayMap[date][0..23] = kWh total for that hour
  const dayMap = {};
  data.forEach(c => {
    if (!dayMap[c.date]) dayMap[c.date] = Array(24).fill(0);
    dayMap[c.date][c.hour] += c.kwh;
  });

  const days  = Object.keys(dayMap);
  const nDays = days.length;

  // Average each hour across all days
  const hourly = Array(24).fill(0);
  days.forEach(d => {
    dayMap[d].forEach((v, h) => { hourly[h] += v; });
  });
  if (nDays > 0) {
    hourly.forEach((_, i) => { hourly[i] = +(hourly[i] / nDays).toFixed(4); });
  }

  const dayTotal = +(hourly.reduce((a,b) => a+b, 0)).toFixed(2);
  const maxV     = nDays > 0 ? Math.max(...hourly) : 0;
  const peakH    = maxV > 0 ? hourly.indexOf(maxV) : 0;

  set('pr-avg',  dayTotal);
  set('pr-peak', String(peakH).padStart(2,'0') + ':00');
  set('pr-days', nDays);
  set('pr-pts',  data.length);

  const labels = Array.from({length:24}, (_,i) => String(i).padStart(2,'0')+':00');
  const bg = hourly.map(v =>
    maxV > 0 && v === maxV    ? 'rgba(242,92,92,.75)'  :
    maxV > 0 && v > maxV*.70  ? 'rgba(245,200,66,.65)' :
                                 'rgba(91,156,246,.65)');

  APP.destroyChart('cv-prof');
  APP.charts['cv-prof'] = new Chart(document.getElementById('cv-c-profile'), {
    type: 'bar',
    data: { labels, datasets:[{ data:hourly, backgroundColor:bg, borderRadius:3 }] },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label: ctx => ctx.parsed.y.toFixed(4) + ' kWh' } } },
      scales:{
        x:{ ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC} },
        y:{ ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC},
            title:{display:true, text:'kWh/h Ø', color:APP.TC, font:{size:10}} }
      }
    }
  });
}

// ── DATEN-TABELLE ─────────────────────────────────────────
function renderTable() {
  const from = document.getElementById('cv-tf-from')?.value;
  const to   = document.getElementById('cv-tf-to')?.value;
  const dir  = document.getElementById('cv-tf-dir')?.value || 'all';
  const sort = document.getElementById('cv-tf-sort')?.value || 'date-desc';

  let data = getCv();
  if (from)       data = data.filter(c => c.date >= from);
  if (to)         data = data.filter(c => c.date <= to);
  if (dir!=='all') data = data.filter(c => c.direction === dir);

  if (sort==='date-desc') data.sort((a,b) => b.date!==a.date ? b.date.localeCompare(a.date) : b.hour-a.hour || b.minute-a.minute);
  else if (sort==='date-asc') data.sort((a,b) => a.date!==b.date ? a.date.localeCompare(b.date) : a.hour-b.hour || a.minute-b.minute);
  else data.sort((a,b) => b.kwh - a.kwh);

  set('cv-tcount', data.length + ' Messpunkte');
  const tbody = document.getElementById('cv-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--tx3)">Keine Einträge</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(c => {
    const dirLabel = c.direction === 'grid' ? '<span class="badge good">Netzbezug</span>' : '<span class="badge mid">Einspeisung</span>';
    return `<tr>
      <td><input type="checkbox" class="cv-cb" data-id="${c.id}"></td>
      <td style="font-weight:500">${c.date}</td>
      <td>${String(c.hour).padStart(2,'0')}:00</td>
      <td>${String(c.minute).padStart(2,'0')}</td>
      <td style="color:var(--bl)">${c.kwh.toFixed(4)} kWh</td>
      <td>${dirLabel}</td>
    </tr>`;
  }).join('');
}

function toggleAll(cb) { document.querySelectorAll('.cv-cb').forEach(c => c.checked = cb.checked); }

function deleteSelected() {
  const sel = [...document.querySelectorAll('.cv-cb:checked')].map(c => c.dataset.id);
  if (!sel.length) { APP.toast('Keine Zeilen ausgewählt','err'); return; }
  if (!confirm(sel.length + ' Messpunkte löschen?')) return;
  APP.setConsumption(APP.consumption.filter(c => !sel.includes(c.id)));
  APP.saveCv(); renderTable(); APP.updateSidebar();
  APP.toast('✓ ' + sel.length + ' gelöscht');
}

// ── IMPORT ────────────────────────────────────────────────
function importCSV(overwrite = false) {
  const raw   = document.getElementById('cv-csv-in')?.value.trim();
  const resEl = document.getElementById('cv-import-result');
  if (!raw) { APP.toast('Kein CSV eingefügt','err'); return; }

  // Strip BOM, normalize line endings
  const cleaned = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines   = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const parsed = [];
  let skipped  = 0;

  lines.forEach((line, idx) => {
    // Skip header line (contains column names)
    if (line.startsWith('Export_Bezeichnung') || line.startsWith('"Export_Bezeichnung')) return;

    const cols = line.split(';');
    // Need at least 15 columns (index 0–14)
    if (cols.length < 15) { skipped++; return; }

    try {
      // col[5]  = Energierichtung: "Lieferung" or "Einspeisung"
      // col[6]  = Von: "DD.MM.YYYY HH:MM:SS"
      // col[14] = Wert: "0,069000"
      const direction = cols[5].trim();
      const vonRaw    = cols[6].trim();
      const wertRaw   = cols[14].trim().replace(',', '.');

      const kwh = parseFloat(wertRaw);
      if (isNaN(kwh) || vonRaw.length < 10) { skipped++; return; }

      // Parse "DD.MM.YYYY HH:MM:SS"
      // Split at space: ["DD.MM.YYYY", "HH:MM:SS"]
      const parts    = vonRaw.split(' ');
      const datePart = parts[0];          // "DD.MM.YYYY"
      const timePart = parts[1] || '00:00:00'; // "HH:MM:SS"

      const dp = datePart.split('.');
      if (dp.length < 3) { skipped++; return; }
      const dd   = dp[0].padStart(2, '0');
      const mm   = dp[1].padStart(2, '0');
      const yyyy = dp[2].length === 4 ? dp[2] : '20' + dp[2];
      const date = `${yyyy}-${mm}-${dd}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; return; }

      const tp     = timePart.split(':');
      const hour   = parseInt(tp[0] || '0', 10);
      const minute = parseInt(tp[1] || '0', 10);
      if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23) { skipped++; return; }

      const dir = direction.toLowerCase().includes('einspeisung') ? 'feed' : 'grid';

      parsed.push({
        id:        APP.genId(),
        date,                 // "YYYY-MM-DD" string
        hour,                 // integer 0–23
        minute,               // integer 0,15,30,45
        kwh,                  // float
        direction: dir
      });
    } catch(e) { skipped++; }
  });

  if (!parsed.length) {
    if (resEl) resEl.innerHTML = '<span style="color:var(--rd)">Keine gültigen Zeilen gefunden. Bitte Format prüfen.</span>';
    APP.toast('Import fehlgeschlagen','err');
    return;
  }

  const importDates = new Set(parsed.map(c => c.date));

  if (overwrite) {
    // Remove all existing entries for dates in this import, then add new
    const kept = APP.consumption.filter(c => !importDates.has(String(c.date).substring(0,10)));
    APP.setConsumption(
      [...kept, ...parsed].sort((a,b) =>
        a.date !== b.date ? a.date.localeCompare(b.date) :
        a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute
      )
    );
  } else {
    // Add only new entries (not already present by date+hour+minute+direction)
    const existKeys = new Set(
      APP.consumption.map(c =>
        `${String(c.date).substring(0,10)}|${parseInt(c.hour,10)}|${parseInt(c.minute,10)}|${c.direction}`
      )
    );
    const fresh = parsed.filter(c => !existKeys.has(`${c.date}|${c.hour}|${c.minute}|${c.direction}`));
    if (!fresh.length) {
      if (resEl) resEl.innerHTML = '<span style="color:var(--ac)">⚠ Alle Einträge bereits vorhanden. Verwende "↺ Neu importieren (überschreiben)".</span>';
      return;
    }
    APP.setConsumption(
      [...APP.consumption.map(norm), ...fresh].sort((a,b) =>
        a.date !== b.date ? a.date.localeCompare(b.date) :
        a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute
      )
    );
  }

  APP.saveCv(); renderOverview(); APP.updateSidebar();

  const days = importDates.size;
  const msg  = overwrite
    ? `✓ ${parsed.length} Messpunkte für ${days} Tage importiert (überschrieben).`
    : `✓ ${parsed.length} neue Messpunkte (${days} Tage)${skipped > 0 ? ' · ' + skipped + ' übersprungen' : ''}.`;
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">${msg}</span>`;
  APP.toast(`✓ ${parsed.length} Messpunkte importiert`);
}

// ── LÖSCHEN ───────────────────────────────────────────────
function deleteRange() {
  const from  = document.getElementById('cv-del-from')?.value;
  const to    = document.getElementById('cv-del-to')?.value;
  const resEl = document.getElementById('cv-del-result');
  if (!from || !to) { APP.toast('Bitte Von und Bis wählen','err'); return; }
  if (from > to)    { APP.toast('Von muss vor Bis liegen','err'); return; }

  const toDelete = APP.consumption.filter(c => {
    const d = String(c.date).substring(0,10);
    return d >= from && d <= to;
  });
  if (!toDelete.length) {
    if (resEl) resEl.innerHTML = '<span style="color:var(--tx2)">Keine Messpunkte in diesem Zeitraum.</span>';
    return;
  }
  if (!confirm(`${toDelete.length} Messpunkte vom ${from} bis ${to} löschen?`)) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }

  const days = new Set(toDelete.map(c => String(c.date).substring(0,10))).size;
  APP.setConsumption(APP.consumption.filter(c => {
    const d = String(c.date).substring(0,10);
    return !(d >= from && d <= to);
  }));
  APP.saveCv(); renderOverview(); APP.updateSidebar();
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ ${toDelete.length} Messpunkte (${days} Tage) gelöscht.</span>`;
  APP.toast(`✓ ${toDelete.length} Messpunkte gelöscht`);
}

function clearAll() {
  if (!confirm('Alle Verbrauchsdaten löschen?')) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }
  APP.setConsumption([]);
  APP.saveCv(); renderOverview(); APP.updateSidebar();
  APP.toast('Verbrauchsdaten gelöscht');
}

// ── INIT ──────────────────────────────────────────────────
function initDefaults() {
  const today = new Date().toISOString().split('T')[0];
  const ym    = today.substring(0,7);
  const g     = id => document.getElementById(id);

  // Set Von to earliest available consumption date, fallback to 2 years ago
  const dates  = APP.consumption.map(c => String(c.date).substring(0,10)).filter(Boolean).sort();
  const earliest = dates.length > 0 ? dates[0] : (parseInt(today.substring(0,4))-2) + '-01-01';

  if (g('cv-from'))    g('cv-from').value    = earliest;
  if (g('cv-to'))      g('cv-to').value      = today;
  if (g('cv-pm'))      g('cv-pm').value      = ym;
  if (g('cv-tf-from')) g('cv-tf-from').value = earliest;
  if (g('cv-tf-to'))   g('cv-tf-to').value   = today;

  const d30 = new Date(); d30.setDate(d30.getDate()-30);
  if (g('cv-del-from')) g('cv-del-from').value = d30.toISOString().split('T')[0];
  if (g('cv-del-to'))   g('cv-del-to').value   = today;
}

function register() {
  APP.registerPage('consumption', {
    html:    HTML,
    onEnter: () => { initDefaults(); renderOverview(); }
  });
}

return { tab, resetFilter, renderOverview, renderProfile, renderTable,
         toggleAll, deleteSelected, importCSV, deleteRange, clearAll, register };
})();
