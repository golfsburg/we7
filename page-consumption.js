// ═══════════════════════════════════════════════════════════
// PAGE-CONSUMPTION.JS  —  Stromverbrauch
// ═══════════════════════════════════════════════════════════
const CV = (() => {
'use strict';

const HTML = `
<div class="ph"><div>
  <div class="ph-title">⚡ Stromverbrauch</div>
  <div class="ph-sub">Smart Meter · Viertelstundenwerte · EVN / Netz NÖ</div>
</div></div>

<div class="mtabs" id="cv-tabs">
  <button class="mtab active" onclick="CV.tab('overview',this)">Übersicht</button>
  <button class="mtab"        onclick="CV.tab('profile',this)">Lastprofil</button>
  <button class="mtab"        onclick="CV.tab('import',this)">Import / Löschen</button>
</div>

<!-- ── ÜBERSICHT ── -->
<div id="cv-t-overview">
  <div class="fbar">
    <label>Ansicht</label>
    <select id="cv-view" onchange="CV.renderOverview()">
      <option value="month" selected>Monatsbilanz</option>
      <option value="day">Tagesdetail</option>
    </select>
    <span class="fsep">|</span>
    <label id="cv-lbl-date">Datum</label>
    <input type="date"  id="cv-date"  style="display:none"  onchange="CV.renderOverview()">
    <label id="cv-lbl-month">Monat</label>
    <input type="month" id="cv-month" onchange="CV.renderOverview()">
    <button class="btn-p" onclick="CV.renderOverview()">Anzeigen</button>
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
        <div class="li"><span class="ld" style="background:#f5c842"></span>PV Ertrag</div>
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

<!-- ── LASTPROFIL ── -->
<div id="cv-t-profile" style="display:none">
  <div class="fbar">
    <label>Monat</label>
    <input type="month" id="cv-pm" onchange="CV.renderProfile()">
    <button class="btn-p" onclick="CV.renderProfile()">Anzeigen</button>
  </div>
  <div class="metrics">
    <div class="mc"><div class="mc-l">Ø Tagesverbrauch</div><div><span class="mc-v" id="pr-avg">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Spitzenstunde</div><div><span class="mc-v" id="pr-peak">—</span><span class="mc-u">Uhr</span></div></div>
    <div class="mc"><div class="mc-l">Tage erfasst</div><div><span class="mc-v" id="pr-days">—</span></div></div>
    <div class="mc"><div class="mc-l">Messpunkte</div><div><span class="mc-v" id="pr-pts">—</span></div></div>
  </div>
  <div class="cc full">
    <div class="cc-title">Ø Lastprofil</div>
    <div class="cc-sub">Durchschnittlicher Stundenwert — 🔴 Spitze · 🟡 hoch · 🔵 normal</div>
    <div class="cw" style="height:240px"><canvas id="cv-c-profile"></canvas></div>
  </div>
</div>

<!-- ── IMPORT / LÖSCHEN ── -->
<div id="cv-t-import" style="display:none">
  <div class="fcard">
    <div class="fcard-t">📥 Smart Meter Import (EVN / Netz NÖ)</div>
    <p style="font-size:13px;color:var(--tx2);margin-bottom:8px">
      Export unter <strong>meinestrom.at</strong> → Verbrauch → Viertelstundenwerte → CSV → hier einfügen.
    </p>
    <div class="note" style="margin-bottom:12px">
      📋 Semikolon-getrennt · Spalte 7 = Von-Zeit (DD.MM.YYYY HH:MM:SS) · Spalte 15 = kWh-Wert · <strong>Lieferung</strong> = Netzbezug
    </div>
    <textarea class="csv-area" id="cv-csv-in"
      placeholder='Export_Bezeichnung;...;Von;Zeitzone;...;Wert;Einheit&#10;"2026-04";...;01.04.2026 00:00:00;MESZ;...;0,069000;kWh;gemessen;'></textarea>
    <div class="brow">
      <button class="btn-p" onclick="CV.importSmartMeter(false)">Importieren (neu hinzufügen)</button>
      <button class="btn-s" onclick="CV.importSmartMeter(true)">↺ Neu importieren (überschreiben)</button>
    </div>
    <div id="cv-import-result" style="font-size:12px;color:var(--tx2);margin-top:10px"></div>
  </div>

  <div class="fcard" style="border-color:rgba(91,156,246,.2)">
    <div class="fcard-t" style="font-size:13px;color:var(--tx2)">🗄 Supabase Datenbank — Tabelle <code>consumption_15min</code></div>
    <div style="font-size:12px;color:var(--tx2);line-height:2;margin-bottom:10px">
      Verbrauchsdaten werden automatisch mit Supabase synchronisiert.<br>
      Falls die Tabelle noch nicht existiert, einmalig im <strong>Supabase SQL Editor</strong> ausführen:
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:11px;color:var(--tx3)">SQL</span>
      <button class="copy-btn" onclick="APP.copyCode('cv-sql')">Kopieren</button>
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
    <div class="fcard-t" style="color:var(--rd)">⚠ Verbrauchsdaten löschen</div>
    <div style="margin-bottom:14px">
      <p style="font-size:12px;color:var(--tx2);margin-bottom:10px">Zeitraum auswählen und Messpunkte in diesem Bereich löschen:</p>
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

// ── TAB ───────────────────────────────────────────────────
function tab(name, btn) {
  ['overview','profile','import'].forEach(t => {
    const el = document.getElementById('cv-t-' + t);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('#cv-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name === 'overview') renderOverview();
  if (name === 'profile')  renderProfile();
}

// ── VIEW TOGGLE ───────────────────────────────────────────
function applyViewToggle(view) {
  const isDay = view === 'day';
  const dEl  = document.getElementById('cv-date');
  const mEl  = document.getElementById('cv-month');
  const dLbl = document.getElementById('cv-lbl-date');
  const mLbl = document.getElementById('cv-lbl-month');
  if (dEl)  dEl.style.display  = isDay ? 'inline' : 'none';
  if (mEl)  mEl.style.display  = isDay ? 'none'   : 'inline';
  if (dLbl) dLbl.style.display = isDay ? 'inline' : 'none';
  if (mLbl) mLbl.style.display = isDay ? 'none'   : 'inline';
}
function setupViewToggle() {
  const sel = document.getElementById('cv-view'); if (!sel) return;
  // Apply immediately for current value
  applyViewToggle(sel.value);
  sel.addEventListener('change', function() { applyViewToggle(this.value); });
}

// ── METRICS HELPER ────────────────────────────────────────
function setMetrics(grid, pv, direct) {
  const total   = grid + direct;
  const autarky = total > 0 ? Math.round(direct/total*100) : 0;
  const selfUse = pv    > 0 ? Math.round(direct/pv*100)   : 0;
  const saving  = direct * APP.cfg.price;
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('cv-m-grid',    grid.toFixed(2));
  set('cv-m-pv',      pv.toFixed(2));
  set('cv-m-total',   total.toFixed(2));
  set('cv-m-autarky', autarky||'—');
  set('cv-m-self',    selfUse||'—');
  set('cv-m-saving',  saving.toFixed(2));
  set('cv-m-saving2', direct.toFixed(2) + ' kWh direkt genutzt');
  set('cv-m-grid2',   '');
  const auEl = document.getElementById('cv-m-autarky2');
  if (auEl) {
    auEl.textContent = autarky>=50?'✓ Gut':autarky>=25?'~ Mittel':pv>0?'⚠ Niedrig':'Keine PV-Daten';
    auEl.className   = 'mc-d' + (autarky>=50?' pos':autarky>=25?'':' neg');
  }
}

// ── OVERVIEW ─────────────────────────────────────────────
function renderOverview() {
  const view  = document.getElementById('cv-view')?.value || 'month';
  const date  = document.getElementById('cv-date')?.value || new Date().toISOString().split('T')[0];
  const ym    = document.getElementById('cv-month')?.value || new Date().toISOString().substring(0,7);
  if (view === 'day') renderDay(date);
  else renderMonth(ym);
}

function renderDay(date) {
  const t = document.getElementById('cv-chart-title'); if(t) t.textContent = 'Stundenverlauf — ' + date;
  const s = document.getElementById('cv-chart-sub');   if(s) s.textContent = 'kWh pro Stunde';

  const gridH = Array(24).fill(0);
  APP.consumption
    .filter(c => String(c.date).substring(0,10) === date && c.direction === 'grid')
    .forEach(c => { gridH[parseInt(c.hour, 10)] += parseFloat(c.kwh); });

  const pvDay = APP.getDayPv(date);
  const pvH   = Array(24).fill(0);
  if (pvDay > 0) {
    const w  = [0,0,0,0,0,0,.01,.03,.07,.10,.13,.14,.14,.13,.10,.08,.06,.04,.02,.01,0,0,0,0];
    const ws = w.reduce((a,b) => a+b, 0);
    w.forEach((v,i) => { pvH[i] = pvDay * (v/ws); });
  }
  const directH = Array.from({length:24}, (_,i) => Math.min(pvH[i], gridH[i]+pvH[i]));
  const labels  = Array.from({length:24}, (_,i) => String(i).padStart(2,'0')+':00');

  setMetrics(gridH.reduce((a,b)=>a+b,0), pvDay, directH.reduce((a,b)=>a+b,0));
  drawCharts(labels,
    gridH.map(v  => +v.toFixed(3)),
    directH.map(v => +v.toFixed(3)),
    pvH.map(v    => +v.toFixed(3)),
    null, pvDay, gridH.reduce((a,b)=>a+b,0));
}

function renderMonth(ym) {
  const t = document.getElementById('cv-chart-title'); if(t) t.textContent = 'Tageswerte — ' + ym;
  const s = document.getElementById('cv-chart-sub');   if(s) s.textContent = 'kWh pro Tag';

  const [yr, mo] = ym.split('-').map(Number);
  const daysInM  = new Date(yr, mo, 0).getDate();
  const dates    = Array.from({length:daysInM},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`);
  const labels   = dates.map(d=>d.slice(8));
  const gridArr  = dates.map(d => +APP.getDayGrid(d).toFixed(3));
  const pvArr    = dates.map(d => +APP.getDayPv(d).toFixed(3));
  const directArr= dates.map((_,i) => +Math.min(pvArr[i], gridArr[i]+pvArr[i]).toFixed(3));
  const autarkyArr = dates.map((_,i) => {
    const tot = gridArr[i]+directArr[i]; return tot>0?Math.round(directArr[i]/tot*100):0;
  });

  setMetrics(gridArr.reduce((a,b)=>a+b,0), pvArr.reduce((a,b)=>a+b,0), directArr.reduce((a,b)=>a+b,0));
  drawCharts(labels, gridArr, directArr, pvArr, autarkyArr,
    pvArr.reduce((a,b)=>a+b,0), gridArr.reduce((a,b)=>a+b,0));
}

