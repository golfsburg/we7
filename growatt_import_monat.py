"""
Growatt → Supabase Monatsimport
Schreibt BEIDE Tabellen:
  - pv_entries:   Tagessummen
  - growatt_5min: 5-Minuten-Werte für jeden Tag
"""
import growattServer, os, sys, json, hashlib, calendar, time
from datetime import date, datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

GROWATT_USER = os.environ['GROWATT_USER']
GROWATT_PASS = os.environ['GROWATT_PASS']
SUPABASE_URL = os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY = os.environ['SUPABASE_KEY']
IMPORT_MONTH = os.environ.get('IMPORT_MONTH', '') or date.today().strftime('%Y-%m')

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

print("🔌 Growatt Login...")
api = growattServer.GrowattApi()
api.server_url = "https://server-api.growatt.com/"
login    = api.login(GROWATT_USER, GROWATT_PASS)
uid      = login['user']['id']
plant_id = api.plant_list(uid)['data'][0]['plantId']
sn       = api.device_list(plant_id)[0]['deviceSn']
print(f"✓ Login OK | Anlage: {plant_id} | WR: {sn}")

year, month   = map(int, IMPORT_MONTH.split('-'))
days_in_month = calendar.monthrange(year, month)[1]
print(f"📅 Importiere: {IMPORT_MONTH} ({days_in_month} Tage)")

day_entries = []
total_5min  = 0
skipped     = []
total_kwh   = 0.0

for d in range(1, days_in_month + 1):
    day = date(year, month, d)
    if day > date.today(): break
    date_str = day.strftime('%Y-%m-%d')
    try:
        data     = api.tlx_data(sn, date=day)
        etoday   = float(data.get('eToday', 0))
        etotal   = float(data.get('eTotal', 0))
        pac_data = data.get('invPacData', {})

        if not pac_data:
            print(f"  {date_str}: keine Daten")
            skipped.append(date_str); continue

        peak_pac = max((float(v) for v in pac_data.values()), default=0)
        if etoday == 0 and peak_pac > 0:
            etoday = round(sum(float(v) for v in pac_data.values()) * (5/60) / 1000, 3)
        if etoday <= 0:
            print(f"  {date_str}: kein Ertrag")
            skipped.append(date_str); continue

        # Tagessumme
        day_entries.append({
            "id":         gen_id(f"growatt-{date_str}"),
            "type":       "day", "date": date_str,
            "kwh":        round(etoday, 3),
            "peak":       round(peak_pac) if peak_pac > 0 else None,
            "hours":      None, "self_kwh": None, "feed_kwh": None,
            "weather":    "⛅", "temp": None,
            "note":       f"Growatt Auto-Import {IMPORT_MONTH}",
            "source":     "growatt",
            "updated_at": datetime.utcnow().isoformat() + "Z"
        })

        # 5-Minuten-Werte
        rows_5min = []
        for ts, pac in sorted(pac_data.items()):
            try:
                dt = datetime.strptime(ts, "%Y-%m-%d %H:%M")
                rows_5min.append({
                    "id":         gen_id(f"5min-{ts}"),
                    "date":       date_str,
                    "ts":         dt.isoformat(),
                    "pac_w":      round(float(pac), 2),
                    "etoday_kwh": round(etoday, 3),
                    "etotal_kwh": round(etotal, 3)
                })
            except: pass

        # Upload 5min
        for i in range(0, len(rows_5min), 100):
            supabase_upsert('growatt_5min', rows_5min[i:i+100])
        total_5min += len(rows_5min)
        total_kwh  += etoday
        print(f"  {date_str}: {etoday} kWh | {len(rows_5min)} Messpunkte")
        time.sleep(0.5)

    except Exception as e:
        print(f"  {date_str}: Fehler — {e}")
        skipped.append(date_str)

# Tagessummen batch upload
if day_entries:
    print(f"\n💾 Schreibe {len(day_entries)} Tagessummen → pv_entries...")
    for i in range(0, len(day_entries), 10):
        if not supabase_upsert('pv_entries', day_entries[i:i+10]):
            print("✗ Fehler"); sys.exit(1)

print(f"\n✅ Fertig")
print(f"   Tage:        {len(day_entries)}")
print(f"   5min-Punkte: {total_5min}")
print(f"   Ertrag:      {round(total_kwh, 2)} kWh")
print(f"   Übersprungen: {len(skipped)}")
