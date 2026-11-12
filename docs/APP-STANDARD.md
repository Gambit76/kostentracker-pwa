# App-Standard für Saschas PWAs

Gilt für **Kostentracker** (`Gambit76/kostentracker-pwa`), **Trainingslog** (`Gambit76/trainingslog`) und **Ernährungslog** (`Gambit76/ernaehrungslog`). Diese Datei liegt identisch in allen drei Repos unter `docs/APP-STANDARD.md`. Wer eine App ändert, hält sich daran; wer den Standard ändert, ändert die Datei in allen drei Repos.

Stand: 12.11.2026 (Kostentracker 3.10, Trainingslog v10, Ernährungslog v2)

## 1. Hell und Dunkel

- Das Design folgt **immer der Systemeinstellung des Geräts**. Kein eigener Umschalter in der App.
- Helle Palette steht in `:root`, die dunkle in `@media (prefers-color-scheme: dark){:root{…}}`. Dazu `color-scheme: light` bzw. `dark`, damit Datumsfelder und Auswahllisten mitziehen.
- Im `<head>` zwei `theme-color`-Metas (hell und dunkel, jeweils der Wert von `--bg`) und `apple-mobile-web-app-status-bar-style` = `default`.
- **Keine festen Farbwerte** in Regeln, im Markup oder im JavaScript. Farben kommen nur über Variablen. Ausnahme: `rgba(0,0,0,…)` für Schatten und den Dialog-Hintergrund.
- Jede neue Farbe bekommt einen hellen und einen dunklen Wert.

## 2. Farbvariablen

Gemeinsame Namen in allen Apps:

| Variable | Zweck |
|---|---|
| `--bg` | Seitenhintergrund |
| `--surface` | Karten, Dialoge |
| `--input` | Eingabefelder, Zeilen innerhalb von Karten |
| `--ink` | Text |
| `--muted` | Nebentext, Beschriftungen |
| `--line` | Rahmen, Trennlinien |
| `--accent`, `--accent-ink`, `--accent-soft` | Akzent, Text darauf, heller Akzentgrund |
| `--ok`, `--ok-soft` | Erfolg |
| `--warn`, `--warn-soft` | Fehler, Löschen |

Akzent je App:

- Trainingslog: Blau (`#1f47c7` hell, `#7d97ff` dunkel)
- Ernährungslog: Grün (`#17784a` hell, `#5fd096` dunkel)
- Kostentracker: Akzent wechselt mit dem Typ. Familie grün (`--c-fam`), Persönlich violett (`--c-per`), Reise blau (`--c-trip`), Gemeinsam einmalig gelb (`--c-shared`). Diese Typfarben sind Bedeutung, nicht Dekoration, und bleiben.

Die Neutralfarben (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--input`) von Trainingslog und Kostentracker sind identisch; das Ernährungslog hat dieselben Werte mit leichtem Grünstich.

## 3. Schrift und Form

- Schriften über Google Fonts, in allen Apps derselbe Link:
  - `--f-display`: Barlow Condensed (600, 700) für App-Titel, Überschriften, Hauptknopf
  - `--f-body`: IBM Plex Sans (400, 500, 600) für Text
  - `--f-num`: IBM Plex Mono (500) für Zahlen und Beträge
- App-Titel: Display-Schrift, Großbuchstaben, `clamp(24px, 7.5vw, 30px)`.
- Ecken: Karten 12 px, Knöpfe und Felder 8–10 px, Dialog oben 16 px.
- Karten: `--surface` mit 1 px `--line`, **keine Schatten**.
- Hauptknopf: `--accent`, Display-Schrift, Großbuchstaben, mindestens 48 px hoch.
- Eingabefelder mindestens 16 px Schriftgröße (sonst zoomt iOS).
- Dialoge öffnen als Blatt von unten (`<dialog>`, volle Breite, max. 640 px), Kopf mit Titel links und „Schließen“ rechts.

## 4. Einstellungen

- **Zahnrad oben rechts** neben dem App-Titel, 38 × 38 px, in allen Apps gleich.
- Der Dialog „Einstellungen“ hat in jeder App diese Abschnitte, in dieser Reihenfolge:
  1. **Verbindung**: „Verbindung testen“, Verbindung ändern (URL und Schlüssel/Token)
  2. App-spezifisches (z. B. Kostentracker: Schnellwahl, Setup-Link für Partnerin)
  3. **App**: Versionsnummer, „App-Cache leeren & aktualisieren“ mit dem Hinweis, dass Einträge und Verbindung erhalten bleiben
- „App-Cache leeren & aktualisieren“ löscht alle Caches, meldet den Service Worker ab und lädt neu. Offline wird es verweigert. `localStorage` (Verbindung, Warteschlange, Entwürfe) bleibt unberührt.
- Kein Einstellungs-Link im Seitenfuß.

## 5. Technik

- Reine statische PWA auf GitHub Pages, kein Build-Schritt. Daten liegen im Google Sheet, Zugriff über Google Apps Script (Web-App-URL + Schlüssel). Anfragen ans Apps Script gehen nie durch den Cache.
- Service Worker `sw.js`: Seite zuerst aus dem Netz (Updates kommen beim nächsten Öffnen an), offline aus dem Cache. Alte Caches werden beim Aktivieren gelöscht.
- **Versionsnummer bei jeder Änderung an der App hochzählen**, und zwar an allen Stellen der jeweiligen App:
  - Trainingslog, Ernährungslog: `APP_VERSION` in `index.html` und `VERSION` in `sw.js`
  - Kostentracker: `APP_VERSION` in `app.js`, `CACHE_NAME` in `sw.js`, `?v=` am `app.js`-Script-Tag in `index.html` und `tracker.html`
- Kostentracker: `tracker.html` ist eine Kopie von `index.html` mit anderem Manifest (ältere Installationen). Nach jeder Änderung an `index.html` neu erzeugen.
- Die Version wird nur im Einstellungsdialog angezeigt.

## 6. Bewusste Unterschiede

- Navigation: Kostentracker hat eine Leiste unten (Erfassen, Verlauf, Übersicht), die Logs haben Reiter oben. Bleibt so.
- Kostentracker zeigt den Verbindungsstatus als Plakette im Kopf, die Logs als Zeile mit „Aktualisieren“.
- Kostentracker nutzt Emojis als Symbole für Typen und Schnellwahl.
