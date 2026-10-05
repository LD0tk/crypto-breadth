# Krypto-Marktbreite gegenüber Bitcoin

Interaktiver Chart für 200 volatile Kryptowährungen: Top 10, 11–20, 21–50, 51–100 und 101–200. Tageswerte, SMA 7 und SMA 14 sind unabhängig schaltbar.

## Daten und Berechnung

CoinGecko-Kursdaten zwischen zwei UTC-Mitternachtspreisen. Marktbreite = Anteil der gültigen Coins einer Gruppe mit höherer Rendite als Bitcoin. Gleichstände zählen nicht. Fehlende Preise verkleinern den Nenner. Bitcoin, Stablecoin-Kategorien und tokenisierte Realwerte werden vor der Rangbildung entfernt. Klassifikation und Vollständigkeit hängen vom Datenanbieter ab.

Die historische Rekonstruktion verwendet die Auswahl und festen Ranggruppen vom 5. Oktober 2026: Sie enthält Survivorship Bias und keine originalgetreue historische Rangliste. Ab diesem Tag werden aktuelle Zusammensetzungen täglich gespeichert. SMA benötigt 7 bzw. 14 aufeinanderfolgende gültige Tageswerte. Die ausführliche Methodik steht unter dem Chart.

## Veröffentlichung und täglicher Lauf

Settings → Pages → Source: GitHub Actions. Der Workflow läuft täglich um 02:20 UTC (03:20 MEZ / 04:20 MESZ) sowie manuell über Actions. GitHub kann geplante Läufe verzögern. Für verlässlicheren Datenzugang unter Settings → Secrets and variables → Actions das Repository-Secret COINGECKO_DEMO_API_KEY anlegen. Schlüssel niemals in Dateien speichern.

Der Lauf prüft den Schlüssel, sammelt Tagesdaten, speichert sie in data.json und veröffentlicht nur die fünf statischen Webdateien. Bei einem Fehler bleiben die zuletzt veröffentlichten Daten erhalten. Pro regulärem Tag werden ungefähr 210 API-Anfragen benötigt. Gleiche Tagesbeobachtungen werden nicht überschrieben.

Die Webseite zeigt ihren Datenstand; der Browser prüft alle 15 Minuten auf neue Daten. Der tägliche Lauf funktioniert auch bei geschlossenem Browser.

## Lokale Berechnung

Node.js 22 oder neuer. Keine Paketinstallation nötig. Tests: `node --test math.test.mjs`. Datenlauf: `node update.mjs`.

Datenquelle: https://www.coingecko.com/en/api
