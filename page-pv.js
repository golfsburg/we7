// ═══════════════════════════════════════════════════════════
// PAGE-PV.JS  —  PV Ertrag
// ═══════════════════════════════════════════════════════════
const PV = (() => {
'use strict';

const HTML = `
<div class="ph"><div>
  <div class="ph-title">☀ PV Ertrag</div>
  <div class="ph-sub">Growatt NEO 800M-X · 800 Wp</div>
</div></div>

<div class="mtabs" id="pv-tabs">
  <button class="mtab active"  onclick="PV.tab('overview',this)">Übersicht</button>
  <button class="mtab"         onclick="PV.tab('data',this)">Daten</button>
  <button class="mtab"         onclick="PV.tab('entry',this)">Eintrag</button>
  <button class="mtab"         onclick="PV.tab('import',this)">Import / Export</button>
</div>

<!-- ── ÜBERSICHT ── -->
<div id="pv-t-overview">
  <div class="fbar">
    <label>Granularität</label>
    <select id="pv-gran" onchange="PV.renderOverview()">
      <option value="day">Täglich</option>
      <option value="week">Wöchentlich</option>
      <option value="month" selected>Monatlich</option>
    </select>
    <span class="fsep">|</span>
    <label>Von</label><input type="date" id="pv-from" onchange="PV.renderOverview()">
    <label>Bis</label><input type="date" id="pv-to"   onchange="PV.renderOverview()">
    <button class="btn-p" onclick="PV.renderOverview()">Anwenden</button>
    <button class="btn-s" onclick="PV.resetFilter()">Reset</button>
  </div>
  <div class="metrics">
    <div class="mc hi"><div class="mc-l">Ertrag</div><div><span class="mc-v" id="pv-m-total">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="pv-m-total2"></div></div>
    <div class="mc"><div class="mc-l">Theoretisch</div><div><span class="mc-v" id="pv-m-th">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Performance Ratio</div><div><span class="mc-v" id="pv-m-pr">—</span><span class="mc-u">%</span></div><div class="mc-d" id="pv-m-pr2"></div></div>
    <div class="mc gr"><div class="mc-l">Ertrag €</div><div><span class="mc-v" id="pv-m-eur">—</span><span class="mc-u">€</span></div></div>
    <div class="mc"><div class="mc-l">Ø pro Tag</div><div><span class="mc-v" id="pv-m-avg">—</span><span class="mc-u">kWh</span></div></div>
    <div class="mc"><div class="mc-l">Einträge</div><div><span class="mc-v" id="pv-m-cnt">—</span></div></div>
  </div>
  <div class="cgrid">
    <div class="cc full">
      <div class="cc-title">PV Ertrag vs. Theoretisch</div>
      <div class="cc-sub" id="pv-chart-sub">kWh</div>
      <div class="leg">
        <div class="li"><span class="ld" style="background:#f5c842"></span>Tatsächlich</div>
        <div class="li"><span class="ld" style="background:#333640"></span>Theoretisch</div>
      </div>
      <div class="cw" style="height:230px"><canvas id="pv-c-main"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Performance Ratio</div>
      <div class="cc-sub">% Effizienz</div>
      <div class="cw" style="height:185px"><canvas id="pv-c-pr"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Kumulierter Ertrag</div>
      <div class="cc-sub">kWh aufgelaufen</div>
      <div class="cw" style="height:185px"><canvas id="pv-c-cum"></canvas></div>
    </div>
  </div>
</div>

<!-- ── DATEN ── -->
<div id="pv-t-data" style="display:none">
  <div class="fbar">
    <label>Typ</label>
    <select id="pv-tf-type" onchange="PV.renderTable()">
      <option value="all">Alle</option><option value="day">Tag</option>
      <option value="week">Woche</option><option value="month">Monat</option>
    </select>
    <span class="fsep">|</span>
    <label>Von</label><input type="date" id="pv-tf-from" onchange="PV.renderTable()">
    <label>Bis</label><input type="date" id="pv-tf-to"   onchange="PV.renderTable()">
    <label>Sort</label>
    <select id="pv-tf-sort" onchange="PV.renderTable()">
      <option value="date-desc">Datum ↓</option>
      <option value="date-asc">Datum ↑</option>
      <option value="kwh-desc">kWh ↓</option>
      <option value="pr-desc">PR% ↓</option>
    </select>
    <button class="btn-s btn-d" onclick="PV.deleteSelected()">Auswahl löschen</button>
  </div>
  <div class="tcard">
    <div class="thead"><div class="thead-t" id="pv-tcount">—</div></div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th><input type="checkbox" id="pv-cb-all" onchange="PV.toggleAll(this)"></th>
          <th>Datum</th><th>Typ</th><th>Ertrag</th><th>Theor.</th><th>PR%</th>
          <th>Peak W</th><th>Std</th><th>Wetter</th><th>€</th><th>Notiz</th>
          <th style="text-align:center">Aktionen</th>
        </tr></thead>
        <tbody id="pv-tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- ── EINTRAG ── -->
<div id="pv-t-entry" style="display:none">
  <div class="mtabs" id="entry-type-tabs">
    <button class="mtab active" onclick="PV.setEntryMode('day',this)">Täglich</button>
    <button class="mtab"        onclick="PV.setEntryMode('week',this)">Wöchentlich</button>
    <button class="mtab"        onclick="PV.setEntryMode('month',this)">Monatlich</button>
  </div>
  <div id="e-form-day" class="fcard">
    <div class="fcard-t">📅 Tageseintrag</div>
    <div class="fgrid">
      <div class="field"><label>Datum</label><input type="date" id="e-date"></div>
      <div class="field"><label>Ertrag (kWh)</label><input type="number" id="e-kwh" placeholder="z.B. 4.2" step="0.01" min="0"></div>
      <div class="field"><label>Spitzenleistung (W)</label><input type="number" id="e-peak" step="1"></div>
      <div class="field"><label>Betriebsstunden</label><input type="number" id="e-hours" step="0.1"></div>
      <div class="field"><label>Eigenstrom (kWh)</label><input type="number" id="e-self" step="0.01"></div>
      <div class="field"><label>Einspeisung (kWh)</label><input type="number" id="e-feed" step="0.01"></div>
      <div class="field"><label>Wetter</label>
        <select id="e-weather">
          <option value="☀️">☀️ Sonnig</option><option value="🌤️">🌤️ Meist sonnig</option>
          <option value="⛅">⛅ Wechselhaft</option><option value="☁️">☁️ Bewölkt</option>
          <option value="🌧️">🌧️ Regen</option><option value="🌨️">🌨️ Schnee</option>
        </select>
      </div>
      <div class="field"><label>Temp. (°C)</label><input type="number" id="e-temp" step="1"></div>
      <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="e-note"></div>
    </div>
    <div class="brow">
      <button class="btn-p" onclick="PV.addDay()">Speichern</button>
      <button class="btn-s" onclick="PV.prefillToday()">Heute vorausfüllen</button>
    </div>
  </div>
  <div id="e-form-week" class="fcard" style="display:none">
    <div class="fcard-t">📆 Wocheneintrag</div>
    <div class="fgrid">
      <div class="field"><label>Woche startet (Mo)</label><input type="date" id="w-date"></div>
      <div class="field"><label>Ertrag (kWh)</label><input type="number" id="w-kwh" step="0.01"></div>
      <div class="field"><label>KW</label><input type="number" id="w-kw" step="1" min="1" max="53"></div>
      <div class="field"><label>Wetter Ø</label>
        <select id="w-weather"><option value="☀️">☀️</option><option value="⛅">⛅</option><option value="☁️">☁️</option><option value="🌧️">🌧️</option></select>
      </div>
      <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="w-note"></div>
    </div>
    <button class="btn-p" onclick="PV.addWeek()">Woche speichern</button>
  </div>
  <div id="e-form-month" class="fcard" style="display:none">
    <div class="fcard-t">📊 Monatseintrag</div>
    <div class="fgrid">
      <div class="field"><label>Monat</label>
        <select id="mo-month"><option value="0">Jänner</option><option value="1">Februar</option><option value="2">März</option><option value="3">April</option><option value="4">Mai</option><option value="5">Juni</option><option value="6">Juli</option><option value="7">August</option><option value="8">September</option><option value="9">Oktober</option><option value="10">November</option><option value="11">Dezember</option></select>
      </div>
      <div class="field"><label>Jahr</label><input type="number" id="mo-year" value="2025"></div>
      <div class="field"><label>Ertrag (kWh)</label><input type="number" id="mo-kwh" step="0.1"></div>
      <div class="field"><label>Eigenstrom</label><input type="number" id="mo-self" step="0.1"></div>
      <div class="field"><label>Einspeisung</label><input type="number" id="mo-feed" step="0.1"></div>
      <div class="field"><label>Wetter</label>
        <select id="mo-weather"><option value="☀️">☀️ Gut</option><option value="⛅">⛅ Mittel</option><option value="☁️">☁️ Schlecht</option></select>
      </div>
      <div class="field" style="grid-column:1/-1"><label>Notiz</label><input type="text" id="mo-note"></div>
    </div>
    <button class="btn-p" onclick="PV.addMonth()">Monat speichern</button>
  </div>
  <div class="note">💡 Growatt ShinePhone → Anlage → Energie → Export → CSV — dann im Tab "Import / Export" einspielen.</div>
</div>

<!-- ── IMPORT / EXPORT ── -->
<div id="pv-t-import" style="display:none">
  <div class="fcard">
    <div class="fcard-t">☀️ Growatt ShinePhone Import</div>
    <p style="font-size:13px;color:var(--tx2);margin-bottom:8px">ShinePhone → Anlage → Energie → Export → CSV → hier einfügen.</p>
    <div class="note" style="margin-bottom:12px">📋 Spalten: <code>Date, E-Today(kWh), E-Total(kWh), Pac(W), Temp(℃)</code></div>
    <textarea class="csv-area" id="gr-csv" placeholder="Date,Time,Pac(W),E-Today(kWh),E-Total(kWh)&#10;2025-06-01,12:00:00,748,4.21,130.60"></textarea>
    <div class="brow">
      <button class="btn-p" onclick="PV.importGrowatt()">Growatt CSV importieren</button>
      <button class="btn-s" onclick="PV.loadGrowattSample()">Beispiel laden</button>
    </div>
    <div id="gr-result" style="font-size:12px;color:var(--tx2);margin-top:10px"></div>
  </div>
  <div class="fcard">
    <div class="fcard-t">
      <span>📝 Manuelles CSV</span>
      <button onclick="PV.toggleManual()" id="pv-manual-btn" class="btn-s" style="font-size:11px;padding:4px 10px">Einblenden</button>
    </div>
    <div id="pv-manual-body" style="display:none;margin-top:12px">
      <p style="font-size:12px;color:var(--tx2);margin-bottom:8px">Format: <code>Typ(day/week/month),Datum(YYYY-MM-DD),kWh[,PeakW,Std,Eigenstrom,Einspeisung,Wetter,Temp,Notiz]</code></p>
      <textarea class="csv-area" id="pv-manual-csv" placeholder="day,2025-06-01,4.21,720,6.5,2.1,2.1,☀️,22,Erster Tag"></textarea>
      <div class="brow">
        <button class="btn-p" onclick="PV.importManual()">Importieren</button>
        <button class="btn-s" onclick="PV.loadManualSample()">Beispiel laden</button>
      </div>
    </div>
  </div>
  <div class="fcard">
    <div class="fcard-t">↓ CSV Export</div>
    <div class="fgrid" style="grid-template-columns:1fr 1fr 1fr">
      <div class="field"><label>Typ</label>
        <select id="ex-type"><option value="all">Alle</option><option value="day">Täglich</option><option value="week">Wöchentlich</option><option value="month">Monatlich</option></select>
      </div>
      <div class="field"><label>Von</label><input type="date" id="ex-from"></div>
      <div class="field"><label>Bis</label><input type="date" id="ex-to"></div>
    </div>
    <button class="btn-p" onclick="PV.exportCsv()">Als CSV exportieren</button>
  </div>
  <div class="fcard" style="border-color:rgba(242,92,92,.2)">
    <div class="fcard-t" style="color:var(--rd)">⚠ PV-Daten löschen</div>
    <button class="btn-s btn-d" onclick="PV.clearAll()">Alle PV-Daten löschen</button>
  </div>
</div>
`;

// ── TAB SWITCHING ────────────────────────────────────────
function tab(name, btn) {
  ['overview','data','entry','import'].forEach(t => {
    const el = document.getElementById('pv-t-' + t);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('#pv-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (name === 'overview') renderOverview();
  if (name === 'data') renderTable();
}
function setEntryMode(mode, btn) {
  ['day','week','month'].forEach(m => {
    const el = document.getElementById('e-form-' + m);
    if (el) el.style.display = m === mode ? 'block' : 'none';
  });
  document.querySelectorAll('#entry-type-tabs .mtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── OVERVIEW ─────────────────────────────────────────────
function resetFilter() {
  const yr = new Date().getFullYear(), today = new Date().toISOString().split('T')[0];
  const f = document.getElementById('pv-from'), t = document.getElementById('pv-to');
  if (f) f.value = yr + '-01-01';
  if (t) t.value = today;
  const g = document.getElementById('pv-gran'); if (g) g.value = 'month';
  renderOverview();
}
function renderOverview() {
  const gran = document.getElementById('pv-gran')?.value || 'month';
  const from = document.getElementById('pv-from')?.value;
  const to   = document.getElementById('pv-to')?.value;
  let filtered = APP.entries.filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a,b) => a.date.localeCompare(b.date));

  const map = {};
  filtered.forEach(e => {
    let key;
    const d = new Date(e.date);
    if (gran==='day') key = e.date;
    else if (gran==='week') { const w = APP.getWeekNum(d); key = d.getFullYear() + '-W' + String(w).padStart(2,'0'); }
    else key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    if (!map[key]) map[key] = { key, kwh:0, theory:0, count:0 };
    map[key].kwh += e.kwh; map[key].theory += APP.getTheory(e); map[key].count++;
  });
  const bk = Object.values(map).sort((a,b) => a.key.localeCompare(b.key));
  const labels  = bk.map(b => b.key);
  const actArr  = bk.map(b => +b.kwh.toFixed(2));
  const thArr   = bk.map(b => +b.theory.toFixed(2));
  const prArr   = bk.map(b => b.theory > 0 ? Math.round(b.kwh/b.theory*100) : 0);
  const cumArr  = actArr.reduce((acc,v,i) => [...acc, (acc[i-1]||0)+v], []);
  const totAct  = actArr.reduce((a,b) => a+b, 0);
  const totTh   = thArr.reduce((a,b) => a+b, 0);
  const avgPr   = totTh > 0 ? Math.round(totAct/totTh*100) : 0;
  const totEur  = filtered.reduce((s,e) => s + APP.calcEuro(e), 0);
  const dE      = filtered.filter(e => e.type==='day');
  const avgDay  = dE.length > 0 ? dE.reduce((s,e) => s+e.kwh, 0) / dE.length : 0;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('pv-m-total', totAct.toFixed(2)); set('pv-m-total2', filtered.length + ' Einträge');
  set('pv-m-th', totTh.toFixed(2));    set('pv-m-pr', avgPr||'—');
  set('pv-m-eur', totEur.toFixed(2));  set('pv-m-avg', avgDay>0?avgDay.toFixed(2):'—');
  set('pv-m-cnt', filtered.length);
  set('pv-m-pr2', avgPr>=80?'✓ Gut':avgPr>=60?'~ Mittel':avgPr>0?'⚠ Niedrig':'—');
  set('pv-chart-sub', bk.length + ' ' + {day:'Tage',week:'Wochen',month:'Monate'}[gran]);
  const el = document.getElementById('pv-m-pr2');
  if (el) el.className = 'mc-d' + (avgPr>=80?' pos':avgPr>=60?'':' neg');

  ['pv-m','pv-pr','pv-cu'].forEach(id => APP.destroyChart(id));
  const opts = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
    scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
             y:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}} } };

  APP.charts['pv-m'] = new Chart(document.getElementById('pv-c-main'), {
    type:'bar', data:{ labels, datasets:[
      { label:'Tatsächlich', data:actArr, backgroundColor:'rgba(245,200,66,.85)', borderRadius:3 },
      { label:'Theoretisch', data:thArr,  backgroundColor:'rgba(58,61,69,.8)',    borderRadius:3 }
    ]}, options: opts });

  APP.charts['pv-pr'] = new Chart(document.getElementById('pv-c-pr'), {
    type:'line', data:{ labels, datasets:[{ data:prArr, borderColor:'#3fcf8e',
      backgroundColor:'rgba(63,207,142,.1)', fill:true, tension:0.35, pointRadius:3,
      borderWidth:1.5, pointBackgroundColor:'#3fcf8e' }] },
    options:{ ...opts, scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
      y:{ticks:{color:APP.TC,font:{size:10},callback:v=>v+'%'},grid:{color:APP.GC}} } } });

  APP.charts['pv-cu'] = new Chart(document.getElementById('pv-c-cum'), {
    type:'line', data:{ labels, datasets:[{ data:cumArr, borderColor:'#5b9cf6',
      backgroundColor:'rgba(91,156,246,.08)', fill:true, tension:0.3, pointRadius:2, borderWidth:1.5 }] },
    options: opts });
}