function drawCharts(labels, gridArr, directArr, pvArr, autarkyArr, pvTot, gridTot) {
  ['cv-m','cv-au','cv-dn'].forEach(id => APP.destroyChart(id));
  const directTot = directArr.reduce((a,b)=>a+b,0);
  const feedTot   = Math.max(0, pvTot - directTot);

  APP.charts['cv-m'] = new Chart(document.getElementById('cv-c-main'), {
    type:'bar',
    data:{ labels, datasets:[
      { label:'Netzbezug', data:gridArr,   backgroundColor:'rgba(91,156,246,.75)', borderRadius:3, stack:'s' },
      { label:'PV direkt', data:directArr, backgroundColor:'rgba(63,207,142,.75)', borderRadius:3, stack:'s' },
      { label:'PV Ertrag', data:pvArr, type:'line', borderColor:'#f5c842',
        backgroundColor:'transparent', fill:false, tension:0.35, pointRadius:2,
        borderWidth:2, pointBackgroundColor:'#f5c842' }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{stacked:true,ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}} } }
  });

  if (autarkyArr) {
    APP.charts['cv-au'] = new Chart(document.getElementById('cv-c-autarky'), {
      type:'line',
      data:{ labels, datasets:[{ data:autarkyArr, borderColor:'#3fcf8e',
        backgroundColor:'rgba(63,207,142,.1)', fill:true, tension:0.35, pointRadius:2, borderWidth:1.5 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
                 y:{min:0,max:100,ticks:{color:APP.TC,font:{size:10},callback:v=>v+'%'},grid:{color:APP.GC}} } }
    });
  } else {
    APP.charts['cv-au'] = new Chart(document.getElementById('cv-c-autarky'), {
      type:'doughnut',
      data:{ labels:['PV gedeckt','Netzbezug'], datasets:[{
        data:[+directTot.toFixed(2), +gridTot.toFixed(2)],
        backgroundColor:['#3fcf8e','rgba(91,156,246,.6)'], borderWidth:0 }] },
      options:{ responsive:true, maintainAspectRatio:false, cutout:'65%',
        plugins:{ legend:{ labels:{ color:APP.TC, font:{size:11} } } } }
    });
  }

  APP.charts['cv-dn'] = new Chart(document.getElementById('cv-c-donut'), {
    type:'doughnut',
    data:{ labels:['Netzbezug','PV Eigenverbrauch','PV Einspeisung'],
      datasets:[{ data:[+gridTot.toFixed(2),+directTot.toFixed(2),+feedTot.toFixed(2)],
        backgroundColor:['rgba(91,156,246,.75)','rgba(63,207,142,.75)','rgba(245,200,66,.65)'],
        borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{ legend:{ labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } },
        tooltip:{ callbacks:{ label:ctx=>ctx.parsed.toFixed(2)+' kWh' } } } }
  });
}

// ── LASTPROFIL ───────────────────────────────────────────
function renderProfile() {
  const ym = document.getElementById('cv-pm')?.value || new Date().toISOString().substring(0,7);

  // Normalize date: always take first 10 chars (handles ISO strings, date objects, etc.)
  const normalize = c => ({
    ...c,
    date:   String(c.date).substring(0, 10),
    hour:   parseInt(c.hour,   10),
    minute: parseInt(c.minute, 10),
    kwh:    parseFloat(c.kwh)
  });

  const data = APP.consumption
    .map(normalize)
    .filter(c => c.date.startsWith(ym) && c.direction === 'grid');

  // hourlyPerDay[date][hour] = sum kWh for that hour on that day
  const hourlyPerDay = {};
  data.forEach(c => {
    const h = c.hour;          // already int from normalize
    const d = c.date;          // already YYYY-MM-DD from normalize
    if (!hourlyPerDay[d]) hourlyPerDay[d] = Array(24).fill(0);
    hourlyPerDay[d][h] += c.kwh;
  });

  const dayList = Object.keys(hourlyPerDay);
  const nDays   = dayList.length || 1;

  // Sum hourly totals across all days, then divide by nDays = average per day per hour
  const hourly = Array(24).fill(0);
  dayList.forEach(d => {
    hourlyPerDay[d].forEach((v, h) => { hourly[h] += v; });
  });
  hourly.forEach((_, i) => { hourly[i] = +(hourly[i] / nDays).toFixed(4); });

  const dayTotal = +(hourly.reduce((a,b) => a+b, 0)).toFixed(2);
  const maxV     = Math.max(...hourly.filter(v => v > 0), 0);
  const peakH    = maxV > 0 ? hourly.indexOf(maxV) : 0;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('pr-avg',  dayTotal);
  set('pr-peak', String(peakH).padStart(2,'0') + ':00');
  set('pr-days', nDays);
  set('pr-pts',  data.length);

  const labels = Array.from({length:24}, (_,i) => String(i).padStart(2,'0')+':00');
  const bg = hourly.map(v =>
    v > 0 && v === maxV    ? 'rgba(242,92,92,.7)'  :
    v > 0 && v > maxV * .7 ? 'rgba(245,200,66,.6)' :
                              'rgba(91,156,246,.65)');

  APP.destroyChart('cv-prof');
  APP.charts['cv-prof'] = new Chart(document.getElementById('cv-c-profile'), {
    type: 'bar',
    data: { labels, datasets: [{ data: hourly, backgroundColor: bg, borderRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y.toFixed(4) + ' kWh' } }
      },
      scales: {
        x: { ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC} },
        y: { ticks:{color:APP.TC, font:{size:10}}, grid:{color:APP.GC},
             title:{display:true, text:'kWh/h', color:APP.TC, font:{size:10}} }
      }
    }
  });
}

