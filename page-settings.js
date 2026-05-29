// ═══════════════════════════════════════════════════════════
// PAGE-SETTINGS.JS
// ═══════════════════════════════════════════════════════════
const SETT = (() => {
'use strict';

const HTML = `
<div class="ph"><div>
  <div class="ph-title">⚙ Einstellungen</div>
  <div class="ph-sub">Standort · Anlage · Energiepreise</div>
</div></div>

<div class="fcard">
  <div class="fcard-t">📍 Standort & Anlage</div>
  <div class="fgrid">
    <div class="field"><label>Breitengrad</label><input type="number" id="s-lat" step="0.01"></div>
    <div class="field"><label>Längengrad</label><input type="number"  id="s-lon" step="0.01"></div>
    <div class="field"><label>Neigung (°)</label><input type="number" id="s-tilt" step="1" min="0" max="90"></div>
    <div class="field"><label>Ausrichtung</label>
      <select id="s-az">
        <option value="0">Süd (0°)</option>
        <option value="-45">Süd-West (-45°)</option>
        <option value="-90">West (-90°)</option>
        <option value="45">Süd-Ost (+45°)</option>
        <option value="90">Ost (+90°)</option>
        <option value="180">Nord</option>
      </select>
    </div>
    <div class="field"><label>Nennleistung (Wp)</label><input type="number" id="s-wp" step="10"></div>
    <div class="field"><label>Wechselrichter</label><input type="text" id="s-inv"></div>
  </div>
  <button class="btn-p" onclick="SETT.save()">Speichern & Neuberechnen</button>
  <div id="s-theory-summary" style="margin-top:14px"></div>
</div>

<div class="fcard">
  <div class="fcard-t">💶 Energiepreise</div>
  <div class="fgrid">
    <div class="field"><label>Bezugspreis (€/kWh)</label><input type="number" id="s-price" step="0.01"></div>
    <div class="field"><label>Einspeisung (€/kWh)</label><input type="number" id="s-feedrate" step="0.001"></div>
    <div class="field"><label>Eigenstromanteil (%)</label><input type="number" id="s-selfpct" step="5" min="0" max="100"></div>
  </div>
  <button class="btn-p" onclick="SETT.save()">Speichern</button>
  <div class="note">🇦🇹 Österreich 2024: OeMAG Einspeisetarif ~8,2 ct/kWh · Haushalt Ø ~30 ct/kWh</div>
</div>

<div class="fcard" style="border-color:rgba(91,156,246,.2)">
  <div class="fcard-t" style="font-size:13px;color:var(--tx2)">🔑 App-Info</div>
  <div style="font-size:12px;color:var(--tx2);line-height:2">
    Version: <strong style="color:var(--tx)">v4.0</strong><br>
    Wechselrichter: <strong style="color:var(--tx)" id="s-inv-display">—</strong><br>
    Supabase: <strong style="color:var(--gr)">✓ Verbunden (automatisch)</strong><br>
    Passwort: <strong style="color:var(--tx)">We7-Tracker-P!nggau</strong>
  </div>
</div>
`;

function loadUI() {
  const c = APP.cfg;
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.value=v; };
  set('s-lat',     c.lat);
  set('s-lon',     c.lon);
  set('s-tilt',    c.tilt);
  set('s-az',      c.az);
  set('s-wp',      c.wp);
  set('s-inv',     c.inv);
  set('s-price',   c.price);
  set('s-feedrate',c.feedRate);
  set('s-selfpct', c.selfPct);
  const disp = document.getElementById('s-inv-display');
  if (disp) disp.textContent = c.inv;
  updateTheorySummary();
}

function save() {
  const gv = id => { const el=document.getElementById(id); return el?el.value:null; };
  const gn = (id, def) => { const v=parseFloat(gv(id)); return isNaN(v)?def:v; };
  APP.setCfg({
    lat:     gn('s-lat',47.52),
    lon:     gn('s-lon',16.03),
    tilt:    gn('s-tilt',35),
    az:      gn('s-az',-45),
    wp:      gn('s-wp',800),
    inv:     gv('s-inv')||'Growatt NEO 800M-X',
    price:   gn('s-price',0.30),
    feedRate:gn('s-feedrate',0.082),
    selfPct: gn('s-selfpct',50)
  });
  APP.computeTheory();
  APP.savePv(false);
  APP.updateSidebar();
  updateTheorySummary();
  const disp = document.getElementById('s-inv-display');
  if (disp) disp.textContent = APP.cfg.inv;
  APP.toast('✓ Einstellungen gespeichert & Theorie neu berechnet');
}

function updateTheorySummary() {
  const t = APP.theory;
  const ann = t.reduce((a,b)=>a+b,0);
  const spec = Math.round(ann / APP.cfg.wp * 1000);
  const el = document.getElementById('s-theory-summary');
  if (!el) return;
  el.innerHTML = `<div class="note">
    📐 Jahresertrag theoretisch: <strong>${ann.toFixed(0)} kWh</strong>
    · Spezifisch: <strong>${spec} kWh/kWp</strong>
    · Österreich Ø: ~1000–1100 kWh/kWp<br>
    Monatswerte (kWh): ${APP.MONTHS.map((m,i)=>`<span style="color:var(--tx2)">${m}: ${t[i]}</span>`).join(' · ')}
  </div>`;
}

function register() {
  APP.registerPage('settings', {
    html: HTML,
    onEnter: loadUI
  });
}

return { save, register };
})();
