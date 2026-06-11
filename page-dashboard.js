// ═══════════════════════════════════════════════════════════
// PAGE-DASHBOARD.JS
// ═══════════════════════════════════════════════════════════
const DASH = (() => {
'use strict';

const HTML = `
<div class="ph">
  <div><div class="ph-title">Dashboard</div><div class="ph-sub" id="db-sub">Energieübersicht</div></div>
</div>

<!-- Interaktive Zeitachse + Filter -->
<div id="db-timeline"></div>

<!-- Granularität -->
<div class="gran-bar" id="db-gran-bar">
  <label class="gran-lbl">Granularität</label>
  <label class="gran-opt"><input type="radio" name="db-gran" value="15min" onchange="DASH.render()"><span>15 Min</span></label>
  <label class="gran-opt"><input type="radio" name="db-gran" value="day" onchange="DASH.render()"><span>Tag</span></label>
  <label class="gran-opt active"><input type="radio" name="db-gran" value="month" checked onchange="DASH.render()"><span>Monat</span></label>
  <label class="gran-opt"><input type="radio" name="db-gran" value="year" onchange="DASH.render()"><span>Jahr</span></label>
</div>
<!-- KPI row -->
<div class="metrics">
  <div class="mc hi"><div class="mc-l">PV Ertrag</div><div><span class="mc-v" id="db-pv">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="db-pv2"></div></div>
  <div class="mc bl"><div class="mc-l">Netzbezug</div><div><span class="mc-v" id="db-grid">—</span><span class="mc-u">kWh</span></div><div class="mc-d" id="db-grid2"></div></div>
  <div class="mc"><div class="mc-l">Gesamtverbrauch</div><div><span class="mc-v" id="db-total">—</span><span class="mc-u">kWh</span></div><div class="mc-d">Netz + PV direkt</div></div>
  <div class="mc gr"><div class="mc-l">Autarkiegrad</div><div><span class="mc-v" id="db-autarky">—</span><span class="mc-u">%</span></div><div class="mc-d" id="db-autarky2"></div></div>
  <div class="mc"><div class="mc-l">Eigenverbrauch</div><div><span class="mc-v" id="db-selfuse">—</span><span class="mc-u">%</span></div><div class="mc-d">PV direkt genutzt</div></div>
  <div class="mc gr"><div class="mc-l">Ersparnis</div><div><span class="mc-v" id="db-saving">—</span><span class="mc-u">€</span></div><div class="mc-d pos" id="db-saving2"></div></div>
  <div class="mc"><div class="mc-l">Performance</div><div><span class="mc-v" id="db-pr">—</span><span class="mc-u">%</span></div><div class="mc-d" id="db-pr2"></div></div>
  <div class="mc pu"><div class="mc-l">CO₂ gespart</div><div><span class="mc-v" id="db-co2">—</span><span class="mc-u">kg</span></div><div class="mc-d">@ 0.4 kg/kWh</div></div>
</div>

<!-- Energy flow canvas -->
<div class="cc full" style="margin-bottom:14px">
  <div class="cc-title">⚡ Energiefluss</div>
  <div class="cc-sub">Echtzeit-Darstellung der Energieströme im gewählten Zeitraum</div>
  <canvas id="ef-canvas" style="width:100%;height:190px;display:block"></canvas>
</div>

<!-- Overlay chart -->
<div class="cc full" style="margin-bottom:14px">
  <div class="cc-title">Erzeugung · Verbrauch · Theoretische Einstrahlung</div>
  <div class="cc-sub">Überlagerte Darstellung — <span id="db-overlay-sub">Monatswerte</span></div>
  <div class="leg">
    <div class="li"><span class="ld" style="background:#f5c842"></span>PV Ertrag</div>
    <div class="li"><span class="ld" style="background:rgba(91,156,246,.7)"></span>Netzbezug</div>
    <div class="li"><span class="ld" style="background:rgba(63,207,142,.7)"></span>PV direkt</div>
    <div class="li"><span class="ld" style="background:rgba(255,180,40,.3);border:1px solid rgba(255,180,40,.6)"></span>Theor. Einstrahlung</div>
  </div>
  <div class="cw" style="height:270px"><canvas id="db-overlay"></canvas></div>
</div>

<!-- Bottom charts -->
<div class="cgrid">
  <div class="cc">
    <div class="cc-title">Autarkie-Verlauf</div>
    <div class="cc-sub">% Eigenversorgung pro Monat</div>
    <div class="cw" style="height:190px"><canvas id="db-autarky-chart"></canvas></div>
  </div>
  <div class="cc">
    <div class="cc-title">Energiebilanz</div>
    <div class="cc-sub">Verteilung im Zeitraum</div>
    <div class="cw" style="height:190px"><canvas id="db-donut"></canvas></div>
  </div>
  <div class="cc full">
    <div class="cc-title">Monatsvergleich — PV · Netzbezug · Eigenverbrauch</div>
    <div class="cc-sub">kWh pro Monat</div>
    <div class="leg">
      <div class="li"><span class="ld" style="background:#f5c842"></span>PV Ertrag</div>
      <div class="li"><span class="ld" style="background:rgba(91,156,246,.7)"></span>Netzbezug</div>
      <div class="li"><span class="ld" style="background:rgba(63,207,142,.7)"></span>Eigenverbrauch</div>
      <div class="li"><span class="ld" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2)"></span>Theor. Einstrahlung</div>
    </div>
    <div class="cw" style="height:220px"><canvas id="db-monthly"></canvas></div>
  </div>
</div>
`;

// ── FILTER LOGIC ─────────────────────────────────────────
function render() {
  APP.FilterBar.create('db-timeline', {
    onRange: (from, to) => renderCore(from, to)
  });
  const { from, to } = APP.FilterBar.getRange('db-timeline');
  renderCore(from, to);
}

function renderCore(from, to) {
  const entries = APP.entries;
  const consumption = APP.consumption;
  const gran = document.querySelector('input[name="db-gran"]:checked')?.value || 'month';

  const labelEl = document.getElementById('db-range-label');
  if (labelEl) labelEl.style.display = 'none';

  let pvD = entries.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
  let cvD = consumption.filter(c => c.direction==='grid' && (!from||c.date>=from) && (!to||c.date<=to));

  const pvTotal  = pvD.reduce((s,e) => s+e.kwh, 0);
  const thTotal  = pvD.reduce((s,e) => s+APP.getTheory(e), 0);
  const gridTotal= cvD.reduce((s,c) => s+c.kwh, 0);
  const direct   = APP.calcDirect(pvTotal, gridTotal);
  const totalC   = gridTotal + direct;
  const autarky  = totalC > 0 ? Math.round(direct/totalC*100) : 0;
  const selfUse  = pvTotal > 0 ? Math.round(direct/pvTotal*100) : 0;
  const pr       = thTotal > 0 ? Math.round(pvTotal/thTotal*100) : 0;
  const saving   = direct * APP.cfg.price;
  const co2      = pvTotal * 0.4;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const setC = (id, v, cls) => { const el=document.getElementById(id); if(el){el.textContent=v;el.className='mc-d '+cls;} };

  set('db-pv', pvTotal.toFixed(1));
  set('db-grid', gridTotal.toFixed(1));
  set('db-total', totalC.toFixed(1));
  set('db-autarky', autarky || '—');
  set('db-selfuse', selfUse || '—');
  set('db-saving', saving.toFixed(0));
  set('db-pr', pr || '—');
  set('db-co2', co2.toFixed(1));
  set('db-pv2', pvD.length + ' Einträge');
  set('db-grid2', cvD.length + ' Messpunkte');
  set('db-saving2', direct.toFixed(2) + ' kWh direkt genutzt');
  setC('db-autarky2', autarky>=50?'✓ Gut':autarky>=25?'~ Mittel':pvTotal>0?'⚠ Niedrig':'—',
    autarky>=50?'pos':autarky>=25?'':' neg');
  set('db-pr2', pr>=80?'✓ Gut':pr>=60?'~ Mittel':pr>0?'⚠ Niedrig':'—');

  drawFlow(pvTotal, gridTotal, direct, Math.max(0, pvTotal - direct));
  drawOverlay(from, to, gran);
  drawAutarkyLine();
  drawDonut(gridTotal, direct, Math.max(0, pvTotal - direct));
  drawMonthly();
  APP.updateSidebar();
}

// ── ENERGY FLOW ──────────────────────────────────────────
function drawFlow(pv, grid, direct, feed) {
  const canvas = document.getElementById('ef-canvas'); if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = 190;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.clearRect(0,0,W,H);

  const nodes = [
    { x:W*.10, y:H*.5, col:'#f5c842', label:'☀  Sonne', val:pv.toFixed(1) },
    { x:W*.35, y:H*.5, col:'#f5c842', label:'◉  PV',    val:pv.toFixed(1) },
    { x:W*.62, y:H*.5, col:'#3fcf8e', label:'⌂  Haus',  val:(grid+direct).toFixed(1) },
    { x:W*.88, y:H*.25, col:'#5b9cf6',label:'≋  Netz',  val:grid.toFixed(1) }
  ];
  if (feed > 0.01)
    nodes.push({ x:W*.88, y:H*.75, col:'rgba(245,200,66,.75)', label:'↑  Einsp.', val:feed.toFixed(1) });

  const R = 30;
  function arrow(x1,y1,x2,y2,col,kwh) {
    if (kwh <= 0.01) return;
    const ang = Math.atan2(y2-y1, x2-x1);
    const thick = Math.max(1.5, Math.min(5, kwh/60));
    ctx.beginPath();
    ctx.moveTo(x1 + R*Math.cos(ang), y1 + R*Math.sin(ang));
    ctx.lineTo(x2 - R*Math.cos(ang), y2 - R*Math.sin(ang));
    ctx.strokeStyle = col; ctx.lineWidth = thick;
    ctx.setLineDash([5,4]); ctx.globalAlpha = .75; ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // label
    ctx.fillStyle = col; ctx.font = '10px DM Mono,monospace';
    ctx.textAlign = 'center'; ctx.globalAlpha = .9;
    ctx.fillText(kwh.toFixed(1)+' kWh', (x1+x2)/2, (y1+y2)/2 - 8);
    ctx.globalAlpha = 1;
  }

  arrow(nodes[0].x,nodes[0].y, nodes[1].x,nodes[1].y, '#f5c842', pv);
  arrow(nodes[1].x,nodes[1].y, nodes[2].x,nodes[2].y, '#3fcf8e', direct);
  arrow(nodes[3].x,nodes[3].y, nodes[2].x,nodes[2].y, '#5b9cf6', grid);
  if (feed > 0.01)
    arrow(nodes[1].x,nodes[1].y, nodes[nodes.length-1].x,nodes[nodes.length-1].y, 'rgba(245,200,66,.5)', feed);

  nodes.forEach(n => {
    ctx.beginPath(); ctx.arc(n.x, n.y, R, 0, Math.PI*2);
    ctx.fillStyle = n.col + '1a'; ctx.fill();
    ctx.strokeStyle = n.col; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = n.col; ctx.font = 'bold 11px Syne,sans-serif';
    ctx.textAlign = 'center'; ctx.fillText(n.label, n.x, n.y - 7);
    ctx.fillStyle = '#f5f5f2'; ctx.font = 'bold 10px DM Mono,monospace';
    ctx.fillText(n.val + ' kWh', n.x, n.y + 9);
  });
}

// ── OVERLAY CHART ────────────────────────────────────────
function drawOverlay(from, to, gran='month') {
  APP.destroyChart('db-ov');
  const entries = APP.entries, consumption = APP.consumption;

  // Filter by date range
  const pvFiltered = entries.filter(e => (!from||e.date>=from)&&(!to||e.date<=to));
  const cvFiltered = consumption.filter(c => c.direction==='grid'&&(!from||c.date>=from)&&(!to||c.date<=to));

  let labels=[], pvArr=[], gridArr=[], thArr=[];

  if (gran === '15min') {
    // 15-minute smart meter values — only CV data
    const sorted = [...cvFiltered].sort((a,b)=>a.date!==b.date?a.date.localeCompare(b.date):a.hour-b.hour||a.minute-b.minute);
    labels   = sorted.map(c=>`${c.date} ${String(c.hour).padStart(2,'0')}:${String(c.minute).padStart(2,'0')}`);
    gridArr  = sorted.map(c=>+c.kwh.toFixed(4));
    pvArr    = sorted.map(()=>0);
    thArr    = [];
  } else if (gran === 'day') {
    // Daily values
    const allDays = [...new Set([
      ...pvFiltered.map(e=>e.date),
      ...cvFiltered.map(c=>c.date)
    ])].sort();
    labels   = allDays.map(d => {
      const dt = new Date(d+'T00:00:00');
      return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`;
    });
    pvArr    = allDays.map(d => +pvFiltered.filter(e=>e.date===d).reduce((s,e)=>s+e.kwh,0).toFixed(2));
    gridArr  = allDays.map(d => +cvFiltered.filter(c=>c.date===d).reduce((s,c)=>s+c.kwh,0).toFixed(2));
    thArr    = allDays.map(d => +(APP.theory[new Date(d+'T00:00:00').getMonth()] / 30).toFixed(2));
  } else if (gran === 'month') {
    // Monthly values (default)
    const allM = [...new Set([
      ...pvFiltered.map(e=>e.date.substring(0,7)),
      ...cvFiltered.map(c=>c.date.substring(0,7))
    ])].sort();
    labels   = allM.map(m=>APP.MONTHS[new Date(m+'-01').getMonth()]+' '+m.substring(2,4));
    pvArr    = allM.map(m=>{
      const me=entries.find(e=>e.type==='month'&&e.date===m+'-01');
      if (me) return +me.kwh.toFixed(2);
      return +pvFiltered.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.kwh,0).toFixed(2);
    });
    gridArr  = allM.map(m=>+cvFiltered.filter(c=>c.date.startsWith(m)).reduce((s,c)=>s+c.kwh,0).toFixed(2));
    thArr    = allM.map(m=>APP.theory[new Date(m+'-01').getMonth()]||0);
  } else if (gran === 'year') {
    // Yearly values
    const allY = [...new Set([
      ...pvFiltered.map(e=>e.date.substring(0,4)),
      ...cvFiltered.map(c=>c.date.substring(0,4))
    ])].sort();
    labels   = allY;
    pvArr    = allY.map(y=>+pvFiltered.filter(e=>e.date.startsWith(y)).reduce((s,e)=>s+e.kwh,0).toFixed(1));
    gridArr  = allY.map(y=>+cvFiltered.filter(c=>c.date.startsWith(y)).reduce((s,c)=>s+c.kwh,0).toFixed(1));
    thArr    = allY.map(y=>+APP.theory.reduce((s,v)=>s+v,0).toFixed(0));
  }

  if (!labels.length) return;

  const directArr = pvArr.map((_,i) => +APP.calcDirect(pvArr[i], gridArr[i]).toFixed(2));
  const datasets = [
    { type:'bar',  label:'PV Ertrag',  data:pvArr,    backgroundColor:'rgba(245,200,66,.8)',  borderRadius:2, order:2 },
    { type:'bar',  label:'Netzbezug',  data:gridArr,  backgroundColor:'rgba(91,156,246,.65)', borderRadius:2, order:3 },
    { type:'bar',  label:'PV direkt',  data:directArr,backgroundColor:'rgba(63,207,142,.65)', borderRadius:2, order:4 }
  ];
  if (gran !== '15min' && thArr.length) {
    datasets.push({ type:'line', label:'Theor.', data:thArr, borderColor:'rgba(255,180,40,.6)',
      backgroundColor:'rgba(255,180,40,.08)', fill:true, tension:0.4, pointRadius:2, borderWidth:1.5, order:1 });
  }

  const titleMap = { '15min':'15-Minuten-Werte', day:'Tageswerte', month:'Monatswerte', year:'Jahreswerte' };
  const subEl = document.getElementById('db-overlay-sub');
  if (subEl) subEl.textContent = titleMap[gran] || '';

  APP.charts['db-ov'] = new Chart(document.getElementById('db-overlay'), {
    data: { labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{color:APP.TC,font:{size:gran==='15min'?8:10},maxRotation:gran==='15min'?45:0,maxTicksLimit:gran==='15min'?24:undefined}, grid:{color:APP.GC} },
        y:{ ticks:{color:APP.TC,font:{size:10}}, grid:{color:APP.GC} }
      } }
  });
}

// ── AUTARKY LINE ─────────────────────────────────────────
function drawAutarkyLine() {
  APP.destroyChart('db-au-line');
  const months = [...new Set(APP.entries.map(e=>e.date.substring(0,7)))].sort();
  if (!months.length) return;
  const labels = months.map(m => APP.MONTHS[new Date(m+'-01').getMonth()]);
  const data = months.map(m => {
    const pv   = APP.entries.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.kwh,0);
    const grid = APP.consumption.filter(c=>c.date.startsWith(m)&&c.direction==='grid').reduce((s,c)=>s+c.kwh,0);
    const d = APP.calcDirect(pv, grid), tot = grid + d;
    return tot > 0 ? Math.round(d/tot*100) : 0;
  });
  APP.charts['db-au-line'] = new Chart(document.getElementById('db-autarky-chart'), {
    type:'line',
    data:{ labels, datasets:[{ data, borderColor:'#3fcf8e', backgroundColor:'rgba(63,207,142,.1)',
      fill:true, tension:0.35, pointRadius:3, borderWidth:1.5, pointBackgroundColor:'#3fcf8e' }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{min:0,max:100,ticks:{color:APP.TC,font:{size:10},callback:v=>v+'%'},grid:{color:APP.GC}} } }
  });
}

// ── DONUT ────────────────────────────────────────────────
function drawDonut(grid, direct, feed) {
  APP.destroyChart('db-dn');
  APP.charts['db-dn'] = new Chart(document.getElementById('db-donut'), {
    type:'doughnut',
    data:{ labels:['Netzbezug','PV Eigenverbrauch','PV Einspeisung'],
      datasets:[{ data:[+grid.toFixed(2),+direct.toFixed(2),+feed.toFixed(2)],
        backgroundColor:['rgba(91,156,246,.75)','rgba(63,207,142,.75)','rgba(245,200,66,.65)'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
      plugins:{ legend:{ labels:{ color:APP.TC, font:{size:11}, boxWidth:10 } },
        tooltip:{ callbacks:{ label:ctx=>ctx.parsed.toFixed(2)+' kWh' } } } }
  });
}

// ── MONTHLY BAR ──────────────────────────────────────────
function drawMonthly() {
  APP.destroyChart('db-mon');
  const months = [...new Set([
    ...APP.entries.map(e=>e.date.substring(0,7)),
    ...APP.consumption.map(c=>c.date.substring(0,7))
  ])].sort();
  if (!months.length) return;
  const labels   = months.map(m => APP.MONTHS[new Date(m+'-01').getMonth()] + ' ' + m.substring(2,4));
  const pvArr    = months.map(m => +APP.entries.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.kwh,0).toFixed(2));
  const gridArr  = months.map(m => +APP.consumption.filter(c=>c.date.startsWith(m)&&c.direction==='grid').reduce((s,c)=>s+c.kwh,0).toFixed(2));
  const directArr= months.map((_,i) => +APP.calcDirect(pvArr[i],gridArr[i]).toFixed(2));
  const thArr    = months.map(m => APP.theory[new Date(m+'-01').getMonth()] || 0);

  APP.charts['db-mon'] = new Chart(document.getElementById('db-monthly'), {
    data:{ labels, datasets:[
      { type:'bar',  label:'PV Ertrag',    data:pvArr,    backgroundColor:'rgba(245,200,66,.8)',  borderRadius:3 },
      { type:'bar',  label:'Netzbezug',    data:gridArr,  backgroundColor:'rgba(91,156,246,.65)', borderRadius:3 },
      { type:'bar',  label:'Eigenverbrauch',data:directArr,backgroundColor:'rgba(63,207,142,.7)', borderRadius:3 },
      { type:'line', label:'Theor.',       data:thArr,    borderColor:'rgba(255,255,255,.2)',
        backgroundColor:'transparent', fill:false, tension:0.4, pointRadius:2, borderWidth:1.5,
        borderDash:[4,3] }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ x:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}},
               y:{ticks:{color:APP.TC,font:{size:10}},grid:{color:APP.GC}} } }
  });
}

function register() {
  APP.registerPage('dashboard', {
    html: HTML,
    onEnter: () => render()
  });
}

return { render, register };
})();
