# 📱 Kostentracker – Mobile Web-App (PWA) für Google Sheets

Eine minimalistische, blitzschnelle Progressive Web App (PWA) zur Erfassung von Haushaltsausgaben direkt in Google Sheets (Reiter: **„Familie Variable Kosten“**).

---

## ✨ Features
- **Mobile-First & Schnell:** Öffnet sich in unter 0,3 Sekunden, fühlt sich wie eine native App an.
- **Gerätepersonalisierung:** Merkt sich pro Smartphone den Standard-Erfasser (**Sascha** oder **Sonja**) via `localStorage`.
- **Großes Betragsfeld:** Automatische Öffnung des Ziffernblocks (`inputmode="decimal"`), Komma- und Punkt-Unterstützung.
- **Schnellwahl-Buttons (Chips):** Häufige Ausgaben (*Edeka, Rewe, Bäckerei, Tanken, DM Kinder, Apotheke, Essen, Kiosk, Café*) mit einem Fingertipp auswählen.
- **Datum vorausgefüllt:** Immer das aktuelle Tagesdatum (`DD.MM.YYYY`) mit „Heute“- und „Gestern“-Schnellwahl.
- **Dezentes Kommentarfeld:** Standardmäßig eingeklappt, bei Bedarf mit einem Klick geöffnet.
- **Offline-Fähig:** Einträge ohne Mobilfunknetz (z. B. im Supermarkt-Keller) werden lokal gepuffert und automatisch synchronisiert, sobald wieder Verbindung besteht.
- **Direkt ins Sheet:** Schreibt automatisch an das Ende der Tabelle und formatiert Betrag als Währung (`#,##0.00 €`) sowie Datum als formatiertes Datum.

---

## 🆕 Version 3.0 (Oktober 2026)
- **Typ-Umschalter Familie / Persönlich:** Schreibt in Spalte F „Typ“. Persönliche Kosten erscheinen in Lila und zählen **nicht** in der Pivot „Familie Übersicht var. Kosten“ (Filter: `Typ <> Persönlich`, leere Zellen = Familie).
- **Verlauf aus dem Sheet:** Letzte 150 Einträge, filterbar nach Typ, Person und Suchbegriff. Antippen öffnet **Bearbeiten / Löschen** (Zeile wird vorher geprüft, damit nie die falsche Zeile geändert wird).
- **Monatsübersicht:** Familienkosten je Person, Gesamt, **Ausgleich bei 50/50**, persönliche Kosten, Ø der letzten 12 Monate und 6-Monats-Trend.
- **Vorschläge & Chips aus echten Daten:** Die 10 häufigsten Positionen (je Typ, letzte 24 Monate) werden zu Schnellwahl-Chips, alle weiteren als Autovervollständigung.
- **Einheitliche Positionen:** „Edeka und Bäcker“, „Rewe+Bäcker“ usw. werden beim Speichern zu „Edeka + Bäckerei“ / „Rewe + Bäckerei“ (gleiche Regeln in `app.js` und `Code.gs`).
- **Sicherheits-Token Pflicht** für Lesen und Schreiben. **Betragsfix:** „1.234,56“ wird korrekt als 1.234,56 € gespeichert.
- **Doppelbuchungs-Schutz:** Einträge aus der Offline-Warteschlange tragen eine ID und werden nie doppelt geschrieben.

### Update von v2 auf v3
1. `Code.gs` (lokal, nicht im Git) komplett in den Apps-Script-Editor kopieren und speichern.
2. **Bereitstellen ➔ Bereitstellungen verwalten ➔ Stift ➔ Version: „Neue Version“ ➔ Bereitstellen.** (Nicht „Neue Bereitstellung“ – sonst ändert sich die URL.)
3. Frontend pushen (`git push`), GitHub Pages aktualisiert sich nach ~1 Minute.
4. In der App ⚙️ öffnen ➔ Token aus `Code.gs` (`SECRET_TOKEN`) eintragen ➔ „Verbindung testen“ ➔ Speichern.
5. „Setup-Link für Partnerin kopieren“ und an Sonja schicken – der Link enthält URL **und** Token.

