"""
Growatt → Supabase Monatsimport
Importiert alle Tage eines Monats (5-Minuten-Werte → Tagessummen)
Manuell startbar via GitHub Actions mit Monat-Parameter
"""
import growattServer, os, sys, json, hashlib, calendar
from datetime import date, datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import time

GROWATT_USER = os.environ['GROWATT_USER']
GROWATT_PASS = os.environ['GROWATT_PASS']
SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY = os.environ['SUPABASE_KEY']

# IMPORT_MONTH: "YYYY-MM", default = aktueller Monat
IMPORT_MONTH = os.environ.get('IMPORT_MONTH', date.today().strftime('%Y-%m'))

def supabase_upsert(entries):
    url = f"{SUPABASE_URL}/rest/v1/pv_entries"
    data = json.dumps(entries).encode()
    req = Request(url, data=data, method='POST')
    req.add_header('apikey', SUPABASE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')
    try:
        with urlopen(req) as r:
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
login = api.login(GROWATT_USER, GROWATT_PASS)
uid      = login['user']['id']
plant_id = api.plant_list(uid)['data'][0]['plantId']
device   = api.device_list(plant_id)[0]
sn       = device['deviceSn']
print(f"✓ Login OK | Anlage: {plant_id} | WR: {sn}")

# ── Alle Tage des Monats ───────────────────────────────────
year, month = map(int, IMPORT_MONTH.split('-'))
days_in_month = calendar.monthrange(year, month)[1]
all_days = [date(year, month, d) for d in range(1, days_in_month + 1)]

print(f"\n📅 Importiere: {IMPORT_MONTH} ({days_in_month} Tage)\n")

entries     = []
skipped     = []
total_kwh   = 0

for day in all_days:
    # Nur vergangene Tage + heute
    if day > date.today():
        break
    
    date_str = day.strftime('%Y-%m-%d')
    try:
        data     = api.tlx_data(sn, date=day)
        etoday   = float(data.get('eToday', 0))
        etotal   = float(data.get('eTotal', 0))
        pac_data = data.get('invPacData', {})

        if not pac_data:
            print(f"  {date_str}: keine Daten")
            skipped.append(date_str)
            continue

        peak_pac = max((float(v) for v in pac_data.values()), default=0)

        if etoday == 0 and peak_pac > 0:
            pac_sum = sum(float(v) for v in pac_data.values())
            etoday  = round(pac_sum * (5/60) / 1000, 3)

        if etoday <= 0:
            print(f"  {date_str}: kein Ertrag")
            skipped.append(date_str)
            continue

        entries.append({
            "id":         gen_id(date_str),
            "type":       "day",
            "date":       date_str,
            "kwh":        round(etoday, 3),
            "peak":       round(peak_pac) if peak_pac > 0 else None,
            "hours":      None,
            "self_kwh":   None,
            "feed_kwh":   None,
            "weather":    "⛅",
            "temp":       None,
            "note":       f"Growatt API Auto-Import {IMPORT_MONTH}",
            "source":     "growatt",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        })
        total_kwh += etoday
        print(f"  {date_str}: {etoday} kWh | Peak: {round(peak_pac)} W")

        # Kurze Pause um API nicht zu überlasten
        time.sleep(0.5)

    except Exception as e:
        print(f"  {date_str}: Fehler — {e}")
        skipped.append(date_str)

# ── Batch-Upload nach Supabase ─────────────────────────────
if entries:
    print(f"\n💾 Schreibe {len(entries)} Einträge in Supabase...")
    # In 10er-Batches hochladen
    for i in range(0, len(entries), 10):
        batch = entries[i:i+10]
        ok = supabase_upsert(batch)
        if not ok:
            print(f"  ✗ Fehler bei Batch {i//10 + 1}")
            sys.exit(1)
    print(f"✓ {len(entries)} Einträge gespeichert")

print(f"\n✅ Monatsimport abgeschlossen")
print(f"   Tage mit Daten:  {len(entries)}")
print(f"   Übersprungen:    {len(skipped)}")
print(f"   Monatsertrag:    {round(total_kwh, 2)} kWh")
