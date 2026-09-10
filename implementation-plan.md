# 📱 Konzept & Implementierungsplan: Mobiler Kostentracker (PWA)

Dieser Plan beschreibt die schlüsselfertige Umsetzung einer extrem schnellen, mobilen PWA (Progressive Web App) zur Erfassung von Haushaltsausgaben, die direkt in den Google-Sheets-Reiter **„Familie Variable Kosten“** schreibt.

---

## 🎯 Zielsetzung & Kernanforderungen
- **Frontend:** Installierbare Mobile-First Web-App (PWA) für iOS (Safari) und Android (Chrome).
- **Benutzererfahrung:**
  - Sofort einsatzbereit (< 0,3 Sek. Ladezeit, Standalone-Modus ohne Browserleiste).
  - Standard-Erfasser (Sascha vs. Sonja) wird lokal auf dem Smartphone gemerkt (Gerätepersonalisierung).
  - Große, touch-freundliche Betragseingabe mit Ziffernblock.
  - Datum automatisch mit dem heutigen Tag vorbelegt (`DD.MM.YYYY`).
  - Schnellwahl-Buttons (Chips) für häufige Ausgaben (*Edeka, Rewe, Bäckerei, Tanken, DM, Apotheke, Essen, Kiosk*).
  - Dezent eingeklapptes optionales Kommentarfeld.
  - Offline-Fähigkeit: Bei fehlendem Netz (z. B. Keller/Supermarkt) werden Einträge lokal gepuffert und bei Wiederverbindung synchronisiert.
- **Backend:** Google Apps Script Webhook (`doPost`) direkt im Spreadsheet, der die Zeile am Ende anfügt und formatiert.
- **Sicherheit:** Sheet-Zugriff bleibt privat; Authentifizierung via Secret-Token zwischen Frontend und Script; Check der `.gitignore`.

---

## 🏗️ Architektur & Komponenten

### 1. Backend: Google Apps Script (`Code.gs`)
- **Ablage:** Direkt im Google Sheet unter *Erweiterungen ➔ Apps Script*.
- **Funktionsweise:**
  - `doPost(e)`: Liest JSON-Payload (`{ position, amount, date, paidBy, comment, token }`).
  - Validierung des Sicherheits-Tokens.
  - Ziel-Tabellenblatt: `Familie Variable Kosten`.
  - Hängt Zeile an: `[position, amount, date, paidBy, comment]`.
  - Formatierung: Betrag als Währung (`#,##0.00 €`), Datum als formatiertes Datum.
  - Gibt JSON `{ success: true, timestamp: ... }` mit CORS-kompatiblen Headern zurück.

### 2. Frontend: Progressive Web App (PWA)
- **Dateistruktur im Projekt-Root:**
  - `index.html`: Semantisches, barrierefreies Mobile-First UI (Tailwind CSS via Modern CDN / Vanilla CSS, iOS Safe-Area Insets).
  - `app.js`: Client-Logik (State Management für Zahler, Offline-Queue in `localStorage`, Betrags-Parsing, API-Aufruf).
  - `sw.js`: Service Worker für vollständiges Offline-Caching der App-Hülle.
  - `manifest.json`: PWA-Konfiguration (Icons, Theme-Color, `display: standalone`).
  - `icons/`: Icons für Homescreen & Splashscreen (Apple Touch Icon & Android PWA Icons).
  - `config.example.js` / `.env.example`: Template für Webhook-URL & Secret-Token.
  - `.gitignore`: Ausschluss sensibler Konfigurationsdateien.

---

## 🔒 Security Audit & Datenschutz
- Vor Bereitstellung des Codes wird eine `.gitignore` angelegt, die `config.js` oder `.env` mit der privaten Webhook-URL / Secret schützt.
- Die allgemeine Freigabe des Google Sheets („Jeder mit dem Link“) kann **ab sofort** wieder auf „Eingeschränkt“ gesetzt werden. Das Apps Script führt die Schreibvorgänge als Tabelleninhaber aus.

---

## 📋 Schritt-für-Schritt Ausführungsplan

### Schritt 1: Sicherheits-Vorbereitung & Repository-Setup
- Erstellen von `.gitignore` zum Schutz von Secrets und Umgebungsvariablen.

### Schritt 2: Google Apps Script Backend (`Code.gs`)
- Bereitstellung des optimierten Apps-Script-Codes inklusive:
  - Header-Matching für Spalten `Position`, `Betrag`, `Datum`, `Bezahlt von`, `Kommentar`.
  - Korrekte Währungs- und Datumsformatierung.
  - Token-basierter Schutz vor unbefugten Aufrufen.
- Schritt-für-Schritt-Anleitung zur Bereitstellung als Web-App im Google Sheet.

### Schritt 3: PWA Frontend-Entwicklung
- Erstellung von `index.html` mit optimiertem Mobile-Layout:
  - Header mit Person-Toggle (Sascha / Sonja) & Offline-Statusanzeige.
  - Betragsfeld (große Typografie, Fokus bei Start, automatisches Komma/Punkt-Handling).
  - Schnellauswahl-Chips für Top-Kategorien.
  - Datums-Input (Standard: Heute, veränderbar).
  - Eingeklapptes Akkordeon für „Kommentar hinzufügen“.
  - Großer "Speichern"-Button mit Spinner und Erfolgs-Animation.
- Erstellung von `app.js` mit lokaler Offline-Queue und synchronisierendem Fetch.
- Erstellung von `sw.js` und `manifest.json` für vollen PWA-Homescreen-Support.

### Schritt 4: Deployment-Optionen für die PWA
- Bereitstellung der statischen PWA über wahlweise:
  - **GitHub Pages** (direkt aus dem Git-Repo, vollautomatisch)
  - oder **Cloudflare Pages / Vercel** (Drag & Drop oder Git)
- Anleitung zur einfachen Installation auf iPhone (Safari ➔ „Zum Home-Bildschirm“) und Android (Chrome ➔ „App installieren“).

---

## 🧪 Verifikationsplan
1. **API / Script Test:** Test-POST an die Apps Script Web App senden und verifizieren, dass die Zeile mit korrekten Typen in `Familie Variable Kosten` geschrieben wird.
2. **UI & Personalisierung:** Umschalten zwischen Sascha und Sonja, Seite neu laden, prüfen ob Auswahl im `localStorage` erhalten bleibt.
3. **Schnellauswahl & Freitext:** Klick auf Schnellwahl-Chip füllt das Positionsfeld; manuelle Eingabe funktioniert identisch.
4. **Offline-Sync:** Netzwerk trennen (Flugmodus), Buchung absenden ➔ Prüfen, ob „Offline gespeichert“ signalisiert wird; Netzwerk aktivieren ➔ Prüfen, ob Eintrag automatisch im Sheet ankommt.

---

### 📜 Change-Log
- **v1.0 (Initial):** Festlegung auf Architektur-Variante B (PWA + Apps Script API); Spaltenstruktur aus Live-Sheet übernommen; Gerätepersonalisierung (Sascha/Sonja), Quick-Chips und eingeklapptes Kommentarfeld integriert.
