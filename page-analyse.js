// ═══════════════════════════════════════════════════════════
// PAGE-ANALYSE.JS  —  Autarkie · Amortisation · Tagesprofile
// ═══════════════════════════════════════════════════════════

// ── AUTARKIE ────────────────────────────────────────────────
const AU = (() => {
'use strict';

const HTML = `
<div class="ph">
  <div><div class="ph-title">Autarkie-Analyse</div><div class="ph-sub">Eigenversorgungsgrad · 15-min-Messung</div></div>
</div>
<div id="au-timeline"></div>

<!-- Datenquelle-Hinweis -->
<div id="au-datasource" style="margin:0 0 10px;padding:8px 14px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--tx2)"></div>

<!-- KPI row -->
<div class="metrics" id="au-kpi">
  <div class="mc gr"><div class="mc-l">Autarkiegrad</div><div><span class="mc-v" id="au-v-autarky">—</span><span class="mc-u">%</span></div><div class="mc-d" id="au-v-autarky2">Eigenverbrauch / Gesamtverbrauch</div></div>
  <div class="mc hi"><div class="mc-l">PV Ertrag</div><div><span class="mc-v" id="au-v-pv">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="au-v-pv2"></div></div>
  <div class="mc bl"><div class="mc-l">Netzbezug</div><div><span class="mc-v" id="au-v-grid">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="au-v-grid2"></div></div>
  <div class="mc"><div class="mc-l">Eigenverbrauch</div><div><span class="mc-v" id="au-v-total">—</span><span class="mc-u">kWh</span></div><div class="mc-d">PV Ertrag − Einspeisung</div></div>
  <div class="mc gr"><div class="mc-l">Eigenverbrauchsgrad</div><div><span class="mc-v" id="au-v-selfuse">—</span><span class="mc-u">%</span></div><div class="mc-d">Eigenverbr. / PV Ertrag</div></div>
  <div class="mc pu"><div class="mc-l">Einspeisung</div><div><span class="mc-v" id="au-v-feed">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="au-v-feed2"></div></div>
</div>

<!-- Autarkie Verlauf -->
<div class="cc full" style="margin-bottom:14px">
  <div class="cc-title">Autarkiegrad — Tagesverlauf</div>
  <div class="cc-sub">% Eigenversorgung pro Tag im gewählten Zeitraum</div>
  <div class="cw" style="height:240px"><canvas id="au-daily-chart"></canvas></div>
</div>

<!-- Tagesbilanz -->
<div class="cc full" style="margin-bottom:14px">
  <div class="cc-title">Energiebilanz pro Tag</div>
  <div class="cc-sub">PV-Ertrag · Netzbezug · Eigenverbrauch</div>
  <div class="leg">
    <div class="li"><span class="ld" style="background:#f5c842"></span>PV Ertrag</div>
    <div class="li"><span class="ld" style="background:rgba(91,156,246,.7)"></span>Netzbezug</div>
    <div class="li"><span class="ld" style="background:rgba(63,207,142,.7)"></span>Eigenverbrauch (PV direkt)</div>
  </div>
  <div class="cw" style="height:240px"><canvas id="au-bar-chart"></canvas></div>
</div>

<!-- Monatsvergleich -->
<div class="cgrid">
  <div class="cc">
    <div class="cc-title">Autarkie nach Monat</div>
    <div class="cc-sub">Durchschnitt pro Monat</div>
    <div class="cw" style="height:220px"><canvas id="au-month-chart"></canvas></div>
  </div>
  <div class="cc">
    <div class="cc-title">Energieverteilung</div>
    <div class="cc-sub">Anteile im Zeitraum</div>
    <div class="cw" style="height:220px"><canvas id="au-donut-chart"></canvas></div>
  </div>
</div>
`;

let _from = null, _to = null;

function onEnter() {
  // defaultFrom = PV-Installationsdatum: Autarkie erst ab 1.6.2026 sinnvoll
  const fb = APP.FilterBar.create('au-timeline', {
    defaultFrom: '2026-06-01',
    onRange: (f,t) => { _from=f; _to=t; render(); }
  });
  render();
}

function render() {
  const cfg = APP.cfg;

  // Datumsfilter — Anlage installiert 1.6.2026
  const INSTALL = '2026-06-01';
  const fromD = _from || INSTALL;
  const toD   = _to   || new Date().toLocaleDateString('sv');

  // ── Primär: Zählerstandsdifferenzen aus Verbrauchsbilanz ──
  // Jede Periode = [from, to] mit solar, feed, strom (kWh)
  // Eigenverbrauch = solar − feed (exakt gemessen)
  const periods = (typeof CV2 !== 'undefined') ? CV2.getMeterPeriods() : [];

  // Perioden auf den Zeitraum filtern (Periode überschneidet [fromD, toD])
  // p.solar = pvKwh (Growatt) nach getMeterPeriods()-Umbau; Filter auf Existenz der Periode
  const filtPeriods = periods.filter(p => p.to >= fromD && p.from <= toD);

  // Monatsweise Aggregation aus Perioden (für Balken- und Monatschart)
  // Da Perioden nicht immer Monatsgrenzen treffen: wir verwenden Perioden als Einheit
  const hasMeter = filtPeriods.length > 0;

  // Quellenhinweis
  const dsEl = document.getElementById('au-datasource');
  if (dsEl) {
    if (hasMeter) {
      dsEl.innerHTML = `📊 <strong>Zählermessung</strong> — Eigenverbrauch aus Zählerstandsdifferenzen (${filtPeriods.length} Ablesungen), exakter Wert ohne Schätzung.`;
    } else {
      dsEl.innerHTML = `⚠️ <strong>Keine Zählerdaten</strong> — Bitte Ablesungen in der Verbrauchsbilanz eintragen. Eigenverbrauch kann ohne Zählerdaten nicht berechnet werden.`;
    }
  }

  // Summen berechnen — EXAKT dieselbe Logik wie Dashboard (renderCore):
  // PV-Ertrag: pv_entries (Growatt), Netzbezug: consumption_15min, Eigenverbrauch: CV2 Zähler
  let totPv=0, totGrid=0, totSelf=0, totFeed=0;

  // PV-Ertrag aus pv_entries (Doppelzählung vermeiden: Monatseintrag hat Vorrang)
  let pvD = APP.entries.filter(e => e.date >= fromD && e.date <= toD);
  const monthsWithAggregate = new Set(pvD.filter(e => e.type==='month').map(e => e.date.substring(0,7)));
  pvD = pvD.filter(e => !(e.type==='day' && monthsWithAggregate.has(e.date.substring(0,7))));
  totPv = pvD.reduce((s,e) => s+e.kwh, 0);

  // Netzbezug aus consumption_15min (gleiche Quelle wie Dashboard)
  APP.consumption.filter(c => c.direction==='grid' && c.date >= fromD && c.date <= toD)
    .forEach(c => { totGrid += parseFloat(c.kwh)||0; });

  // Eigenverbrauch + Einspeisung aus CV2 Zählerablesungen (exakt gemessen)
  if (hasMeter) {
    filtPeriods.forEach(p => {
      totFeed += p.feed || 0;
    });
    totSelf = Math.max(0, totPv - totFeed); // Eigenverbrauch = PV − Einspeisung
  }
  // ohne Zählerdaten: totSelf und totFeed bleiben 0 — keine Schätzung

  const totTotal   = totSelf + totGrid; // Gesamtverbrauch = Eigenverbr. + Netzbezug
  const avgAutarky = totTotal > 0 ? Math.min(100, (totSelf / totTotal) * 100) : 0;
  const avgSelfUse = totPv    > 0 ? Math.min(100, (totSelf / totPv)   * 100) : 0;

  // KPIs
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('au-v-autarky',  avgAutarky.toFixed(1));
  set('au-v-autarky2', hasMeter
    ? `${filtPeriods.length} Ablesungsperioden · Ø ${avgAutarky.toFixed(1)}%`
    : 'Keine Zählerdaten — bitte Ablesungen eintragen');
  set('au-v-pv',   totPv.toFixed(1));
  set('au-v-pv2',  hasMeter ? `${filtPeriods.length} Zählerablesungsperioden` : 'PV-Ertragsdaten');
  set('au-v-grid', totGrid.toFixed(1));
  set('au-v-grid2',`Ø ${totPv > 0 ? (totGrid/(hasMeter ? filtPeriods.length : 1)).toFixed(1) : '—'} kWh/Periode`);
  set('au-v-total',totSelf.toFixed(1));
  set('au-v-selfuse', avgSelfUse.toFixed(1));
  set('au-v-feed',  totFeed.toFixed(1));
  set('au-v-feed2', `@ ${cfg.feedRate} €/kWh = ${(totFeed*cfg.feedRate).toFixed(2)} €`);

  // ── Chartserie: Pro Periode / Monat ──
  // Für Verlaufsgrafik: Perioden als Datenpunkte
  const periods4chart = hasMeter ? filtPeriods : [];
  const labels  = periods4chart.map(p => p.from.substring(5)+' – '+p.to.substring(5));
  // PV-Ertrag pro Periode: aus pv_entries aggregieren
  const pvArr   = periods4chart.map(p => {
    let pv = APP.entries.filter(e => e.date >= p.from && e.date <= p.to);
    const mwa = new Set(pv.filter(e=>e.type==='month').map(e=>e.date.substring(0,7)));
    pv = pv.filter(e => !(e.type==='day' && mwa.has(e.date.substring(0,7))));
    return +pv.reduce((s,e)=>s+e.kwh,0).toFixed(1);
  });
  // Netzbezug pro Periode: aus consumption_15min (gleiche Quelle wie Dashboard)
  const gridArr = periods4chart.map(p => {
    return +APP.consumption.filter(c => c.direction==='grid' && c.date >= p.from && c.date <= p.to)
      .reduce((s,c)=>s+(parseFloat(c.kwh)||0),0).toFixed(1);
  });
  const selfArr = periods4chart.map((p,i) => +Math.max(0, pvArr[i]-(p.feed||0)).toFixed(1));
  const autPct  = periods4chart.map((p,i) => {
    const self = selfArr[i];
    const tot  = self + gridArr[i];
    return tot > 0 ? +((self/tot)*100).toFixed(1) : 0;
  });

  // Chart 1: Autarkie-Verlauf
  APP.destroyChart('au-daily');
  const ctx1 = document.getElementById('au-daily-chart')?.getContext('2d');
  if (ctx1) {
    APP.charts['au-daily'] = new Chart(ctx1, {
      type: 'line',
      data: { labels, datasets: [{
        label: 'Autarkiegrad %',
        data: autPct,
        borderColor: '#3fcf8e',
        backgroundColor: 'rgba(63,207,142,.15)',
        fill: true, tension: 0.3, pointRadius: periods4chart.length > 60 ? 0 : 3, borderWidth: 2
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.parsed.y.toFixed(1)} %` } }},
        scales: {
          x: { ticks: { color: APP.TC, maxTicksLimit: 12, font:{size:10} }, grid: { color: APP.GC } },
          y: { min: 0, max: 100, ticks: { color: APP.TC, callback: v => v+'%', font:{size:10} }, grid: { color: APP.GC } }
        }
      }
    });
  }

  // Chart 2: Balkenchart Energiebilanz
  APP.destroyChart('au-bar');
  const ctx2 = document.getElementById('au-bar-chart')?.getContext('2d');
  if (ctx2) {
    APP.charts['au-bar'] = new Chart(ctx2, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'PV Ertrag',    data: pvArr,   backgroundColor: 'rgba(245,200,66,.8)', stack: 'a' },
        { label: 'Netzbezug',   data: gridArr, backgroundColor: 'rgba(91,156,246,.7)',  stack: 'b' },
        { label: 'Eigenverbr.', data: selfArr, backgroundColor: 'rgba(63,207,142,.7)',  stack: 'b' },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: APP.TC, maxTicksLimit: 12, font:{size:10} }, grid: { color: APP.GC } },
          y: { ticks: { color: APP.TC, callback: v => v+' kWh', font:{size:10} }, grid: { color: APP.GC } }
        }
      }
    });
  }

  // Chart 3: Autarkie nach Monat (Perioden auf Monate aufteilen)
  const byMonth = {};
  if (hasMeter) {
    filtPeriods.forEach(p => {
      // Periode dem Startmonat zuordnen
      const ym = p.from.substring(0,7);
      if (!byMonth[ym]) byMonth[ym] = { pv:0, grid:0, self:0, n:0 };
      byMonth[ym].pv   += p.solar||0;
      byMonth[ym].grid += p.strom||0;
      byMonth[ym].self += Math.max(0,(p.solar||0)-(p.feed||0));
      byMonth[ym].n++;
    });
  }
  const mLabels = Object.keys(byMonth).sort();
  const mAutarky = mLabels.map(ym => {
    const m = byMonth[ym];
    const tot = m.self + m.grid;
    return tot > 0 ? +((m.self/tot)*100).toFixed(1) : 0;
  });
  APP.destroyChart('au-month');
  const ctx3 = document.getElementById('au-month-chart')?.getContext('2d');
  if (ctx3) {
    APP.charts['au-month'] = new Chart(ctx3, {
      type: 'bar',
      data: { labels: mLabels, datasets: [{
        label: 'Autarkie %',
        data: mAutarky,
        backgroundColor: mAutarky.map(v =>
          v>=60 ? 'rgba(63,207,142,.85)' : v>=40 ? 'rgba(245,200,66,.85)' : 'rgba(91,156,246,.7)'),
        borderRadius: 4
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.parsed.y.toFixed(1)} %` } }},
        scales: {
          x: { ticks: { color: APP.TC, font:{size:10} }, grid: { color: APP.GC } },
          y: { min:0, max:100, ticks: { color: APP.TC, callback: v=>v+'%', font:{size:10} }, grid: { color: APP.GC } }
        }
      }
    });
  }

  // Chart 4: Donut
  APP.destroyChart('au-donut');
  const ctx4 = document.getElementById('au-donut-chart')?.getContext('2d');
  if (ctx4 && totTotal > 0) {
    APP.charts['au-donut'] = new Chart(ctx4, {
      type: 'doughnut',
      data: {
        labels: ['Eigenverbrauch (PV→direkt)', 'Netzbezug', 'Einspeisung ins Netz'],
        datasets: [{ data: [+totSelf.toFixed(1), +totGrid.toFixed(1), +totFeed.toFixed(1)],
          backgroundColor: ['rgba(63,207,142,.85)','rgba(91,156,246,.7)','rgba(167,139,250,.75)'],
          borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position:'bottom', labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } },
          tooltip: { callbacks: { label: c => ` ${c.parsed.toFixed(1)} kWh` } }}
      }
    });
  }
}