// ── TABLE ────────────────────────────────────────────────
function renderTable() {
  const type = document.getElementById('pv-tf-type')?.value || 'all';
  const from = document.getElementById('pv-tf-from')?.value;
  const to   = document.getElementById('pv-tf-to')?.value;
  const sort = document.getElementById('pv-tf-sort')?.value || 'date-desc';
  let data = [...APP.entries];
  if (type !== 'all') data = data.filter(e => e.type === type);
  if (from) data = data.filter(e => e.date >= from);
  if (to)   data = data.filter(e => e.date <= to);
  if (sort==='date-desc') data.sort((a,b) => b.date.localeCompare(a.date));
  else if (sort==='date-asc') data.sort((a,b) => a.date.localeCompare(b.date));
  else if (sort==='kwh-desc') data.sort((a,b) => b.kwh - a.kwh);
  else data.sort((a,b) => { const pa=APP.getTheory(a)>0?a.kwh/APP.getTheory(a):0; const pb=APP.getTheory(b)>0?b.kwh/APP.getTheory(b):0; return pb-pa; });

  const cnt = document.getElementById('pv-tcount'); if (cnt) cnt.textContent = data.length + ' Einträge';
  const tbody = document.getElementById('pv-tbody'); if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:2rem;color:var(--tx3)">Keine Einträge</td></tr>';
    return;
  }
  const MONTHS_FULL = APP.MONTHS_FULL;
  tbody.innerHTML = data.map(e => {
    const th = APP.getTheory(e), pr = th > 0 ? Math.round(e.kwh/th*100) : 0;
    const cls = pr>=80?'good':pr>=60?'mid':'low';
    const lbl = e.type==='day' ? e.date
      : e.type==='week' ? 'KW'+(e.kw||'?')+' '+e.date.substring(0,4)
      : MONTHS_FULL[new Date(e.date).getMonth()]+' '+e.date.substring(0,4);
    const tl = e.type==='day'?'Tag':e.type==='week'?'Woche':'Monat';
    return `<tr>
      <td><input type="checkbox" class="pv-cb" data-id="${e.id}"></td>
      <td style="font-weight:500">${lbl}</td>
      <td><span class="badge ${cls}" style="font-size:9px">${tl}</span></td>
      <td style="color:var(--ac)">${e.kwh.toFixed(2)} kWh</td>
      <td style="color:var(--tx3)">${th.toFixed(2)}</td>
      <td><span class="ebar"><span class="efill" style="width:${Math.min(pr,100)}%;background:${pr>=80?'var(--gr)':pr>=60?'var(--ac)':'var(--rd)'}"></span></span><span class="badge ${cls}">${pr}%</span></td>
      <td style="color:var(--tx2)">${e.peak||'—'}</td>
      <td style="color:var(--tx2)">${e.hours||'—'}</td>
      <td>${e.weather||'—'}</td>
      <td style="color:var(--gr)">${APP.calcEuro(e)} €</td>
      <td style="color:var(--tx3);font-size:11px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.note||''}</td>
      <td style="text-align:center;white-space:nowrap">
        <button onclick="APP.openModal('${e.id}')" style="background:transparent;border:1px solid rgba(91,156,246,.4);color:var(--bl);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:3px">✏</button>
        <button onclick="PV.copyEntry('${e.id}')" style="background:transparent;border:1px solid rgba(245,200,66,.4);color:var(--ac);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:3px">⧉</button>
        <button onclick="PV.deleteSingle('${e.id}')" style="background:transparent;border:1px solid rgba(242,92,92,.4);color:var(--rd);border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer">✕</button>
      </td>
    </tr>`;
  }).join('');
}
function toggleAll(cb) { document.querySelectorAll('.pv-cb').forEach(c => c.checked = cb.checked); }
function deleteSelected() {
  const sel = [...document.querySelectorAll('.pv-cb:checked')].map(c => c.dataset.id);
  if (!sel.length) { APP.toast('Keine Zeilen ausgewählt','err'); return; }
  if (!confirm(sel.length + ' Einträge löschen?')) return;
  APP.setEntries(APP.entries.filter(e => !sel.includes(e.id)));
  APP.savePv(); renderTable(); renderOverview(); APP.updateSidebar();
  APP.toast('✓ ' + sel.length + ' gelöscht');
}
function deleteSingle(id) {
  const e = APP.entries.find(x=>x.id===id); if (!e) return;
  if (!confirm('"'+e.date+'" löschen?')) return;
  APP.setEntries(APP.entries.filter(x => x.id !== id));
  APP.savePv(); renderTable(); renderOverview(); APP.updateSidebar();
  APP.toast('✓ gelöscht');
}
function copyEntry(id) {
  const e = APP.entries.find(x=>x.id===id); if (!e) return;
  const c = JSON.parse(JSON.stringify(e)); c.id = APP.genId();
  c.note = (c.note||'') + ' (Kopie)';
  if (c.type==='day') { const d=new Date(c.date); d.setDate(d.getDate()+1); c.date=d.toISOString().split('T')[0]; }
  APP.entries.push(c);
  APP.entries.sort((a,b) => a.date.localeCompare(b.date));
  APP.savePv(); renderTable(); APP.toast('✓ kopiert');
}

