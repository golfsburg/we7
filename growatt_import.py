"""
Growatt → Supabase Auto-Import
Läuft täglich via GitHub Actions
Verwendet growattServer==0.4.0
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

def supabase_upsert(entries):
    url  = f"{SUPABASE_URL}/rest/v1/pv_entries"
    data = json.dumps(entries).encode()
    req  = Request(url, data=data, method='POST')
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')
    try:
        with urlopen(req) as r:
            r.read()
            return True
    except HTTPError as e:
        print(f"  Supabase Error {e.code}: {e.read().decode()}")
        return False

def gen_id(date_str):
    return hashlib.md5(f"growatt-{date_str}".encode()).hexdigest()[:20]

# ── Login ──────────────────────────────────────────────────
print(f"🔌 Growatt Login...")
api = growattServer.GrowattApi()
api.server_url = "https://server-api.growatt.com/"
login    = api.login(GROWATT_USER, GROWATT_PASS)
uid      = login['user']['id']
plant_id = api.plant_list(uid)['data'][0]['plantId']
devices  = api.device_list(plant_id)
sn       = devices[0]['deviceSn']
print(f"✓ Login OK | Anlage: {plant_id} | WR: {sn}")

# ── Tagesdaten ─────────────────────────────────────────────
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
    pac_sum = sum(float(v) for v in pac_data.values())
    etoday  = round(pac_sum * (5/60) / 1000, 3)
    print(f"ℹ eToday geschätzt: {etoday} kWh")

if etoday <= 0:
    print(f"⚠ Kein Ertrag für {export_date}")
    sys.exit(0)

print(f"☀ {etoday} kWh | Peak: {round(peak_pac)} W | Gesamt: {etotal} kWh")

# ── Supabase ───────────────────────────────────────────────
entry = {
    "id":         gen_id(str(export_date)),
    "type":       "day",
    "date":       str(export_date),
    "kwh":        round(etoday, 3),
    "peak":       round(peak_pac) if peak_pac > 0 else None,
    "hours":      None,
    "self_kwh":   None,
    "feed_kwh":   None,
    "weather":    "⛅",
    "temp":       None,
    "note":       "Growatt API Auto-Import",
    "source":     "growatt",
    "updated_at": datetime.utcnow().isoformat() + "Z"
}

print(f"💾 Schreibe in Supabase...")
if supabase_upsert([entry]):
    print(f"✓ Gespeichert: {export_date} → {etoday} kWh")
else:
    print(f"✗ Fehler beim Speichern")
    sys.exit(1)

print(f"✅ Fertig")
