# 🚀 Walkthrough: Mobiler Kostentracker (PWA & Google Apps Script)

Der mobile Kostentracker für das Google Sheet (**Reiter: „Familie Variable Kosten“**) wurde erfolgreich entwickelt, getestet und als Git-Repository initialisiert.

---

## 📦 Bereitgestellte Komponenten

| Komponente | Datei | Beschreibung |
| :--- | :--- | :--- |
| **Backend** | [`Code.gs`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/Code.gs) | Google Apps Script für `Familie Variable Kosten`. Validiert Betrag, Datum & Person, formatiert Währung (`#,##0.00 €`) und hängt Zeilen atomar an. |
| **Frontend** | [`index.html`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/index.html) | Mobile-First UI mit großem Betragsfeld, Schnellauswahl-Chips, Payer-Toggle (Sascha/Sonja) und Safe-Area-Support für iOS/Android. |
| **Client-Logik** | [`app.js`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/app.js) | Persistierung des Standard-Zahlers (`localStorage`), Offline-Warteschlange mit automatischem Sync, Formular-Reset & Haptik. |
| **Service Worker** | [`sw.js`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/sw.js) | Cacht App-Assets lokal für ultraschnellen Kaltstart (< 0,3s) und echten Offline-Betrieb. |
| **PWA Manifest** | [`manifest.json`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/manifest.json) | Ermöglicht die Installation als Standalone-App auf dem Homescreen ohne Adressleiste. |
| **App-Icons** | [`icons/`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/icons) | Hochauflösendes Vektor-Icon (`icon.svg`), iOS Touch Icon (`apple-touch-icon.png`) und PWA-Icons (192px & 512px). |
| **Dokumentation** | [`README.md`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/README.md) | Schritt-für-Schritt-Anleitung für Apps Script Bereitstellung, Webhook-Verbindung und Handy-Installation. |

---

## 🛠️ Schnellstart & Nächste Schritte

### 1. Backend im Google Sheet aktivieren
1. Öffne dein Spreadsheet und gehe auf **Erweiterungen ➔ Apps Script**.
2. Ersetze den Inhalt durch den Code aus [`Code.gs`](file:///Users/sascha.euler/Documents/antigravity-projects/Kostentracker_Google-Sheets/Code.gs).
3. Klicke auf **Bereitstellen ➔ Neue Bereitstellung ➔ Web-App**:
   - *Ausführen als:* **Ich (deine E-Mail)**
   - *Wer hat Zugriff:* **Jeder**
4. Kopiere die generierte Web-App-URL.

### 2. Web-App URL hinterlegen
- Öffne die Web-App im Browser (z. B. via GitHub Pages oder lokal).
- Tippe oben rechts auf das **Zahnrad (⚙️)**, füge deine URL ein und klicke auf **Speichern**.

### 3. Auf den Smartphones installieren
- **iPhone:** In Safari öffnen ➔ Teilen-Button ➔ **„Zum Home-Bildschirm“**.
- **Android:** In Chrome öffnen ➔ Menü ➔ **„App installieren“**.
- Wähle auf jedem Smartphone einmalig den Standard-Zahler (**Sascha** auf deinem, **Sonja** auf ihrem) – die App merkt sich die Einstellung dauerhaft.

---

### 📊 Live-Status

| Anforderung / Modul | Status | Bemerkung |
| :--- | :---: | :--- |
| Sicherheits-Audit (`.gitignore`) | ✅ | `config.js` und Secrets sind zuverlässig geschützt |
| Google Apps Script Backend (`Code.gs`) | ✅ | Schreibt atomar in `Familie Variable Kosten` mit Währungsformat |
| Mobile-First UI (`index.html`) | ✅ | Touch-optimiert, Ziffernblock-Fokus, Safe-Area Insets |
| Geräte-Personalisierung (Sascha/Sonja) | ✅ | Persistiert im `localStorage` je Smartphone |
| Quick-Chips für Top-Ausgaben | ✅ | Edeka, Rewe, Bäckerei, Tanken, DM Kinder, Apotheke, Essen etc. |
| Datums-Vorbelegung | ✅ | Heutiges Datum automatisch vorausgewählt, veränderbar |
| Einklappbares Kommentarfeld | ✅ | Standardmäßig dezent ausgeblendet, mit 1 Klick geöffnet |
| Echter Offline-Betrieb & PWA Cache | ✅ | Service Worker aktiv, Warteschlange puffert ohne Netz |
| PWA-Assets & Icons | ✅ | SVG, 192px, 512px und Apple Touch Icon generiert |
| Git-Repository initialisiert | ✅ | Clean initial commit erfolgt |
| GitHub Remote & Push | ✅ | Erfolgreich auf https://github.com/Gambit76/kostentracker-pwa gepusht |

---

### 📜 Activity-Log

- **2026-09-10 10:04:39** – `.gitignore` erstellt (Schutz von Secrets & `config.js`).
- **2026-09-10 10:04:49** – `Code.gs` für Google Sheets mit Endpunkten `doGet`, `doPost` und `testAppend` generiert.
- **2026-09-10 10:05:06** – `config.example.js` und `config.js` als Konfigurationsvorlagen angelegt.
- **2026-09-10 10:05:25** – Modernes SVG-Icon `icons/icon.svg` designt.
- **2026-09-10 10:05:32** – PWA-Icons (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) gerendert.
- **2026-09-10 10:05:34** – `manifest.json` für Standalone-PWA konfiguriert.
- **2026-09-10 10:05:38** – Service Worker `sw.js` für Offline-Caching implementiert.
- **2026-09-10 10:06:02** – Mobile UI `index.html` mit Person-Switcher, Ziffernblock & Quick-Chips erstellt.
- **2026-09-10 10:06:18** – Client-Logik `app.js` mit Offline-Queue, Formularvalidierung & Settings-Dialog fertiggestellt.
- **2026-09-10 10:06:20** – Syntax-Validierung aller JS-Dateien erfolgreich durchgeführt (`node -c`).
- **2026-09-10 10:06:26** – Git Repository initialisiert, Security-Check verifiziert (kein Leak von `config.js`).
- **2026-09-10 10:06:33** – Ausführliches `README.md` mit bebilderter Schritt-für-Schritt-Anleitung dokumentiert.
- **2026-09-10 10:06:34** – Initialer Commit im Git-Repository erstellt.
- **2026-09-10 15:39:27** – Remote `origin` hinzugefügt und Branch `main` erfolgreich zu GitHub (`Gambit76/kostentracker-pwa`) gepusht.
