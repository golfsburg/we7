"""
Growatt → Supabase Auto-Import
Schreibt BEIDE Tabellen:
  - pv_entries:        Tagessumme (1 Eintrag pro Tag)
  - growatt_5min:      5-Minuten-Werte (bis zu 288 Einträge pro Tag)
"""
import growattServer, os, sys, json, hashlib
from datetime import date, datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

GROWATT_USER = os.environ['GROWATT_USER']
GROWATT_PASS = os.environ['GROWATT_PASS']
SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY = os.environ['SUPABASE_KEY']
IMPORT_DATE  = os.environ.get('IMPORT_DATE', '') or date.today().strftime('%Y-%m-%d')

def supabase_upsert(table, rows):
    url  = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows).encode()
    req  = Request(url, data=data, method='POST')
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')
    try:
        with urlopen(req) as r:
            r.read(); return True
    except HTTPError as e:
        print(f"  Supabase Error {e.code} ({table}): {e.read().decode()}")
        return False

def gen_id(s):
    return hashlib.md5(s.encode()).hexdigest()[:20]

# ── Login ──────────────────────────────────────────────────
print("🔌 Growatt Login...")
api = growattServer.GrowattApi()
api.server_url = "https://server-api.growatt.com/"
login    = api.login(GROWATT_USER, GROWATT_PASS)
uid      = login['user']['id']
plant_id = api.plant_list(uid)['data'][0]['plantId']
sn       = api.device_list(plant_id)[0]['deviceSn']
print(f"✓ Login OK | Anlage: {plant_id} | WR: {sn}")

# ── Tagesdaten holen ───────────────────────────────────────
export_date = date.fromisoformat(IMPORT_DATE)
print(f"📅 Importiere: {export_date}")

data     = api.tlx_data(sn, date=export_date)
etoday   = float(data.get('eToday', 0))
etotal   = float(data.get('eTotal', 0))
pac_data = data.get('invPacData', {})

if not pac_data:
    print(f"⚠ Keine Daten für {export_date}")
    sys.exit(0)

peak_pac = max((float(v) for v in pac_data.values()), default=0)
if etoday == 0 and peak_pac > 0:
    etoday = round(sum(float(v) for v in pac_data.values()) * (5/60) / 1000, 3)
    print(f"ℹ eToday geschätzt: {etoday} kWh")
if etoday <= 0:
    print(f"⚠ Kein Ertrag für {export_date}")
    sys.exit(0)

print(f"☀ {etoday} kWh | Peak: {round(peak_pac)} W | {len(pac_data)} Messpunkte")

# ── 1. Tagessumme → pv_entries ────────────────────────────
day_entry = {
    "id":         gen_id(f"growatt-{export_date}"),
    "type":       "day",
    "date":       str(export_date),
    "kwh":        round(etoday, 3),
    "peak":       round(peak_pac) if peak_pac > 0 else None,
    "hours":      None, "self_kwh": None, "feed_kwh": None,
    "weather":    "⛅", "temp":     None,
    "note":       "Growatt API Auto-Import",
    "source":     "growatt",
    "updated_at": datetime.utcnow().isoformat() + "Z"
}
print("💾 Schreibe Tagessumme → pv_entries...")
if supabase_upsert('pv_entries', [day_entry]):
    print(f"✓ pv_entries: {export_date} → {etoday} kWh")
else:
    sys.exit(1)

# ── 2. 5-Minuten-Werte → growatt_5min ────────────────────
print("💾 Schreibe 5-Minuten-Werte → growatt_5min...")
rows_5min = []
for ts, pac in sorted(pac_data.items()):
    try:
        dt = datetime.strptime(ts, "%Y-%m-%d %H:%M")
        rows_5min.append({
            "id":         gen_id(f"5min-{ts}"),
            "date":       str(export_date),
            "ts":         dt.isoformat(),
            "pac_w":      round(float(pac), 2),
            "etoday_kwh": round(etoday, 3),
            "etotal_kwh": round(etotal, 3)
        })
    except Exception as e:
        print(f"  Skip {ts}: {e}")

# Batch-Upload je 100 Zeilen
ok_count = 0
for i in range(0, len(rows_5min), 100):
    batch = rows_5min[i:i+100]
    if supabase_upsert('growatt_5min', batch):
        ok_count += len(batch)
    else:
        print(f"  ⚠ Fehler bei Batch {i//100+1}")

print(f"✓ growatt_5min: {ok_count} Messpunkte gespeichert")
print("✅ Fertig")