// ── ENTRY ────────────────────────────────────────────────
function prefillToday() {
  const el = document.getElementById('e-date'); if (el) el.value = new Date().toISOString().split('T')[0];
}
function addDay() {
  const date = document.getElementById('e-date')?.value;
  const kwh  = parseFloat(document.getElementById('e-kwh')?.value);
  if (!date || isNaN(kwh)) { APP.toast('Datum und kWh sind Pflichtfelder','err'); return; }
  APP.setEntries(APP.entries.filter(e => !(e.type==='day' && e.date===date)));
  APP.entries.push({ id:APP.genId(), type:'day', date, kwh,
    peak:   parseFloat(document.getElementById('e-peak')?.value)||null,
    hours:  parseFloat(document.getElementById('e-hours')?.value)||null,
    self:   parseFloat(document.getElementById('e-self')?.value)||null,
    feed:   parseFloat(document.getElementById('e-feed')?.value)||null,
    weather:document.getElementById('e-weather')?.value,
    temp:   parseFloat(document.getElementById('e-temp')?.value)||null,
    note:   document.getElementById('e-note')?.value||'', source:'manual' });
  APP.savePv(); APP.updateSidebar();
  APP.toast('✓ Tag: ' + kwh.toFixed(2) + ' kWh');
  ['e-kwh','e-peak','e-hours','e-self','e-feed','e-note'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value='';
  });
}
function addWeek() {
  const date = document.getElementById('w-date')?.value;
  const kwh  = parseFloat(document.getElementById('w-kwh')?.value);
  if (!date || isNaN(kwh)) { APP.toast('Pflichtfelder fehlen','err'); return; }
  APP.setEntries(APP.entries.filter(e => !(e.type==='week' && e.date===date)));
  APP.entries.push({ id:APP.genId(), type:'week', date, kwh,
    kw:parseInt(document.getElementById('w-kw')?.value)||null,
    weather:document.getElementById('w-weather')?.value,
    note:document.getElementById('w-note')?.value||'', source:'manual' });
  APP.savePv(); APP.updateSidebar(); APP.toast('✓ Woche gespeichert');
  const el = document.getElementById('w-kwh'); if (el) el.value='';
}
function addMonth() {
  const m   = parseInt(document.getElementById('mo-month')?.value);
  const y   = parseInt(document.getElementById('mo-year')?.value);
  const kwh = parseFloat(document.getElementById('mo-kwh')?.value);
  if (isNaN(kwh)) { APP.toast('kWh Pflichtfeld','err'); return; }
  const date = y + '-' + String(m+1).padStart(2,'0') + '-01';
  APP.setEntries(APP.entries.filter(e => !(e.type==='month' && e.date===date)));
  APP.entries.push({ id:APP.genId(), type:'month', date, kwh,
    self:parseFloat(document.getElementById('mo-self')?.value)||null,
    feed:parseFloat(document.getElementById('mo-feed')?.value)||null,
    weather:document.getElementById('mo-weather')?.value,
    note:document.getElementById('mo-note')?.value||'', source:'manual' });
  APP.savePv(); APP.updateSidebar(); APP.toast('✓ Monat gespeichert');
  const el = document.getElementById('mo-kwh'); if (el) el.value='';
}

