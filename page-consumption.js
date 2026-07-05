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

<div id="cv-timeline"></div>

<div class="gran-bar">
  <label class="gran-lbl">Granularität</label>
  <label class="gran-opt"><input type="radio" name="cv-gran" value="15min" onchange="CV.renderOverview()"><span>15 Min</span></label>
  <label class="gran-opt"><input type="radio" name="cv-gran" value="day" onchange="CV.renderOverview()"><span>Tag</span></label>
  <label class="gran-opt active"><input type="radio" name="cv-gran" value="month" checked onchange="CV.renderOverview()"><span>Monat</span></label>
  <label class="gran-opt"><input type="radio" name="cv-gran" value="year" onchange="CV.renderOverview()"><span>Jahr</span></label>
</div>

<div class="mtabs" id="cv-tabs">
  <button class="mtab active" onclick="CV.tab('overview',this)">Übersicht</button>
  <button class="mtab"        onclick="CV.tab('profile',this)">Lastprofil</button>
  <button class="mtab"        onclick="CV.tab('data',this)">Daten</button>
  <button class="mtab"        onclick="CV.tab('import',this)">Import / Löschen</button>
</div>

<!-- ÜBERSICHT -->
<div id="cv-t-overview">
  <div id="cv-timeline-filter"></div>
  <div class="metrics">
    <div class="mc bl"><div class="mc-l">Netzbezug</div><div><span class="mc-v" id="cv-m-grid">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="cv-m-grid2"></div></div>
    <div class="mc"><div class="mc-l">Ø pro Tag</div><div><span class="mc-v" id="cv-m-avg">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Kosten (geschätzt)</div><div><span class="mc-v" id="cv-m-cost">—</span><span class="mc-u">€</span></div><div class="mc-d" id="cv-m-cost2"></div></div>
    <div class="mc"><div class="mc-l">Messpunkte</div><div><span class="mc-v" id="cv-m-pts">—</span></div></div>
  </div>
  <div class="cgrid">
    <div class="cc full">
      <div class="cc-title" id="cv-chart-title">Netzbezug</div>
      <div class="cc-sub"   id="cv-chart-sub">kWh</div>
      <div class="cw" style="height:260px"><canvas id="cv-c-main"></canvas></div>
    </div>
  </div>
</div>

<!-- LASTPROFIL -->
<div id="cv-t-profile" style="display:none">
<div id="cv-profile-timeline"></div>
  <div class="metrics">
    <div class="mc"><div class="mc-l">Ø Tagesverbrauch</div><div><span class="mc-v" id="pr-avg">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Spitzenstunde</div><div><span class="mc-v" id="pr-peak">—</span><span class="mc-u">Uhr</span></div></div>
    <div class="mc"><div class="mc-l">Tage mit Daten</div><div><span class="mc-v" id="pr-days">—</span></div></div>
    <div class="mc"><div class="mc-l">Messpunkte</div><div><span class="mc-v" id="pr-pts">—</span></div></div>
  </div>
  <div class="cc full">
    <div class="cc-title" id="pr-chart-title">Ø Lastprofil</div>
    <div class="cc-sub" id="pr-chart-sub">Durchschnittlicher Stundenwert — 🔴 Spitze · 🟡 hoch · 🔵 normal</div>
    <div class="cw" style="height:260px"><canvas id="cv-c-profile"></canvas></div>
  </div>
</div>