// ── SMART METER IMPORT ────────────────────────────────────
function importSmartMeter(overwrite = false) {
  const raw = document.getElementById('cv-csv-in')?.value.trim();
  const resEl = document.getElementById('cv-import-result');
  if (!raw) { APP.toast('Kein CSV eingefügt','err'); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let skipped = 0;
  const newE = [];

  lines.forEach(line => {
    // Skip header line
    if (line.startsWith('Export_Bezeichnung') || line.startsWith('"Export')) { skipped++; return; }
    const cols = line.split(';');
    if (cols.length < 15) { skipped++; return; }
    try {
      const direction = cols[5]?.trim();
      const vonRaw    = cols[6]?.trim();
      const wertRaw   = cols[14]?.trim().replace(',', '.');
      const kwh = parseFloat(wertRaw);
      if (isNaN(kwh) || !vonRaw) { skipped++; return; }

      const [datePart, timePart] = vonRaw.split(' ');
      const [d, m, y] = datePart.split('.');
      const date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; return; }

      const [hh, mm] = (timePart || '00:00:00').split(':');
      const hour   = parseInt(hh, 10);
      const minute = parseInt(mm, 10);
      const dir    = direction?.toLowerCase().includes('einspeisung') ? 'feed' : 'grid';

      newE.push({ id: APP.genId(), date, hour, minute, kwh, direction: dir });
    } catch(e) { skipped++; }
  });

  if (!newE.length) {
    if (resEl) resEl.innerHTML = `<span style="color:var(--rd)">Keine gültigen Zeilen gefunden. Format prüfen.</span>`;
    APP.toast('Import fehlgeschlagen','err');
    return;
  }

  const importDates = new Set(newE.map(e => e.date));
  let base;

  if (overwrite) {
    // Remove all existing entries for the dates in this import, then add new
    base = APP.consumption.filter(c => !importDates.has(c.date));
  } else {
    // Only add entries not already present (by date+hour+minute+direction)
    // Normalize existing hours to integers for reliable comparison
    const existingNorm = APP.consumption.map(c => ({
      ...c, hour: parseInt(c.hour, 10), minute: parseInt(c.minute, 10), kwh: parseFloat(c.kwh)
    }));
    const existingKeys = new Set(existingNorm.map(c => `${c.date}|${c.hour}|${c.minute}|${c.direction}`));
    const fresh = newE.filter(e => !existingKeys.has(`${e.date}|${e.hour}|${e.minute}|${e.direction}`));
    if (fresh.length === 0) {
      if (resEl) resEl.innerHTML = `<span style="color:var(--ac)">⚠ Alle ${newE.length} Einträge bereits vorhanden. Verwende "↺ Neu importieren (überschreiben)" um sie zu ersetzen.</span>`;
      return;
    }
    base = existingNorm;
    newE.length = 0;
    fresh.forEach(e => newE.push(e));
  }

  APP.setConsumption(
    [...base, ...newE].sort((a,b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) :
      a.hour !== b.hour ? a.hour - b.hour : a.minute - b.minute
    )
  );
  APP.saveCv(); renderOverview(); APP.updateSidebar();

  const days = importDates.size;
  const msg = overwrite
    ? `✓ ${newE.length} Messpunkte für ${days} Tage neu importiert (alte Einträge ersetzt).`
    : `✓ ${newE.length} neue Messpunkte importiert (${days} Tage)${skipped > 0 ? ' · ' + skipped + ' übersprungen' : ''}.`;
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">${msg}</span>`;
  APP.toast(`✓ ${newE.length} Messpunkte importiert`);
}