// ── GROWATT IMPORT ────────────────────────────────────────
function importGrowatt() {
  const raw = document.getElementById('gr-csv')?.value.trim();
  const resEl = document.getElementById('gr-result');
  if (!raw) { APP.toast('Kein CSV','err'); return; }
  const lines = raw.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  if (lines.length < 2) { APP.toast('Zu wenig Daten','err'); return; }
  const header = lines[0].split(',').map(h => h.trim().toLowerCase()
    .replace(/[()°℃\s]/g,'').replace('e-today','etoday').replace('pac','pac')
    .replace('temp','temp').replace('date','date'));
  const hasE = header.includes('etoday'), hasP = header.includes('pac'), hasT = header.includes('temp');
  const col = n => header.indexOf(n);
  const val = (row, n) => { const i=col(n); return i>=0?row[i]?.trim():null; };
  let days = {}, sk = 0;
  if (header.includes('date') && hasE) {
    lines.slice(1).forEach(line => {
      const row = line.split(',');
      const dr = val(row,'date'); if (!dr) { sk++; return; }
      const date = dr.replace(/\//g,'-').substring(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { sk++; return; }
      const et=parseFloat(val(row,'etoday')), pac=hasP?parseFloat(val(row,'pac')):NaN, tmp=hasT?parseFloat(val(row,'temp')):NaN;
      if (!days[date]) days[date] = { kwh:0, peakW:0, temps:[] };
      if (!isNaN(et) && et > days[date].kwh) days[date].kwh = et;
      if (!isNaN(pac) && pac > days[date].peakW) days[date].peakW = pac;
      if (!isNaN(tmp)) days[date].temps.push(tmp);
    });
  }
  let added = 0;
  Object.entries(days).forEach(([date, d]) => {
    if (d.kwh <= 0) return;
    APP.setEntries(APP.entries.filter(e => !(e.type==='day' && e.date===date)));
    const avgT = d.temps.length ? Math.round(d.temps.reduce((a,b)=>a+b,0)/d.temps.length) : null;
    APP.entries.push({ id:APP.genId(), type:'day', date, kwh:+d.kwh.toFixed(3),
      peak:d.peakW>0?Math.round(d.peakW):null, hours:null, self:null, feed:null,
      weather:'⛅', temp:avgT, note:'Growatt ShinePhone Import', source:'growatt' });
    added++;
  });
  APP.entries.sort((a,b) => a.date.localeCompare(b.date));
  APP.savePv(); APP.updateSidebar();
  if (resEl) resEl.innerHTML = `<span style="color:var(--gr)">✓ ${added} Einträge importiert${sk>0?' ('+sk+' übersprungen)':''}</span>`;
  APP.toast('✓ Growatt: ' + added + ' Einträge');
}
function loadGrowattSample() {
  const yr=new Date().getFullYear(), mo=String(new Date().getMonth()+1).padStart(2,'0');
  const el = document.getElementById('gr-csv');
  if (el) el.value = `Date,Time,Pac(W),E-Today(kWh),E-Total(kWh),Vpv1(V),Ipv1(A),Temp(℃)\n${yr}-${mo}-01,12:00:00,748,4.21,130.60,38.1,19.6,28.4\n${yr}-${mo}-02,12:00:00,690,3.85,134.45,36.2,19.0,25.1\n${yr}-${mo}-03,12:00:00,420,2.10,136.55,30.0,14.0,20.3`;
  APP.toast('Beispiel eingefügt');
}
function toggleManual() {
  const s = document.getElementById('pv-manual-body');
  const b = document.getElementById('pv-manual-btn');
  if (!s||!b) return;
  const v = s.style.display !== 'none';
  s.style.display = v ? 'none' : 'block';
  b.textContent = v ? 'Einblenden' : 'Ausblenden';
}
function importManual() {
  const txt = document.getElementById('pv-manual-csv')?.value.trim();
  if (!txt) { APP.toast('Kein Text','err'); return; }
  let count = 0;
  txt.split('\n').forEach(line => {
    const p = line.trim().split(','); if (p.length < 3) return;
    const [type, date, kwhS, peakS, hrsS, selfS, feedS, weath, tmpS, ...noteArr] = p;
    const kwh = parseFloat(kwhS);
    if (!['day','week','month'].includes(type)||!date||isNaN(kwh)) return;
    APP.setEntries(APP.entries.filter(e => !(e.type===type && e.date===date)));
    APP.entries.push({ id:APP.genId(), type, date, kwh,
      peak:peakS?parseFloat(peakS):null, hours:hrsS?parseFloat(hrsS):null,
      self:selfS?parseFloat(selfS):null, feed:feedS?parseFloat(feedS):null,
      weather:weath||'⛅', temp:tmpS?parseFloat(tmpS):null,
      note:noteArr.join(',').trim()||'', source:'manual' });
    count++;
  });
  APP.savePv(); APP.updateSidebar(); APP.toast('✓ ' + count + ' Einträge importiert');
}
function loadManualSample() {
  const yr = new Date().getFullYear() - 1;
  const el = document.getElementById('pv-manual-csv');
  if (el) el.value = `day,${yr}-05-15,4.82,740,7.5,2.5,2.3,☀️,24,Beispiel\nmonth,${yr}-05-01,98.3,,,48,50,☀️,,\nmonth,${yr}-06-01,115.8,,,57,59,☀️,,`;
}
function exportCsv() {
  const type=document.getElementById('ex-type')?.value||'all';
  const from=document.getElementById('ex-from')?.value;
  const to  =document.getElementById('ex-to')?.value;
  let data = [...APP.entries];
  if (type!=='all') data=data.filter(e=>e.type===type);
  if (from) data=data.filter(e=>e.date>=from);
  if (to)   data=data.filter(e=>e.date<=to);
  data.sort((a,b)=>a.date.localeCompare(b.date));
  const rows = data.map(e=>[e.type,e.date,e.kwh,e.peak||'',e.hours||'',e.self||'',e.feed||'',e.weather||'',e.temp||'',e.note||''].join(','));
  const blob = new Blob(['typ,datum,kwh,peak_w,stunden,eigenstrom,einspeisung,wetter,temp,notiz\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='pv_pinggau_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
  APP.toast('✓ CSV exportiert (' + rows.length + ' Zeilen)');
}
function clearAll() {
  if (!confirm('Alle PV-Daten löschen?')) return;
  const pw = prompt('Passwort bestätigen:');
  if (pw !== 'We7-Tracker-P!nggau') { APP.toast('Falsches Passwort','err'); return; }
  APP.setEntries([]);
  APP.savePv(); APP.updateSidebar(); renderOverview(); renderTable();
  APP.toast('PV-Daten gelöscht');
}

// ── INIT DEFAULTS ────────────────────────────────────────
function initDefaults() {
  const today=new Date().toISOString().split('T')[0],yr=today.substring(0,4);
  const f=document.getElementById('pv-from'),t=document.getElementById('pv-to');
  if(f) f.value=yr+'-01-01'; if(t) t.value=today;
  const ed=document.getElementById('e-date'); if(ed) ed.value=today;
  const now=new Date(),day=now.getDay()||7;now.setDate(now.getDate()-day+1);
  const wd=document.getElementById('w-date'); if(wd) wd.value=now.toISOString().split('T')[0];
  const wk=document.getElementById('w-kw'); if(wk) wk.value=APP.getWeekNum(new Date());
  const mm=document.getElementById('mo-month'); if(mm) mm.value=new Date().getMonth();
  const my=document.getElementById('mo-year'); if(my) my.value=new Date().getFullYear();
}

function register() {
  APP.registerPage('pv', {
    html: HTML,
    onEnter: () => { initDefaults(); renderOverview(); renderTable(); }
  });
}

return { tab, setEntryMode, resetFilter, renderOverview, renderTable,
         toggleAll, deleteSelected, deleteSingle, copyEntry,
         prefillToday, addDay, addWeek, addMonth,
         importGrowatt, loadGrowattSample, toggleManual, importManual, loadManualSample,
         exportCsv, clearAll, register };
})();