function register() { APP.registerPage('autarkie', { html: HTML, onEnter }); }
return { register };
})();

// ── AMORTISATION ────────────────────────────────────────────
const AMOR = (() => {
'use strict';

const HTML = `
<div class="ph">
  <div><div class="ph-title">Amortisationsrechner</div><div class="ph-sub">Break-even · Kumulierte Ersparnis</div></div>
</div>

<!-- Konfiguration -->
<div class="fcard">
  <div class="fcard-t">Anlagenkosten &amp; Parameter <button class="btn-s" style="font-size:11px;padding:4px 12px" onclick="AMOR.saveParams()">💾 Speichern</button></div>
  <div class="fgrid">
    <div class="field"><label>Anschaffungskosten (€)</label>
      <input type="number" id="am-cost" value="1200" step="50" onchange="AMOR.calc()"></div>
    <div class="field"><label>Bezugspreis (€/kWh)</label>
      <input type="number" id="am-price" step="0.01" onchange="AMOR.calc()"></div>
    <div class="field"><label>Einspeisevergütung (€/kWh)</label>
      <input type="number" id="am-feed" step="0.001" onchange="AMOR.calc()"></div>
    <div class="field"><label>Eigenverbrauchsanteil (%)</label>
      <div style="padding:6px 10px;background:var(--bg3);border-radius:6px;font-size:13px;color:var(--tx2);display:flex;align-items:center;gap:8px">
        <span id="am-selfpct" style="font-weight:600;font-size:16px;color:var(--tx)">—</span>
        <span id="am-selfpct-hint" style="font-size:11px;color:var(--tx3)">— aus Zählermessung</span>
      </div></div>
    <div class="field"><label>Preissteigerung p.a. (%)</label>
      <input type="number" id="am-inflation" value="3" step="0.5" onchange="AMOR.calc()"></div>
    <div class="field"><label>Degradation p.a. (%)</label>
      <input type="number" id="am-degradation" value="0.5" step="0.1" onchange="AMOR.calc()"></div>
  </div>
</div>

<!-- KPIs -->
<div class="metrics">
  <div class="mc hi"><div class="mc-l">Break-even</div><div><span class="mc-v" id="am-breakeven">—</span><span class="mc-u">Jahre</span></div><div class="mc-d" id="am-breakeven2"></div></div>
  <div class="mc gr"><div class="mc-l">Ersparnis bisher</div><div><span class="mc-v" id="am-saved">—</span><span class="mc-u">€</span></div><div class="mc-d" id="am-saved2"></div></div>
  <div class="mc bl"><div class="mc-l">Ø Jahresertrag</div><div><span class="mc-v" id="am-annual">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="am-annual2"></div></div>
  <div class="mc pu"><div class="mc-l">Ø Jahresersparnis</div><div><span class="mc-v" id="am-annsave">—</span><span class="mc-u">€</span></div><div class="mc-d" id="am-annsave2"></div></div>
  <div class="mc gr"><div class="mc-l">Rendite (10 J.)</div><div><span class="mc-v" id="am-roi">—</span><span class="mc-u">%</span></div><div class="mc-d">Gesamtrendite über 10 Jahre</div></div>
  <div class="mc"><div class="mc-l">Restbetrag</div><div><span class="mc-v" id="am-remaining">—</span><span class="mc-u">€</span></div><div class="mc-d" id="am-remaining2"></div></div>
</div>

<!-- Break-even Chart -->
<div class="cc full" style="margin-bottom:14px">
  <div class="cc-title">Kumulierte Ersparnis vs. Investition</div>
  <div class="cc-sub">Monatliche Hochrechnung auf 15 Jahre · Break-even Linie</div>
  <div class="leg">
    <div class="li"><span class="ld" style="background:rgba(63,207,142,.8)"></span>Kumulierte Ersparnis</div>
    <div class="li"><span class="ld" style="background:rgba(245,200,66,.6)"></span>Tatsächliche Ersparnis (Messdaten)</div>
    <div class="li"><span class="ld" style="background:rgba(242,92,92,.7)"></span>Investition</div>
  </div>
  <div class="cw" style="height:280px"><canvas id="am-chart"></canvas></div>
</div>

<!-- Jahrestabelle -->
<div class="tcard">
  <div class="thead"><span class="thead-t">Jahresrechnung</span></div>
  <table>
    <thead><tr>
      <th>Jahr</th><th>Ertrag (kWh)</th><th>Eigenverbr.</th>
      <th>Ersparnis (€)</th><th>Kumuliert (€)</th><th>Status</th>
    </tr></thead>
    <tbody id="am-table"></tbody>
  </table>
</div>
`;

const LS_KEY = 'pv_amor_cfg';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveParams() {
  const get = id => document.getElementById(id)?.value;
  const data = {
    cost: get('am-cost'), price: get('am-price'), feed: get('am-feed'),
    // selfpct wird aus Zählerdaten berechnet, nicht gespeichert
    inflation: get('am-inflation'), degradation: get('am-degradation')
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(e) {}
  APP.toast('Parameter gespeichert ✓');
}

function onEnter() {
  const cfg    = APP.cfg;
  const saved  = loadSaved();
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  // Gespeicherte Werte haben Vorrang, sonst APP.cfg
  set('am-cost',        saved.cost        ?? 1200);
  set('am-price',       saved.price       ?? cfg.price);
  set('am-feed',        saved.feed        ?? cfg.feedRate);
  // am-selfpct: kein Eingabefeld — wird in calc() aus Zählerdaten berechnet
  set('am-inflation',   saved.inflation   ?? 3);
  set('am-degradation', saved.degradation ?? 0.5);
  calc();
}

function calc() {
  const cfg = APP.cfg;

  const cost        = parseFloat(document.getElementById('am-cost')?.value)        || 1200;
  const price       = parseFloat(document.getElementById('am-price')?.value)       || cfg.price;
  const feedRate    = parseFloat(document.getElementById('am-feed')?.value)        || cfg.feedRate;
  const inflation   = parseFloat(document.getElementById('am-inflation')?.value)   || 3;
  const degradation = parseFloat(document.getElementById('am-degradation')?.value) || 0.5;

  // ── Eigenverbrauch IMMER aus Zählermessung — niemals schätzen ──
  const periods = (typeof CV2 !== 'undefined') ? CV2.getMeterPeriods() : [];
  const hasMeter = periods.length > 0;

  // Monatsweise aggregieren: self = solar − feed (exakt gemessen)
  const meterByMonth = {};
  periods.forEach(p => {
    const ym = p.from.substring(0,7);
    if (!meterByMonth[ym]) meterByMonth[ym] = { solar:0, feed:0, self:0, strom:0 };
    meterByMonth[ym].solar += p.solar||0;
    meterByMonth[ym].feed  += p.feed||0;
    meterByMonth[ym].self  += Math.max(0,(p.solar||0)-(p.feed||0)); // Eigenverbr. = PV − Einspeisung
    meterByMonth[ym].strom += p.strom||0;
  });

  // selfPct aus Zähler berechnen — KEINE andere Quelle
  const totSolar = Object.values(meterByMonth).reduce((s,v)=>s+(v.solar||0),0);
  const totSelf  = Object.values(meterByMonth).reduce((s,v)=>s+(v.self||0),0);
  const selfPct  = (hasMeter && totSolar > 0)
    ? Math.min(100, (totSelf / totSolar) * 100)
    : 0; // 0 = keine Daten, Hochrechnung ergibt 0

  // Anzeige Eigenverbrauchsanteil-Feld (read-only)
  const spEl = document.getElementById('am-selfpct');
  const hint = document.getElementById('am-selfpct-hint');
  if (spEl) spEl.textContent = selfPct > 0 ? selfPct.toFixed(1)+'%' : '—';
  if (hint) hint.textContent = selfPct > 0
    ? `aus ${periods.length} Zählerablesungen (${totSolar.toFixed(0)} kWh PV, ${totSelf.toFixed(0)} kWh Eigenverbr.)`
    : 'keine Zählerablesungen — bitte in der Verbrauchsbilanz erfassen';

  // Startdatum der Anlage — fix 1.6.2026 (Installationsdatum)
  const startDate = new Date('2026-06-01');
  const startYear = startDate.getFullYear();

  // Ø Jahresertrag aus pv_entries (Tageswerte) — für Hochrechnung
  const entries = APP.entries;
  const byMonthPv = {};
  entries.filter(e => e.type==='day').forEach(e => {
    const ym = e.date.substring(0,7);
    byMonthPv[ym] = (byMonthPv[ym]||0) + e.kwh;
  });
  // Monatliche PV-Werte aus pv_entries (type=month) falls vorhanden
  entries.filter(e => e.type==='month').forEach(e => {
    const ym = e.date.substring(0,7);
    if (!byMonthPv[ym]) byMonthPv[ym] = e.kwh;
  });

  const pvMonths   = Object.keys(byMonthPv).sort();
  const pvTotal    = Object.values(byMonthPv).reduce((s,v)=>s+v,0);
  const monthCount = pvMonths.length || 1;
  const annualKwh  = pvTotal / monthCount * 12;

  // Monatliche Ersparnis: real aus Zählerdaten, dann Hochrechnung
  const now       = new Date();
  const nowYM     = now.toISOString().substring(0,7);
  const CHART_END = '2030-12';
  const projMonths= 15 * 12;

  const real    = [];
  const proj    = [];
  const invest  = [];

  let cumReal = 0, cumProj = 0;
  let breakEvenMonth = null;
  let actualSaved = 0;

  for (let m = 0; m < projMonths; m++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    const ym = d.toISOString().substring(0,7);
    const yr = m / 12;

    const priceM    = price * Math.pow(1 + inflation/100, yr);
    const degFactor = Math.pow(1 - degradation/100, yr);
    const monthKwh  = (annualKwh / 12) * degFactor;
    const selfKwh   = monthKwh * (selfPct/100);
    const feedKwh   = Math.max(0, monthKwh - selfKwh);
    const savingM   = selfKwh * priceM + feedKwh * feedRate;

    // Real: bevorzugt aus Zählerdaten, sonst aus pv_entries
    const hasMeterM = hasMeter && meterByMonth[ym] != null;
    const hasPvM    = !hasMeterM && byMonthPv[ym] != null;
    const isReal    = ym <= nowYM && (hasMeterM || hasPvM);

    if (isReal) {
      let realSave = 0;
      if (hasMeterM) {
        // Exakt: Eigenverbrauch * Bezugspreis + Einspeisung * Einspeisevergütung
        const mb = meterByMonth[ym];
        realSave = mb.self * price + mb.feed * feedRate;
      } else if (hasPvM) {
        // Kein selfPct-Schätzwert — ohne Zählerdaten kein Eigenverbrauch berechenbar
        // Nur Einspeisevergütung auf Basis PV-Ertrag (konservativ)
        const realKwh  = byMonthPv[ym];
        realSave = realKwh * feedRate; // nur Einspeisevergütung, kein Eigenverbr.
      }
      cumReal += realSave;
      actualSaved = cumReal;
    }

    cumProj += savingM;
    if (!breakEvenMonth && cumProj >= cost) breakEvenMonth = yr;

    if (m % 3 === 0 && ym <= CHART_END) {
      real.push(isReal ? +cumReal.toFixed(2) : null);
      proj.push(+cumProj.toFixed(2));
      invest.push(cost);
    }
  }

  // Quartalslabels bis 2030
  const quarterLabels = [];
  for (let m = 0; m < projMonths; m += 3) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    const ym2 = d.toISOString().substring(0,7);
    if (ym2 > CHART_END) break;
    quarterLabels.push(m % 12 === 0 ? String(d.getFullYear()) : '');
  }

  // KPIs
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const beYears  = breakEvenMonth ? breakEvenMonth.toFixed(1) : '>15';
  const remaining= Math.max(0, cost - actualSaved);
  const annSave  = hasMeter
    ? annualKwh * (selfPct/100) * price + annualKwh * (1-selfPct/100) * feedRate
    : annualKwh * feedRate; // ohne Zählerdaten nur Einspeisevergütung
  const roi10    = annualKwh > 0 ? ((annSave * 10 - cost) / cost * 100) : 0;
  const dataSource = hasMeter ? `${periods.length} Zählerablesungen` : `${monthCount} Monat${monthCount!==1?'e':''} Ertragsdaten`;

  set('am-breakeven',  beYears);
  set('am-breakeven2', breakEvenMonth ? `ca. ${startYear + Math.floor(breakEvenMonth)} erreicht` : 'Noch nicht erreicht');
  set('am-saved',      actualSaved.toFixed(2));
  set('am-saved2',     `von ${cost} € Investition · ${hasMeter ? 'exakt gemessen' : 'ohne Zählerdaten'}` );
  set('am-annual',     annualKwh.toFixed(0));
  set('am-annual2',    `Basis: ${dataSource}`);
  set('am-annsave',    annSave.toFixed(2));
  set('am-annsave2',   hasMeter
    ? `${selfPct.toFixed(0)}% Eigenverbr. · ${(100-selfPct).toFixed(0)}% Einspeisung`
    : 'ohne Zählerdaten — nur Einspeisevergütung');
  set('am-roi',        roi10.toFixed(1));
  set('am-remaining',  remaining.toFixed(2));
  set('am-remaining2', remaining > 0 ? `noch ${(remaining/Math.max(annSave,0.01)).toFixed(1)} Jahre` : 'Break-even erreicht! ✓');

  // Chart
  APP.destroyChart('am-main');
  const ctx = document.getElementById('am-chart')?.getContext('2d');
  if (ctx) {
    APP.charts['am-main'] = new Chart(ctx, {
      type: 'line',
      data: { labels: quarterLabels, datasets: [
        { label: 'Hochrechnung', data: proj, borderColor:'rgba(63,207,142,.8)',
          backgroundColor:'rgba(63,207,142,.08)', fill:true, tension:0.3, pointRadius:0, borderWidth:2 },
        { label: 'Ist (Messung)', data: real, borderColor:'rgba(245,200,66,.9)',
          backgroundColor:'rgba(245,200,66,.15)', fill:true, tension:0.3, pointRadius:0, borderWidth:2.5,
          spanGaps: false },
        { label: 'Investition', data: invest, borderColor:'rgba(242,92,92,.6)',
          borderDash:[6,3], pointRadius:0, borderWidth:1.5, fill:false, tension:0 }
      ]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{ label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(2)} €` } }},
        scales:{
          x:{ ticks:{ color:APP.TC, font:{size:10} }, grid:{ color:APP.GC } },
          y:{ ticks:{ color:APP.TC, callback: v=>`${v} €`, font:{size:10} }, grid:{ color:APP.GC } }
        }
      }
    });
  }

  // Jahrestabelle
  const tbody = document.getElementById('am-table');
  if (tbody) {
    let rows = '', cumY = 0;
    for (let y = 0; y < 15; y++) {
      const yr     = y + 1;
      const yearD  = new Date(startDate);
      yearD.setFullYear(yearD.getFullYear() + y);
      const yearKey = yearD.getFullYear();
      const degF   = Math.pow(1 - degradation/100, y);
      const priceY = price * Math.pow(1 + inflation/100, y);
      const kwh    = annualKwh * degF;
      const selfKwh= hasMeter ? kwh * (selfPct/100) : 0;
      const feedKwh= hasMeter ? Math.max(0, kwh - selfKwh) : kwh;
      const saving = selfKwh * priceY + feedKwh * feedRate;
      cumY += saving;
      const done   = cumY >= cost;
      const cls    = done ? 'good' : cumY > cost*0.5 ? 'mid' : 'low';
      const lbl    = done ? '✓ amortisiert' : `${(cumY/cost*100).toFixed(0)}%`;
      rows += `<tr>
        <td>${yearKey}</td>
        <td>${kwh.toFixed(0)} kWh</td>
        <td>${hasMeter ? `${selfPct.toFixed(0)}% = ${selfKwh.toFixed(0)} kWh` : '— (keine Zählerdat.)'}</td>
        <td>${saving.toFixed(2)} €</td>
        <td style="font-weight:500">${cumY.toFixed(2)} €</td>
        <td><span class="badge ${cls}">${lbl}</span></td>
      </tr>`;
    }
    tbody.innerHTML = rows;
  }
}

function register() { APP.registerPage('amortisation', { html: HTML, onEnter }); }
return { register, calc, saveParams };
})();

// ── TAGESPROFILE ────────────────────────────────────────────
const PROF = (() => {
'use strict';

const HTML = `
<div class="ph">
  <div><div class="ph-title">Tagesprofile</div><div class="ph-sub">Durchschnitts-Tageskurven · Heatmap</div></div>
</div>

<!-- Tabs -->
<div class="mtabs">
  <button class="mtab active" onclick="PROF.tab('curve')">📈 Tageskurven</button>
  <button class="mtab" onclick="PROF.tab('heatmap')">🔥 Heatmap</button>
</div>

<!-- Tab: Tageskurven -->
<div id="prof-curve-tab">
  <div class="fcard" style="padding:14px 18px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--tx2);text-transform:uppercase;letter-spacing:.7px">Monate vergleichen:</span>
      <div id="prof-month-btns" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      <button class="btn-s" style="font-size:11px;padding:4px 10px" onclick="PROF.selectAllMonths()">Alle</button>
      <button class="btn-s" style="font-size:11px;padding:4px 10px" onclick="PROF.clearMonths()">Keine</button>
    </div>
  </div>

  <div class="cc full" style="margin-bottom:14px">
    <div class="cc-title">Durchschnittliche Leistungskurve nach Monat</div>
    <div class="cc-sub">Mittlere Pac (W) pro 5-Minuten-Intervall aus growatt_5min — Sonnenaufgang bis -untergang</div>
    <div class="cw" style="height:300px"><canvas id="prof-curve-chart"></canvas></div>
  </div>

  <div class="cgrid">
    <div class="cc">
      <div class="cc-title">Peak-Leistung nach Monat</div>
      <div class="cc-sub">Ø täglicher Peak-Wert (W)</div>
      <div class="cw" style="height:200px"><canvas id="prof-peak-chart"></canvas></div>
    </div>
    <div class="cc">
      <div class="cc-title">Produktive Stunden nach Monat</div>
      <div class="cc-sub">Ø Stunden/Tag mit Pac > 10W</div>
      <div class="cw" style="height:200px"><canvas id="prof-hours-chart"></canvas></div>
    </div>
  </div>
</div>

<!-- Tab: Heatmap -->
<div id="prof-heatmap-tab" style="display:none">
  <div class="cc full">
    <div class="cc-title">Leistungs-Heatmap</div>
    <div class="cc-sub">Pac (W) — X: Uhrzeit, Y: Datum — Farbe = Leistung</div>
    <canvas id="prof-heatmap" style="width:100%;display:block;image-rendering:pixelated;border-radius:8px"></canvas>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
      <span style="font-size:10px;color:var(--tx3)">0 W</span>
      <div id="prof-hm-legend" style="flex:1;height:8px;border-radius:4px;
        background:linear-gradient(to right,#08090a,#1a4a2e,#3fcf8e,#f5c842,#f25c5c)"></div>
      <span style="font-size:10px;color:var(--tx3)">800 W</span>
    </div>
  </div>
</div>
`;

// Monatsfarben (12 Monate)
const MONTH_COLORS = [
  '#5b9cf6','#7eb5f8','#a78bfa','#c084fc',
  '#3fcf8e','#86efac','#f5c842','#fb923c',
  '#f25c5c','#e879a0','#818cf8','#60a5fa'
];

let _activeTab   = 'curve';
let _selMonths   = new Set([1,2,3,4,5,6,7,8,9,10,11,12]); // 1-based
let _g5data      = null; // Cache der growatt_5min-Daten

function onEnter() {
  _g5data = null;
  loadAndRender();
}

async function loadAndRender() {
  if (!APP.sbClient) { renderEmpty(); return; }

  // Alle growatt_5min-Daten laden (von Supabase, da nicht im localStorage)
  if (!_g5data) {
    let all = [], from = 0, done = false;
    while (!done) {
      const { data, error } = await APP.sbClient
        .from('growatt_5min').select('date,ts,pac_w')
        .order('ts').range(from, from+999);
      if (error || !data?.length) break;
      all = all.concat(data);
      if (data.length < 1000) done = true; else from += 1000;
    }
    _g5data = all;
  }

  buildMonthButtons();
  render();
}

function buildMonthButtons() {
  const container = document.getElementById('prof-month-btns');
  if (!container) return;
  const months = APP.MONTHS;
  container.innerHTML = months.map((m, i) => {
    const idx = i + 1;
    const active = _selMonths.has(idx);
    return `<button onclick="PROF.toggleMonth(${idx})" id="prof-mb-${idx}"
      style="padding:4px 10px;border-radius:20px;font-size:11px;font-family:var(--fm);cursor:pointer;border:1px solid;
      background:${active ? MONTH_COLORS[i]+'22' : 'transparent'};
      color:${active ? MONTH_COLORS[i] : 'var(--tx3)'};
      border-color:${active ? MONTH_COLORS[i] : 'var(--b2)'};transition:.15s">${m}</button>`;
  }).join('');
}

function toggleMonth(m) {
  if (_selMonths.has(m)) _selMonths.delete(m); else _selMonths.add(m);
  buildMonthButtons();
  render();
}
function selectAllMonths() { _selMonths = new Set([1,2,3,4,5,6,7,8,9,10,11,12]); buildMonthButtons(); render(); }
function clearMonths()     { _selMonths.clear(); buildMonthButtons(); render(); }

function tab(t) {
  _activeTab = t;
  document.querySelectorAll('.mtab').forEach((b,i) =>
    b.classList.toggle('active', ['curve','heatmap'][i] === t));
  document.getElementById('prof-curve-tab').style.display   = t==='curve'   ? '' : 'none';
  document.getElementById('prof-heatmap-tab').style.display = t==='heatmap' ? '' : 'none';
  render();
}

function render() {
  if (_activeTab === 'curve') renderCurves();
  else renderHeatmap();
}

function renderEmpty() {
  ['prof-curve-chart','prof-peak-chart','prof-hours-chart'].forEach(id => {
    APP.destroyChart(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (ctx) ctx.clearRect(0,0,1000,1000);
  });
}

function renderCurves() {
  const data = _g5data || [];
  if (!data.length) { renderEmpty(); return; }

  // Struktur: byMonthSlot[monat][slot] = [pac, pac, ...]  (slot = 0..287, je 5min)
  const SLOTS = 288;
  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = Array.from({length: SLOTS}, () => []);

  data.forEach(row => {
    const dt  = new Date(row.ts);
    const mon = dt.getMonth() + 1;
    if (!_selMonths.has(mon)) return;
    const slot = dt.getHours() * 12 + Math.floor(dt.getMinutes() / 5);
    if (slot >= 0 && slot < SLOTS) byMonth[mon][slot].push(parseFloat(row.pac_w) || 0);
  });

  // Zeitlabels: 05:00–21:00 anzeigen (Slots 60–252)
  const SLOT_START = 60, SLOT_END = 252;
  const slotLabels = [];
  for (let s = SLOT_START; s <= SLOT_END; s++) {
    const h = Math.floor(s/12), mi = (s%12)*5;
    slotLabels.push(s % 12 === 0 ? `${String(h).padStart(2,'0')}:00` : '');
  }

  const datasets = [];
  [..._selMonths].sort((a,b)=>a-b).forEach(m => {
    const avgs = [];
    for (let s = SLOT_START; s <= SLOT_END; s++) {
      const vals = byMonth[m][s];
      avgs.push(vals.length ? +(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1) : 0);
    }
    datasets.push({
      label: APP.MONTHS[m-1],
      data: avgs,
      borderColor: MONTH_COLORS[m-1],
      backgroundColor: 'transparent',
      pointRadius: 0, borderWidth: 2, tension: 0.4
    });
  });

  // Chart 1: Kurven
  APP.destroyChart('prof-curve');
  const ctx1 = document.getElementById('prof-curve-chart')?.getContext('2d');
  if (ctx1) {
    APP.charts['prof-curve'] = new Chart(ctx1, {
      type: 'line',
      data: { labels: slotLabels, datasets },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } },
          tooltip:{ callbacks:{ label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(0)} W` } }},
        scales:{
          x:{ ticks:{ color:APP.TC, font:{size:10}, maxRotation:0 }, grid:{ color:APP.GC } },
          y:{ min:0, ticks:{ color:APP.TC, callback:v=>v+' W', font:{size:10} }, grid:{ color:APP.GC } }
        }
      }
    });
  }

  // Peak + Hours pro Monat
  const peakByMonth  = Array(12).fill(0);
  const hoursAllDays = {}; // ym→date→hours
  for (let m = 1; m <= 12; m++) {
    if (!_selMonths.has(m)) continue;
    const peakSlot = byMonth[m].map(vals => vals.length ? Math.max(...vals) : 0);
    peakByMonth[m-1] = +(peakSlot.reduce((s,v,i) => {
      // Ø peak: für jeden Tag den max nehmen, dann average
      // Vereinfachung: max der Durchschnittswerte
      return Math.max(s, byMonth[m][i].length ? byMonth[m][i].reduce((a,v)=>a+v,0)/byMonth[m][i].length : 0);
    }, 0)).toFixed(0);
  }

  // Stunden pro Tag mit Pac > 10W
  const hoursByMonth = Array(12).fill(0);
  for (let m = 1; m <= 12; m++) {
    if (!_selMonths.has(m)) continue;
    const activeSlots = byMonth[m].filter(vals => vals.length > 0 && vals.reduce((a,v)=>a+v,0)/vals.length > 10).length;
    hoursByMonth[m-1] = +(activeSlots * 5 / 60).toFixed(1);
  }

  const mLabels = APP.MONTHS;

  APP.destroyChart('prof-peak');
  const ctx2 = document.getElementById('prof-peak-chart')?.getContext('2d');
  if (ctx2) {
    APP.charts['prof-peak'] = new Chart(ctx2, {
      type: 'bar',
      data: { labels: mLabels, datasets: [{
        label: 'Ø Peak W',
        data: peakByMonth,
        backgroundColor: MONTH_COLORS.map((c,i) => _selMonths.has(i+1) ? c+'bb' : 'rgba(255,255,255,.05)'),
        borderRadius: 4
      }]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{ label: c => ` ${c.parsed.y} W` } }},
        scales:{
          x:{ ticks:{ color:APP.TC, font:{size:10} }, grid:{ color:APP.GC } },
          y:{ ticks:{ color:APP.TC, callback:v=>v+' W', font:{size:10} }, grid:{ color:APP.GC } }
        }
      }
    });
  }

  APP.destroyChart('prof-hours');
  const ctx3 = document.getElementById('prof-hours-chart')?.getContext('2d');
  if (ctx3) {
    APP.charts['prof-hours'] = new Chart(ctx3, {
      type: 'bar',
      data: { labels: mLabels, datasets: [{
        label: 'Ø Stunden/Tag',
        data: hoursByMonth,
        backgroundColor: MONTH_COLORS.map((c,i) => _selMonths.has(i+1) ? c+'bb' : 'rgba(255,255,255,.05)'),
        borderRadius: 4
      }]},
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{ label: c => ` ${c.parsed.y} h` } }},
        scales:{
          x:{ ticks:{ color:APP.TC, font:{size:10} }, grid:{ color:APP.GC } },
          y:{ ticks:{ color:APP.TC, callback:v=>v+' h', font:{size:10} }, grid:{ color:APP.GC } }
        }
      }
    });
  }
}

function renderHeatmap() {
  const data = _g5data || [];
  const canvas = document.getElementById('prof-heatmap');
  if (!canvas || !data.length) return;

  // Alle einzigartigen Daten sortiert
  const dates = [...new Set(data.map(r => r.date))].sort();
  if (!dates.length) return;

  // Heatmap: Y = Datum (Zeile), X = Slot (Spalte, 5-min)
  const SLOTS = 288;
  const PAC_MAX = 800;

  // pac[dateIdx][slot]
  const pac = dates.map(() => new Float32Array(SLOTS));
  const cnt = dates.map(() => new Uint16Array(SLOTS));
  const dateIndex = {};
  dates.forEach((d,i) => dateIndex[d] = i);

  data.forEach(row => {
    const di = dateIndex[row.date];
    if (di == null) return;
    const dt = new Date(row.ts);
    const slot = dt.getHours()*12 + Math.floor(dt.getMinutes()/5);
    if (slot >= 0 && slot < SLOTS) {
      pac[di][slot] += parseFloat(row.pac_w)||0;
      cnt[di][slot]++;
    }
  });

  // Canvas zeichnen
  const nDays  = dates.length;
  const cellH  = Math.max(3, Math.floor(600 / nDays));
  const cellW  = Math.max(2, Math.floor(1200 / SLOTS));
  canvas.width  = SLOTS * cellW;
  canvas.height = nDays * cellH;
  canvas.style.height = Math.min(nDays * cellH, 600) + 'px';

  const ctx = canvas.getContext('2d');

  // Farbpalette: schwarz → dunkelgrün → grün → gelb → rot
  function pacToColor(w) {
    const t = Math.min(1, w / PAC_MAX);
    if (t < 0.001) return [8,9,10];
    if (t < 0.25)  { const u=t/0.25;    return [Math.round(8+u*18),   Math.round(9+u*65),  Math.round(10+u*36)]; }
    if (t < 0.5)   { const u=(t-.25)/.25;return [Math.round(26+u*37), Math.round(74+u*133),Math.round(46+u*96)]; }
    if (t < 0.75)  { const u=(t-.5)/.25; return [Math.round(63+u*182),Math.round(207-u*7), Math.round(142-u*76)]; }
    const u=(t-.75)/.25;               return [Math.round(245),Math.round(200-u*148),Math.round(66-u*66)];
  }

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  dates.forEach((date, di) => {
    for (let s = 0; s < SLOTS; s++) {
      const v = cnt[di][s] > 0 ? pac[di][s]/cnt[di][s] : 0;
      const [r,g,b] = pacToColor(v);
      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          const idx = ((di*cellH + py) * canvas.width + s*cellW + px) * 4;
          imgData.data[idx]   = r;
          imgData.data[idx+1] = g;
          imgData.data[idx+2] = b;
          imgData.data[idx+3] = 255;
        }
      }
    }
  });
  ctx.putImageData(imgData, 0, 0);

  // Monats-Trennlinien + Labels (Y-Achse)
  ctx.font = `${Math.min(10, cellH*0.8)}px DM Mono,monospace`;
  ctx.fillStyle = 'rgba(245,200,66,0.8)';
  let lastYM = '';
  dates.forEach((date, di) => {
    const ym = date.substring(0,7);
    if (ym !== lastYM) {
      ctx.fillStyle = 'rgba(245,200,66,0.4)';
      ctx.fillRect(0, di*cellH, canvas.width, 1);
      ctx.fillStyle = 'rgba(245,200,66,0.9)';
      ctx.fillText(ym, 4, di*cellH + Math.min(cellH, 12));
      lastYM = ym;
    }
  });

  // Stunden-Labels (X-Achse, oben)
  ctx.fillStyle = 'rgba(168,172,181,0.7)';
  ctx.font = '9px DM Mono,monospace';
  for (let h = 4; h <= 22; h += 2) {
    const x = h * 12 * cellW;
    ctx.fillText(`${String(h).padStart(2,'0')}:00`, x + 2, 10);
  }
}

function register() { APP.registerPage('tagesprofile', { html: HTML, onEnter }); }
return { register, tab, toggleMonth, selectAllMonths, clearMonths };
})();