<!-- DATEN -->
<div id="cv-t-data" style="display:none">
  <div class="fbar">
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
      📋 Unterstützte Formate:<br>
      · <strong>Semikolon-getrennt</strong> (ältere EVN Exporte): Spalte 6 = Energierichtung, Spalte 7 = Von-Zeit, Spalte 15 = kWh<br>
      · <strong>Tab-getrennt</strong> (neuere Exporte): gleiche Spaltenreihenfolge, Datum DD.MM.YY oder DD.MM.YYYY<br>
      <strong>Lieferung</strong> = Netzbezug · <strong>Einspeisung</strong> = Einspeisung
    </div>
    <!-- File picker -->
    <div style="margin-bottom:12px">
      <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);font-weight:500;margin-bottom:6px">CSV Datei auswählen</label>
      <input type="file" id="cv-file" accept=".csv,.txt"
        style="font-family:var(--fm);font-size:12px;color:var(--tx2);background:var(--bg3);border:1px solid var(--b2);border-radius:8px;padding:8px 10px;width:100%;cursor:pointer"
        onchange="CV.loadFile(this)">
      <div id="cv-file-info" style="font-size:11px;color:var(--tx3);margin-top:4px"></div>
    </div>
    <!-- Manual paste fallback -->
    <div style="margin-bottom:10px">
      <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx2);font-weight:500;margin-bottom:6px">Oder CSV-Inhalt einfügen</label>
      <textarea class="csv-area" id="cv-csv-in" placeholder="CSV-Inhalt hier einfügen..."></textarea>
    </div>
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
  const gran  = document.querySelector('input[name="cv-gran"]:checked')?.value || 'month';
  const range = APP.FilterBar.getRange('cv-timeline');
  const from  = range.from;
  const to    = range.to;

  const cv = getCv().filter(c =>
    c.direction === 'grid' &&
    (!from || c.date >= from) &&
    (!to   || c.date <= to)
  );

  // Aggregate into buckets by granularity
  const map = {};
  cv.forEach(c => {
    let key;
    if (gran === '15min')     key = `${c.date} ${String(c.hour).padStart(2,'0')}:${String(c.minute).padStart(2,'0')}`;
    else if (gran === 'day')  key = c.date;
    else if (gran === 'year') key = c.date.substring(0, 4);
    else                      key = c.date.substring(0, 7); // month
    if (!map[key]) map[key] = 0;
    map[key] += c.kwh;
  });
  const bk      = Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
  const labels  = bk.map(([k]) => {
    if (gran === '15min') return k.substring(11); // just HH:MM
    if (gran === 'day')   { const dt=new Date(k+'T00:00:00'); return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`; }
    if (gran === 'year')  return k;
    return APP.MONTHS[new Date(k+'-01').getMonth()] + ' ' + k.substring(2,4);
  });
  const gridArr = bk.map(([,v]) => +v.toFixed(gran==='15min'?4:3));

  const gridTotal = gridArr.reduce((a,b) => a+b, 0);
  const avgDay    = bk.length > 0 ? gridTotal / bk.length : 0;
  const cost      = gridTotal * APP.cfg.price;
  const granLabelMap = {'15min':'15-Min-Werte','day':'Tageswerte','month':'Monatswerte','year':'Jahreswerte'};
  const granCountMap = {'15min':'Intervalle','day':'Tage','month':'Monate','year':'Jahre'};
  const granLabel = granLabelMap[gran] || 'Monatswerte';

  set('cv-m-grid',   gridTotal.toFixed(2));
  set('cv-m-grid2',  cv.length + ' Messpunkte');
  set('cv-m-avg',    avgDay.toFixed(2));
  set('cv-m-cost',   cost.toFixed(2));
  set('cv-m-cost2',  `@ ${APP.cfg.price} €/kWh`);
  set('cv-m-pts',    cv.length.toLocaleString('de'));
  set('cv-chart-title', granLabel + ' — Netzbezug');
  set('cv-chart-sub', bk.length + ' ' + (granCountMap[gran]||'Einträge'));

  // Single bar chart — pure consumption
  APP.destroyChart('cv-m');
  APP.charts['cv-m'] = new Chart(document.getElementById('cv-c-main'), {
    type: 'bar',
    data: { labels, datasets: [{
      label: 'Netzbezug',
      data:  gridArr,
      backgroundColor: 'rgba(91,156,246,.75)',
      borderRadius: 3
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC} },
        y: { ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC},
             title:{display:true,text:'kWh',color:APP.TC,font:{size:10}} }
      }
    }
  });
}

// ── LASTPROFIL ────────────────────────────────────────────
function resetProfile() {
  const dates    = APP.consumption.map(c => String(c.date).substring(0,10)).filter(Boolean).sort();
  const earliest = dates.length > 0 ? dates[0] : new Date().getFullYear() + '-01-01';
  const today    = new Date().toISOString().split('T')[0];
  const f = document.getElementById('pr-from'), t = document.getElementById('pr-to');
  const g = document.getElementById('pr-gran');
  if (f) f.value = earliest;
  if (t) t.value = today;
  if (g) g.value = 'day';
  renderProfile();
}

function renderProfile() {
  const gran = document.getElementById('pr-gran')?.value || 'day';
  const from = document.getElementById('pr-from')?.value;
  const to   = document.getElementById('pr-to')?.value;

  const data = getCv().filter(c =>
    c.direction === 'grid' &&
    (!from || c.date >= from) &&
    (!to   || c.date <= to)
  );

  // Build per-day hourly sums: dayMap[date][0..23] = total kWh for that hour
  const dayMap = {};
  data.forEach(c => {
    if (!dayMap[c.date]) dayMap[c.date] = Array(24).fill(0);
    dayMap[c.date][c.hour] += c.kwh;
  });

  const days  = Object.keys(dayMap);
  const nDays = days.length;

  // Average each hour across all days in range
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
  const granLabel = { day:'Tage', week:'Wochen', month:'Monate' }[gran];
  const rangeLabel = from && to ? `${from} – ${to}` : 'Gesamter Zeitraum';

  set('pr-avg',  dayTotal);
  set('pr-peak', String(peakH).padStart(2,'0') + ':00');
  set('pr-days', nDays);
  set('pr-pts',  data.length);
  set('pr-chart-title', 'Ø Lastprofil');
  set('pr-chart-sub',   `${nDays} ${granLabel} · ${rangeLabel} — 🔴 Spitze · 🟡 hoch · 🔵 normal`);

  const labels = Array.from({length:24}, (_,i) => String(i).padStart(2,'0')+':00');
  const bg = hourly.map(v =>
    maxV > 0 && v === maxV    ? 'rgba(242,92,92,.75)'  :
    maxV > 0 && v > maxV*.70  ? 'rgba(245,200,66,.65)' :
                                 'rgba(91,156,246,.65)');

  APP.destroyChart('cv-prof');
  APP.charts['cv-prof'] = new Chart(document.getElementById('cv-c-profile'), {
    type: 'bar',
    data: { labels, datasets:[{ data:hourly, backgroundColor:bg, borderRadius:3 }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label: ctx => ctx.parsed.y.toFixed(4) + ' kWh/h' } } },
      scales:{
        x:{ ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC} },
        y:{ ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC},
            title:{display:true, text:'kWh/h Ø', color:APP.TC, font:{size:10}} }
      }
    }
  });
}

// ── DATEN-TABELLE ─────────────────────────────────────────
let cvPage = 0;
const CV_PAGE_SIZE = 200;

function renderTable() {
  const from = document.getElementById('cv-tf-from')?.value;
  const to   = document.getElementById('cv-tf-to')?.value;
  const dir  = document.getElementById('cv-tf-dir')?.value || 'all';
  const sort = document.getElementById('cv-tf-sort')?.value || 'date-desc';

  let data = getCv();
  if (from)        data = data.filter(c => c.date >= from);
  if (to)          data = data.filter(c => c.date <= to);
  if (dir!=='all') data = data.filter(c => c.direction === dir);

  if (sort==='date-desc') data.sort((a,b) => b.date!==a.date ? b.date.localeCompare(a.date) : b.hour-a.hour || b.minute-a.minute);
  else if (sort==='date-asc') data.sort((a,b) => a.date!==b.date ? a.date.localeCompare(b.date) : a.hour-b.hour || a.minute-b.minute);
  else data.sort((a,b) => b.kwh - a.kwh);

  const total   = data.length;
  const maxPage = Math.max(0, Math.ceil(total / CV_PAGE_SIZE) - 1);
  if (cvPage > maxPage) cvPage = maxPage;
  const pageData = data.slice(cvPage * CV_PAGE_SIZE, (cvPage + 1) * CV_PAGE_SIZE);

  set('cv-tcount', `${total.toLocaleString('de')} Messpunkte · Seite ${cvPage+1} / ${maxPage+1}`);
  const tbody = document.getElementById('cv-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--tx3)">Keine Einträge</td></tr>';
    renderCvPager(0, 0); return;
  }

  tbody.innerHTML = pageData.map(c => {
    const dirLabel = c.direction === 'grid'
      ? '<span class="badge good">Netzbezug</span>'
      : '<span class="badge mid">Einspeisung</span>';
    return `<tr>
      <td><input type="checkbox" class="cv-cb" data-id="${c.id}"></td>
      <td style="font-weight:500">${c.date}</td>
      <td>${String(c.hour).padStart(2,'0')}:00</td>
      <td>${String(c.minute).padStart(2,'0')}</td>
      <td style="color:var(--bl)">${c.kwh.toFixed(4)} kWh</td>
      <td>${dirLabel}</td>
    </tr>`;
  }).join('');

  renderCvPager(cvPage, maxPage);
}

function renderCvPager(page, maxPage) {
  let el = document.getElementById('cv-pager');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cv-pager';
    el.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;padding:12px;font-size:12px;color:var(--tx2)';
    document.getElementById('cv-tbody')?.closest('.tcard')?.after(el);
  }
  if (maxPage === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="btn-s" onclick="CV.cvGoPage(0)" ${page===0?'disabled':''}>«</button>
    <button class="btn-s" onclick="CV.cvGoPage(${page-1})" ${page===0?'disabled':''}>‹ Zurück</button>
    <span>Seite ${page+1} von ${maxPage+1} &nbsp;·&nbsp; je ${CV_PAGE_SIZE} Einträge</span>
    <button class="btn-s" onclick="CV.cvGoPage(${page+1})" ${page===maxPage?'disabled':''}>Weiter ›</button>
    <button class="btn-s" onclick="CV.cvGoPage(${maxPage})" ${page===maxPage?'disabled':''}>»</button>`;
}

function cvGoPage(p) { cvPage = p; renderTable(); }

function toggleAll(cb) { document.querySelectorAll('.cv-cb').forEach(c => c.checked = cb.checked); }

function deleteSelected() {
  const sel = [...document.querySelectorAll('.cv-cb:checked')].map(c => c.dataset.id);
  if (!sel.length) { APP.toast('Keine Zeilen ausgewählt','err'); return; }
  if (!confirm(sel.length + ' Messpunkte löschen?')) return;
  APP.setConsumption(APP.consumption.filter(c => !sel.includes(c.id)));
  APP.deleteCvIds(sel);
  APP.saveCv(false); renderTable(); APP.updateSidebar();
  APP.toast('✓ ' + sel.length + ' gelöscht');
}

// ── FILE LOAD ─────────────────────────────────────────────
function loadFile(input) {
  const file = input.files[0];
  if (!file) return;
  const info = document.getElementById('cv-file-info');
  if (info) info.textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB) — wird geladen…`;
  const reader = new FileReader();
  reader.onload = e => {
    const ta = document.getElementById('cv-csv-in');
    if (ta) ta.value = e.target.result;
    if (info) info.textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB) ✓ — bereit zum Importieren`;
  };
  reader.readAsText(file);
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
    // Skip header line
    if (line.startsWith('Export_Bezeichnung') || line.startsWith('"Export_Bezeichnung')) return;

    // Auto-detect separator per line: tab or semicolon
    const sep  = line.includes('\t') ? '\t' : ';';
    const cols = line.split(sep);
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

      // Deterministische ID aus Datum+Zeit+Richtung → verhindert Duplikate bei erneutem Import
      const idStr = `${date}_${String(hour).padStart(2,'0')}_${String(minute).padStart(2,'0')}_${dir}`;
      const idHash = idStr.split('').reduce((h,c) => (Math.imul(31,h)+c.charCodeAt(0))|0, 0);
      const id = `cv_${Math.abs(idHash).toString(36)}_${date.replace(/-/g,'')}_${String(hour).padStart(2,'0')}${String(minute).padStart(2,'0')}`;

      parsed.push({ id, date, hour, minute, kwh, direction: dir });
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

  // Reset file input
  const fi = document.getElementById('cv-file');
  if (fi) fi.value = '';
  const info = document.getElementById('cv-file-info');
  if (info) info.textContent = '';

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

  const ids  = toDelete.map(c => c.id);
  const days = new Set(toDelete.map(c => String(c.date).substring(0,10))).size;
  APP.setConsumption(APP.consumption.filter(c => {
    const d = String(c.date).substring(0,10);
    return !(d >= from && d <= to);
  }));
  APP.deleteCvIds(ids);
  APP.saveCv(false); renderOverview(); APP.updateSidebar();
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ ${toDelete.length} Messpunkte (${days} Tage) gelöscht.</span>`;
  APP.toast(`✓ ${toDelete.length} Messpunkte gelöscht`);
}

function clearAll() {
  if (!confirm('Alle Verbrauchsdaten löschen?')) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }
  const ids = APP.consumption.map(c => c.id);
  APP.setConsumption([]);
  APP.deleteCvIds(ids);
  APP.saveCv(false); renderOverview(); APP.updateSidebar();
  APP.toast('Verbrauchsdaten gelöscht');
}

// ── INIT ──────────────────────────────────────────────────
function initDefaults() {
  const today = new Date().toISOString().split('T')[0];
  const g     = id => document.getElementById(id);

  const dates    = APP.consumption.map(c => String(c.date).substring(0,10)).filter(Boolean).sort();
  const earliest = dates.length > 0 ? dates[0] : (parseInt(today.substring(0,4))-2) + '-01-01';

  if (g('cv-from'))    g('cv-from').value    = earliest;
  if (g('cv-to'))      g('cv-to').value      = today;
  if (g('pr-from'))    g('pr-from').value    = earliest;
  if (g('pr-to'))      g('pr-to').value      = today;
  if (g('cv-tf-from')) g('cv-tf-from').value = earliest;
  if (g('cv-tf-to'))   g('cv-tf-to').value   = today;

  const d30 = new Date(); d30.setDate(d30.getDate()-30);
  if (g('cv-del-from')) g('cv-del-from').value = d30.toISOString().split('T')[0];
  if (g('cv-del-to'))   g('cv-del-to').value   = today;
}

function register() {
  APP.registerPage('consumption', {
    html:    HTML,
    onEnter: () => {
      initDefaults();
      APP.FilterBar.create('cv-timeline', {
        onRange: (f, t) => {
          const fe=document.getElementById('cv-from'); if(fe) fe.value=f;
          const te=document.getElementById('cv-to');   if(te) te.value=t;
          renderOverview();
        }
      });
      renderOverview();
    }
  });
}

return { tab, resetFilter, resetProfile, renderOverview, renderProfile, renderTable,
         cvGoPage, toggleAll, loadFile, deleteSelected, importCSV, deleteRange, clearAll, register };
})();