function clearAll() {
  if (!confirm('Alle Verbrauchsdaten löschen?')) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }
  APP.setConsumption([]);
  APP.saveCv(); renderOverview(); APP.updateSidebar();
  APP.toast('Verbrauchsdaten gelöscht');
}

function deleteRange() {
  const from  = document.getElementById('cv-del-from')?.value;
  const to    = document.getElementById('cv-del-to')?.value;
  const resEl = document.getElementById('cv-del-result');
  if (!from || !to) { APP.toast('Bitte Von und Bis Datum auswählen','err'); return; }
  if (from > to)    { APP.toast('Von muss vor Bis liegen','err'); return; }

  const toDelete = APP.consumption.filter(c => c.date >= from && c.date <= to);
  if (toDelete.length === 0) {
    if (resEl) resEl.innerHTML = `<span style="color:var(--tx2)">Keine Messpunkte in diesem Zeitraum gefunden.</span>`;
    return;
  }
  if (!confirm(`${toDelete.length} Messpunkte vom ${from} bis ${to} löschen?`)) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }

  const days = new Set(toDelete.map(c=>c.date)).size;
  APP.setConsumption(APP.consumption.filter(c => !(c.date >= from && c.date <= to)));
  APP.saveCv(); renderOverview(); APP.updateSidebar();
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ ${toDelete.length} Messpunkte (${days} Tage) gelöscht (${from} – ${to})</span>`;
  APP.toast(`✓ ${toDelete.length} Messpunkte gelöscht`);
}

// ── INIT DEFAULTS ─────────────────────────────────────────
function initDefaults() {
  const today = new Date().toISOString().split('T')[0];
  const ym = today.substring(0,7);
  const cd=document.getElementById('cv-date');  if(cd) cd.value=today;
  const cm=document.getElementById('cv-month'); if(cm) cm.value=ym;
  const cp=document.getElementById('cv-pm');    if(cp) cp.value=ym;
  // Delete-range defaults to last 30 days
  const d30=new Date(); d30.setDate(d30.getDate()-30);
  const df=document.getElementById('cv-del-from'), dt=document.getElementById('cv-del-to');
  if(df) df.value=d30.toISOString().split('T')[0]; if(dt) dt.value=today;
  setupViewToggle();
}

function register() {
  APP.registerPage('consumption', {
    html: HTML,
    onEnter: () => { initDefaults(); renderOverview(); }
  });
}

return { tab, renderOverview, renderProfile, importSmartMeter, deleteRange, clearAll, register };
})();
