# BLE Scanner Companion

Ein leichtgewichtiger, lokal nutzbarer Web-Prototyp für BLE-Analysen.

## Funktionen
- JSON-Import von `device`, `location`, `device_to_location`
- Übersicht mit Geräte-/Standort-/Beobachtungsstatistiken
- Erweiterte Kennzahlen: aktive Tage, stärkster Hotspot, geschätzte Strecke pro Gerät
- Kartenansicht mit Methoden: Heatmap, Routenansicht, Punkte pro Erkennungstag
- Geräte-/Tagesfilter für die Karte (z. B. verschiedene Orte an unterschiedlichen Tagen)
- Timeline-Liste mit Detektionen pro Tag
- Geräte-Tabelle mit Suche und Inline-Bearbeitung (`name`, `tag`)
- Export der bearbeiteten Daten als JSON
- Darkmode-Switch (mit Speicherung der Auswahl im Browser)

## Schnellstart
Da die App keine Build-Tools benötigt, reicht ein statischer Server:

```bash
python3 -m http.server 4173
```

Dann im Browser öffnen:

- `http://localhost:4173`

## JSON-Format

```json
{
  "device": [{ "id": 1, "mac": "AA:BB:CC", "name": "Tracker", "tag": "office", "rssi": -65 }],
  "location": [{ "id": 100, "latitude": 52.52, "longitude": 13.40, "observed_at": 1713420210 }],
  "device_to_location": [{ "device_id": 1, "location_id": 100 }]
}
```