---

## 🚀 Schritt-für-Schritt Einrichtung

### Schritt 1: Google Apps Script Backend einrichten
1. Öffne dein Google Sheet im Browser:
   `https://docs.google.com/spreadsheets/d/1eXKinN7XlZgBYFjYWvohMCboojTI4on0tAR-xp1M67U/`
2. Klicke im oberen Menü auf **Erweiterungen ➔ Apps Script**.
3. Lösche den vorhandenen Dummy-Code im Editor.
4. Kopiere den gesamten Inhalt aus der Datei [`Code.gs`](./Code.gs) und füge ihn ein.
5. Klicke auf das **Speichern-Symbol** (Diskette) oder drücke `Cmd + S`.
6. *(Optionaler Test)*: Wähle oben in der Funktionsliste `testReadData` aus und klicke auf **Ausführen**. Bestätige beim ersten Mal die Berechtigungsabfrage deines Google-Kontos. Im Ausführungsprotokoll erscheinen Anzahl Einträge, aktueller Monat und Top-Positionen (es wird nichts geschrieben).

### Schritt 2: Web-App bereitstellen
1. Klicke oben rechts auf den blauen Button **Bereitstellen ➔ Neue Bereitstellung**.
2. Wähle beim Zahnrad-Symbol links als Typ: **Web-App**.
3. Konfiguriere folgende Felder:
   - **Beschreibung:** `Kostentracker API`
   - **Ausführen als:** `Ich (deine E-Mail-Adresse)`
   - **Wer hat Zugriff:** `Jeder` *(Wichtig: Nur so kann deine Frau ohne Google-Login Daten über die Web-App senden!)*
4. Klicke auf **Bereitstellen**.
5. Kopiere die generierte **Web-App-URL** (sieht z. B. so aus: `https://script.google.com/macros/s/AKfycbx.../exec`).

---

### Schritt 3: Web-App mit dem Backend verbinden
Du hast zwei sehr bequeme Möglichkeiten:

- **Option A (Ohne Code-Änderung):** Öffne die Web-App im Browser, tippe oben rechts auf das **Zahnrad-Symbol (⚙️)**, füge die kopierte Web-App-URL ein und klicke auf **Speichern**.
- **Option B (Dauerhaft in der Datei):** Öffne [`config.js`](./config.js) und trage deine Web-App-URL bei `API_URL` ein.

---

### Schritt 4: Auf dem Smartphone installieren (PWA)

#### 🍏 Auf dem iPhone (Safari):
1. Öffne die URL der Web-App in **Safari**.
2. Tippe unten auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
3. Scrolle etwas nach unten und wähle: **„Zum Home-Bildschirm“** *(Add to Home Screen)*.
4. Wähle einmalig den Standard-Zahler (z. B. Sascha auf deinem Handy, Sonja auf ihrem). Die App merkt sich das dauerhaft.

#### 🤖 Auf Android (Chrome):
1. Öffne die URL der Web-App in **Google Chrome**.
2. Tippe oben rechts auf das Drei-Punkte-Menü und wähle: **„App installieren“** oder **„Zum Startbildschirm hinzufügen“**.

---

## 🌐 Hosting-Optionen für das Frontend

Da es sich um rein statische Webdateien (`HTML, CSS, JS, SVG`) handelt, kannst du die App kostenlos und ohne Server hosten:

1. **GitHub Pages (Empfohlen):**
   - Lade dieses Repository auf dein GitHub-Konto hoch.
   - Gehe in die Repo-Einstellungen ➔ *Pages* ➔ Branch: `main` ➔ Speichern.
   - Deine persönliche PWA-URL ist sofort weltweit erreichbar.
2. **Cloudflare Pages / Vercel / Netlify:**
   - Einfach den Projektordner per Drag & Drop oder Git verbinden (100% kostenlos).
3. **Lokal im Heimnetzwerk / Desktop:**
   - Zum Testen: `python3 -m http.server 8080` im Projektordner starten und `http://localhost:8080` aufrufen.
