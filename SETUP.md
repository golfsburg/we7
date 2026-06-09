# Growatt → Supabase Auto-Import — Einrichtung

## Dateien in dein GitHub Repository kopieren

```
dein-repo/
├── .github/
│   └── workflows/
│       ├── growatt_import.yml         ← Täglicher Auto-Import
│       └── growatt_import_monat.yml   ← Manueller Monatsimport
├── growatt_import.py                  ← Tages-Script
└── growatt_import_monat.py            ← Monats-Script
```

## GitHub Secrets einrichten

Unter **Settings → Secrets and variables → Actions → New repository secret**:

| Secret Name    | Wert                                      |
|----------------|-------------------------------------------|
| GROWATT_USER   | golfsburg                                 |
| GROWATT_PASS   | kycbaf-niGpy2-wihmuz                      |
| SUPABASE_URL   | https://yhbdddzmymsfyxwxoiao.supabase.co  |
| SUPABASE_KEY   | (dein Supabase anon/service_role key)     |

Den Supabase Key findest du unter:
**Supabase → Project Settings → API → service_role key**

## Automatischer Tagesimport

Läuft **täglich um 23:30 UTC** (01:30 Uhr österreichischer Sommerzeit) automatisch.
Importiert den Ertrag des aktuellen Tages.

## Manueller Start

### Einzelnen Tag nachholen:
GitHub → Actions → "Growatt → Supabase Auto-Import" → Run workflow
→ Datum eingeben (YYYY-MM-DD) oder leer lassen für heute

### Ganzen Monat nachholen:
GitHub → Actions → "Growatt → Supabase Monatsimport" → Run workflow  
→ Monat eingeben (YYYY-MM), z.B. `2026-05`

## Supabase Tabelle

Die Tabelle `pv_entries` muss existieren (ist in der App unter
PV Ertrag → Import/Export → SQL vorhanden).

## Hinweis

Die IDs werden deterministisch aus dem Datum generiert (MD5-Hash),
damit bei erneutem Import keine Duplikate entstehen.
