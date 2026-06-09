"""
Growatt → Supabase Auto-Import
Läuft täglich via GitHub Actions
Importiert 5-Minuten-Werte des aktuellen Tages in pv_entries (Tagessumme)
"""
import growattServer, os, sys, json, hashlib
from datetime import date, datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Credentials aus Environment Variables ─────────────────
GROWATT_USER = os.environ['GROWATT_USER']
GROWATT_PASS = os.environ['GROWATT_PASS']
SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY = os.environ['SUPABASE_KEY']

# Optional: bestimmtes Datum importieren (YYYY-MM-DD), sonst heute
IMPORT_DATE  = os.environ.get('IMPORT_DATE', date.today().strftime('%Y-%m-%d'))

def supabase_request(method, path, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, method=method)
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')
    try:
        with urlopen(req) as r:
            return json.loads(r.read()) if r.read() else {}
    except HTTPError as e:
        print(f"  Supabase Error {e.code}: {e.read().decode()}")
        return None

def gen_id(date_str, source='growatt'):
    """Deterministische ID damit kein Duplikat entsteht"""
    return hashlib.md5(f"{source}-{date_str}".encode()).hexdigest()[:20]

# ── Growatt Login ──────────────────────────────────────────
print(f"🔌 Growatt Login...")
api = growattServer.GrowattApi()
api.server_url = "https://server-api.growatt.com/"
login = api.login(GROWATT_USER, GROWATT_PASS)
uid      = login['user']['id']
plant_id = api.plant_list(uid)['data'][0]['plantId']
device   = api.device_list(plant_id)[0]
sn       = device['deviceSn']
print(f"✓ Login OK | Anlage: {plant_id} | WR: {sn}")

# ── Tagesdaten holen ───────────────────────────────────────
export_date = date.fromisoformat(IMPORT_DATE)
print(f"\n📅 Importiere: {export_date}")

data    = api.tlx_data(sn, date=export_date)
etoday  = float(data.get('eToday', 0))
etotal  = float(data.get('eTotal', 0))
pac_data = data.get('invPacData', {})

if not pac_data:
    print(f"  ⚠ Keine Daten für {export_date}")
    sys.exit(0)

# Peak Pac bestimmen
peak_pac = max((float(v) for v in pac_data.values()), default=0)

# Wenn eToday=0 aber Pac-Daten vorhanden → aus Pac-Summe schätzen
if etoday == 0 and peak_pac > 0:
    pac_sum = sum(float(v) for v in pac_data.values())
    etoday  = round(pac_sum * (5/60) / 1000, 3)
    print(f"  ℹ eToday=0, geschätzt aus Pac-Summe: {etoday} kWh")

if etoday <= 0:
    print(f"  ⚠ Kein Ertrag für {export_date} (eToday={etoday})")
    sys.exit(0)

print(f"  ☀ Ertrag: {etoday} kWh | Peak: {round(peak_pac)} W | Gesamt: {etotal} kWh")

# ── In Supabase schreiben ──────────────────────────────────
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

print(f"\n💾 Schreibe in Supabase...")
result = supabase_request('POST', 'pv_entries', [entry])
if result is not None:
    print(f"✓ Eintrag gespeichert: {export_date} → {etoday} kWh")
else:
    print(f"✗ Fehler beim Speichern")
    sys.exit(1)

print(f"\n✅ Import abgeschlossen")
