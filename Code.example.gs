/**
 * =========================================================================
 * Kostentracker Google Apps Script Backend  (v3.5 – Nov. 2026)
 * Tabellenblatt: "Familie Variable Kosten"
 * Spalten: A Position | B Betrag | C Datum | D Bezahlt von | E Kommentar | F Typ | G Reise | H ID | I Sonder
 *
 * Neu in v3.9:
 *  - Reiter im Finanzplan heißt „Gemeinsame Sonderzahlungen“ (alter Name „Gemeinsame Anschaffungen“
 *    wird weiter erkannt); Saldo wird über die Beschriftung „Saldo gesamt“ gefunden.
 *  - Der Typ heißt in der App „Gemeinsam einmalig“, gespeichert wird weiter „Anschaffung“.
 *
 * Neu in v3.8:
 *  - Finanzplan-Spalten heißen jetzt „Persönlich laufend“ und „Persönlich Sonderausgaben“;
 *    alte Namen werden weiterhin erkannt.
 *
 * Neu in v3.7:
 *  - Reisen in der App zeigen den offenen Ausgleich aus dem Sheet „Reisen“ (Dashboard Reisen,
 *    Spalte „Ausgleich offen“), also inkl. bereits erstatteter Posten. Ohne REISEN_ID wie bisher.
 *  - PRIVATE_TOKEN ist optional: leer lassen = Finanzplan mit dem normalen Token.
 *    Sobald jemand anderes die App nutzt, ein eigenes PRIVATE_TOKEN setzen.
 *
 * Neu in v3.6:
 *  - Aktion "plan": liest Saschas privaten Finanzplan (eigenes Google Sheet) und liefert
 *    Freiraum, Topf und Monatswerte an die App (Übersicht → Finanzplan).
 *    Nur mit zusätzlichem PRIVATE_TOKEN – den bekommt nur Saschas Handy, nicht der Setup-Link.
 *  - Nach dem Einfügen einmal im Editor "testFinanzplan" ausführen und den Zugriff
 *    auf das Finanzplan-Sheet erlauben.
 *
 * Neu in v3.5:
 *  - Spalte I "Sonder" (Checkbox): Persönlich Sonderausgabe (z. B. Hanteln,
 *    großes Geschenk). Nur bei Typ "Persönlich" möglich. Der Finanzplan zählt solche
 *    Einträge nicht in die Alltagskosten, sondern separat als Sonderausgabe.
 *  - Ältere App-Versionen ohne Sonder-Feld lassen einen gesetzten Haken beim Bearbeiten unverändert.
 *
 * Neu in v3.3:
 *  - Typ "Anschaffung" für gemeinsame Anschaffungen (Möbel, TV, Haushaltsgeräte …):
 *    zählt NICHT im monatlichen Familien-Ausgleich, wird aber je zur Hälfte den
 *    Monatskosten von Sascha und Sonja zugerechnet (Antwort-Feld months[].shared)
 *
 * Neu in v3.2:
 *  - Spalte H "ID": feste, fortlaufende Nummer je Eintrag. Bearbeiten und Löschen
 *    finden die Zeile über die ID statt über die Zeilennummer (sortieren/einfügen
 *    im Sheet ist damit unkritisch). Zeilen ohne ID (z. B. von Hand im Sheet
 *    ergänzt) bekommen beim nächsten Laden automatisch eine.
 *
 * Neu in v3.1:
 *  - Typ "Reise" mit Reisename in Spalte G (z. B. "2026-10 Teneriffa")
 *  - Reise-Kosten zählen NICHT in den monatlichen Familien-Ausgleich,
 *    sondern werden pro Reise summiert (Antwort-Feld "trips")
 *  - Verlauf liefert mindestens die Einträge der letzten 3 Monate
 *    (für den Monatsabschluss in der App)
 *
 * Neu in v3:
 *  - Spalte F "Typ": "Familie" (geteilte Kosten) oder "Persönlich"
 *    (leere Zellen in alten Zeilen zählen als "Familie")
 *  - Lesen: Verlauf, Monatsübersicht inkl. Ausgleich, Positions-Vorschläge
 *  - Bearbeiten & Löschen von Einträgen (mit Prüfung, ob die Zeile noch passt)
 *  - Vereinheitlichung der Positionsnamen beim Speichern
 *  - Pflicht-Token für alle Lese- und Schreibzugriffe
 *  - Robuster Betragsparser (1.234,56 / 1234.56 / 12,5)
 *  - Schutz vor Doppelbuchungen aus der Offline-Warteschlange
 *
 * WICHTIG nach dem Einfügen: Bereitstellen ➔ Bereitstellungen verwalten ➔
 * Bearbeiten (Stift) ➔ Version: "Neue Version" ➔ Bereitstellen.
 * So bleibt die bisherige Web-App-URL gültig.
 * =========================================================================
 */

const CONFIG = {
  SHEET_NAME: "Familie Variable Kosten",
  SECRET_TOKEN: "HIER_TOKEN_EINTRAGEN", // eigenes Token eintragen (identisch mit ⚙️ in der App) – NIE committen
  PRIVATE_TOKEN: "", // optional: eigenes Token nur für den Finanzplan (⚙️ „Privat-Token“). Leer = normales Token gilt. NIE committen
  FINANZPLAN_ID: "HIER_FINANZPLAN_SHEET_ID_EINTRAGEN", // ID aus der URL des Sheets „Finanzplan“
  REISEN_ID: "HIER_REISEN_SHEET_ID_EINTRAGEN", // ID aus der URL des Sheets „Reisen“ (für den Reise-Ausgleich)
  TYPES: ["Familie", "Persönlich", "Reise", "Anschaffung"],
  DEFAULT_TYPE: "Familie",
  PAYERS: ["Sascha", "Sonja"],
  RECENT_LIMIT: 150,        // mindestens so viele letzte Einträge gehen an den Verlauf …
  RECENT_MONTHS: 7,         // … und zusätzlich alle Einträge des laufenden + der 6 vollen Vormonate (für Verlauf & Analyse)
  SUGGESTION_MONTHS: 24,    // Zeitraum für Positions-Vorschläge
  SUGGESTION_LIMIT: 60,
  TRIP_LIMIT: 12,           // so viele Reisen gehen an die App
  VERSION: "3.9"
};

const COL = { POSITION: 1, AMOUNT: 2, DATE: 3, PAID_BY: 4, COMMENT: 5, TYPE: 6, TRIP: 7, ID: 8, SPECIAL: 9 };
const NUM_COLS = 9;
const FEATURES = ["special", "plan"]; // App blendet den Sonder-Haken nur ein, wenn das Backend ihn kennt

/* ------------------------------------------------------------------ */
/*  Positions-Vereinheitlichung (identische Logik in app.js)           */
/* ------------------------------------------------------------------ */
const POSITION_ALIASES = {
  "bäcker": "Bäckerei",
  "baecker": "Bäckerei",
  "bäckerei": "Bäckerei",
  "backerei": "Bäckerei",
  "edeka": "Edeka",
  "rewe": "Rewe",
  "aldi": "Aldi",
  "lidl": "Lidl",
  "dm": "DM",
  "dm kinder": "DM Kinder",
  "apotheke": "Apotheke",
  "kinderkleidung": "Kleidung Kinder",
  "kleidung kinder": "Kleidung Kinder",
  "mc donalds": "McDonald's",
  "mcdonalds": "McDonald's",
  "mc donald's": "McDonald's",
  "mcdonald's": "McDonald's",
  "frisör": "Friseur",
  "flaschenpost": "Flaschenpost",
  "happycoffee": "Happycoffee",
  "happy coffee": "Happycoffee",
  "baumarkt": "Baumarkt",
  "kiosk": "Kiosk"
};

function normalizePosition(raw) {
  let s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  if (!s) return "";
  const parts = s.split(/\s*\+\s*|\s+und\s+/i).map(function (p) { return p.trim(); }).filter(Boolean);
  const normalized = parts.map(function (p) {
    const alias = POSITION_ALIASES[p.toLowerCase()];
    if (alias) return alias;
    return p.charAt(0).toUpperCase() + p.slice(1);
  });
  return normalized.join(" + ");
}

/* ------------------------------------------------------------------ */
/*  Parser                                                             */
/* ------------------------------------------------------------------ */
function parseAmount(val) {
  if (typeof val === "number") return val;
  if (val == null) return NaN;
  let s = String(val).replace(/€/g, "").replace(/\s/g, "");
  if (!s) return NaN;
  const hasComma = s.indexOf(",") !== -1;
  const hasDot = s.indexOf(".") !== -1;
  if (hasComma && hasDot) {
    // Das zuletzt stehende Zeichen ist das Dezimaltrennzeichen
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" → Tausenderpunkt
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100) / 100;
}

function parseDateInput(val) {
  if (!val) return null;
  if (Object.prototype.toString.call(val) === "[object Date]") return isNaN(val) ? null : val;
  const s = String(val).trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  return null;
}

function normalizeType(val) {
  const s = String(val || "").trim().toLowerCase();
  if (s === "persönlich" || s === "persoenlich" || s === "personal" || s === "privat") return "Persönlich";
  if (s === "reise" || s === "urlaub" || s === "trip") return "Reise";
  if (s === "anschaffung" || s === "gemeinsam" || s === "gemeinsame anschaffung" || s === "shared") return "Anschaffung";
  return CONFIG.DEFAULT_TYPE;
}

function normalizeTrip(val) {
  return String(val == null ? "" : val).replace(/\s+/g, " ").trim().slice(0, 80);
}

function parseBool(val) {
  if (val === true) return true;
  const s = String(val == null ? "" : val).trim().toLowerCase();
  return s === "true" || s === "1" || s === "ja" || s === "x" || s === "wahr";
}

function normalizePayer(val) {
  const s = String(val || "").trim();
  const hit = CONFIG.PAYERS.filter(function (p) { return p.toLowerCase() === s.toLowerCase(); })[0];
  return hit || (s || CONFIG.PAYERS[0]);
}

/* ------------------------------------------------------------------ */
/*  Endpunkte                                                          */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action || "ping";
  try {
    if (action === "ping") {
      return createJsonResponse({
        status: "ok",
        message: "Kostentracker Web App API ist online.",
        sheet: CONFIG.SHEET_NAME,
        version: CONFIG.VERSION,
        types: CONFIG.TYPES,
        features: FEATURES,
        authRequired: isTokenRequired(),
        authOk: isAuthorized(params.token),
        timestamp: new Date().toISOString()
      });
    }
    if (!isAuthorized(params.token)) {
      return createJsonResponse({ success: false, error: "Ungültiges Sicherheits-Token.", code: "AUTH" });
    }
    if (action === "data") {
      // IDs für neue/manuelle Zeilen vergeben (nur mit Sperre, sonst beim nächsten Mal)
      const lock = LockService.getScriptLock();
      if (lock.tryLock(5000)) {
        try { ensureIds(getSheet()); } finally { lock.releaseLock(); }
      }
      return createJsonResponse(buildDataResponse());
    }
    if (action === "plan") {
      if (!isPrivateAuthorized(params.ptoken)) {
        return createJsonResponse({ success: false, error: "Privat-Token fehlt oder ist falsch.", code: "PRIVATE_AUTH" });
      }
      return createJsonResponse(buildPlanResponse());
    }
    return createJsonResponse({ success: false, error: "Unbekannte Aktion: " + action });
  } catch (err) {
    return createJsonResponse({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = (e && e.parameter) || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    if (!isAuthorized(data.token)) {
      return createJsonResponse({ success: false, error: "Ungültiges Sicherheits-Token.", code: "AUTH" });
    }

    const action = data.action || "add";
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      if (action === "add") return createJsonResponse(handleAdd(data));
      if (action === "update") return createJsonResponse(handleUpdate(data));
      if (action === "delete") return createJsonResponse(handleDelete(data));
      return createJsonResponse({ success: false, error: "Unbekannte Aktion: " + action });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return createJsonResponse({ success: false, error: String(err) });
  }
}

/* ------------------------------------------------------------------ */
/*  Schreiben                                                          */
/* ------------------------------------------------------------------ */
function validateEntry(data) {
  const position = normalizePosition(data.position);
  if (!position) return { error: "Position/Thema fehlt." };
  const amount = parseAmount(data.amount);
  if (isNaN(amount) || amount <= 0) return { error: "Ungültiger Betrag." };
  const date = parseDateInput(data.date) || new Date();
  const type = normalizeType(data.type);
  const trip = type === "Reise" ? normalizeTrip(data.trip) : "";
  if (type === "Reise" && !trip) return { error: "Bitte eine Reise auswählen oder anlegen." };
  return {
    entry: {
      position: position,
      amount: amount,
      date: date,
      paidBy: normalizePayer(data.paidBy),
      comment: String(data.comment || "").trim(),
      type: type,
      trip: trip,
      special: type === "Persönlich" && parseBool(data.special)
    }
  };
}

function entryToRow(entry) {
  return [entry.position, entry.amount, entry.date, entry.paidBy, entry.comment, entry.type, entry.trip || "", entry.id || "", !!entry.special];
}

/* ------------------------------------------------------------------ */
/*  IDs                                                                */
/* ------------------------------------------------------------------ */
function parseId(val) {
  const n = Number(val);
  return n > 0 && Math.floor(n) === n ? n : 0;
}

function readIds(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues().map(function (r) { return parseId(r[0]); });
}

function nextId(sheet) {
  return readIds(sheet).reduce(function (m, id) { return Math.max(m, id); }, 0) + 1;
}

/** Vergibt fehlende oder doppelte IDs (Zeilen mit Inhalt), schreibt Spalte H nur bei Änderungen. */
function ensureIds(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const data = sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues();
  let max = 0;
  data.forEach(function (r) { max = Math.max(max, parseId(r[COL.ID - 1])); });
  const seen = {};
  let changed = 0;
  const ids = data.map(function (r) {
    const hasContent = String(r[0] || "").trim() !== "" || String(r[1] || "").trim() !== "";
    let id = parseId(r[COL.ID - 1]);
    if (hasContent && (!id || seen[id])) { id = ++max; changed++; }
    if (id) seen[id] = true;
    return [hasContent ? id : (r[COL.ID - 1] === "" ? "" : r[COL.ID - 1])];
  });
  if (changed) sheet.getRange(2, COL.ID, ids.length, 1).setValues(ids);
  return changed;
}

/** Findet die Zeile zu einer ID; ohne ID (ältere App) wird die übergebene Zeilennummer genutzt. */
function resolveRow(sheet, data) {
  const id = parseId(data.id);
  if (id) {
    const ids = readIds(sheet);
    const idx = ids.indexOf(id);
    if (idx === -1) return { error: "Eintrag nicht mehr vorhanden – bitte Verlauf neu laden." };
    const row = idx + 2;
    if (data.expected) {
      const problem = checkExpected(sheet, row, data.expected);
      if (problem) return { error: problem };
    }
    return { row: row, id: id };
  }
  const problem = checkExpected(sheet, data.row, data.expected);
  if (problem) return { error: problem };
  const row = Number(data.row);
  return { row: row, id: parseId(sheet.getRange(row, COL.ID).getValue()) };
}

function formatRow(sheet, row) {
  sheet.getRange(row, COL.AMOUNT).setNumberFormat('#,##0.00 "€"');
  sheet.getRange(row, COL.DATE).setNumberFormat("dd.MM.yyyy");
}

function handleAdd(data) {
  // Doppelbuchungs-Schutz: gleiche clientId innerhalb von 6 h wird nicht erneut geschrieben
  const cache = CacheService.getScriptCache();
  if (data.clientId) {
    const seen = cache.get("cid_" + data.clientId);
    if (seen) {
      const parts = String(seen).split(":");
      return { success: true, duplicate: true, row: Number(parts[0]), id: Number(parts[1]) || null, message: "Eintrag war bereits gespeichert." };
    }
  }

  const v = validateEntry(data);
  if (v.error) return { success: false, error: v.error };

  const sheet = getSheet();
  v.entry.id = nextId(sheet);
  sheet.appendRow(entryToRow(v.entry));
  const lastRow = sheet.getLastRow();
  formatRow(sheet, lastRow);

  if (data.clientId) cache.put("cid_" + data.clientId, lastRow + ":" + v.entry.id, 21600);

  return {
    success: true,
    row: lastRow,
    id: v.entry.id,
    message: "Eintrag erfolgreich in Zeile " + lastRow + " gespeichert.",
    data: serializeEntry(v.entry, lastRow)
  };
}

function checkExpected(sheet, row, expected) {
  row = Number(row);
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return "Zeile nicht gefunden – bitte Verlauf neu laden.";
  }
  const current = sheet.getRange(row, 1, 1, NUM_COLS).getValues()[0];
  expected = expected || {};
  const curPos = String(current[0] || "").replace(/\s+/g, " ").trim().toLowerCase();
  const expPos = String(expected.position || "").replace(/\s+/g, " ").trim().toLowerCase();
  const curAmt = parseAmount(current[1]);
  const expAmt = parseAmount(expected.amount);
  if (curPos !== expPos || Math.abs(curAmt - expAmt) > 0.005) {
    return "Der Eintrag wurde zwischenzeitlich verändert – bitte Verlauf neu laden.";
  }
  return null;
}

function handleUpdate(data) {
  const sheet = getSheet();
  const target = resolveRow(sheet, data);
  if (target.error) return { success: false, error: target.error, code: "CONFLICT" };

  const row = target.row;
  const incoming = data.entry || {};
  // Ältere App-Versionen kennen kein Reise-Feld: vorhandenen Reisenamen beibehalten
  if (incoming.trip === undefined && normalizeType(incoming.type) === "Reise") {
    incoming.trip = sheet.getRange(row, COL.TRIP).getValue();
  }
  // Ältere App-Versionen kennen kein Sonder-Feld: vorhandenen Haken beibehalten
  if (incoming.special === undefined) {
    incoming.special = sheet.getRange(row, COL.SPECIAL).getValue();
  }
  const v = validateEntry(incoming);
  if (v.error) return { success: false, error: v.error };
  v.entry.id = target.id || nextId(sheet);

  sheet.getRange(row, 1, 1, NUM_COLS).setValues([entryToRow(v.entry)]);
  formatRow(sheet, row);
  return { success: true, row: row, message: "Eintrag aktualisiert.", data: serializeEntry(v.entry, row) };
}

function handleDelete(data) {
  const sheet = getSheet();
  const target = resolveRow(sheet, data);
  if (target.error) return { success: false, error: target.error, code: "CONFLICT" };
  sheet.deleteRow(target.row);
  return { success: true, row: target.row, id: target.id, message: "Eintrag gelöscht." };
}

/* ------------------------------------------------------------------ */
/*  Lesen                                                              */
/* ------------------------------------------------------------------ */
function buildDataResponse() {
  const sheet = getSheet();
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, NUM_COLS).getValues() : [];

  const entries = [];
  const months = {};
  const trips = {};
  const suggestionCounts = { "Familie": {}, "Persönlich": {}, "Reise": {}, "Anschaffung": {} };
  const now = new Date();
  const suggestionCutoff = new Date(now.getFullYear(), now.getMonth() - CONFIG.SUGGESTION_MONTHS, 1);
  const recentCutoffIso = Utilities.formatDate(
    new Date(now.getFullYear(), now.getMonth() - (CONFIG.RECENT_MONTHS - 1), 1, 12), tz, "yyyy-MM-dd");

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const position = String(r[0] || "").trim();
    const amount = parseAmount(r[1]);
    if (!position && (isNaN(amount) || !amount)) continue; // Leerzeile

    const date = parseDateInput(r[2]);
    const type = normalizeType(r[5]);
    const entry = {
      position: position,
      amount: isNaN(amount) ? 0 : amount,
      date: date,
      paidBy: normalizePayer(r[3]),
      comment: String(r[4] || "").trim(),
      type: type,
      trip: type === "Reise" ? normalizeTrip(r[6]) : "",
      id: parseId(r[COL.ID - 1]) || null,
      special: type === "Persönlich" && parseBool(r[COL.SPECIAL - 1])
    };
    entries.push(serializeEntry(entry, i + 2, tz));

    if (entry.type === "Reise" && !isNaN(amount)) {
      const name = entry.trip || "Ohne Namen";
      const iso = date ? Utilities.formatDate(date, tz, "yyyy-MM-dd") : "";
      if (!trips[name]) trips[name] = { name: name, total: 0, byPayer: {}, count: 0, from: iso, to: iso };
      const t = trips[name];
      t.total = round2(t.total + amount);
      t.byPayer[entry.paidBy] = round2((t.byPayer[entry.paidBy] || 0) + amount);
      t.count++;
      if (iso && (!t.from || iso < t.from)) t.from = iso;
      if (iso && (!t.to || iso > t.to)) t.to = iso;
    }

    if (date && !isNaN(amount)) {
      const key = Utilities.formatDate(date, tz, "yyyy-MM");
      if (!months[key]) months[key] = { month: key, family: {}, personal: {}, trip: {}, shared: {}, count: 0 };
      const bucket = entry.type === "Persönlich" ? months[key].personal
        : entry.type === "Reise" ? months[key].trip
        : entry.type === "Anschaffung" ? months[key].shared
        : months[key].family;
      bucket[entry.paidBy] = round2((bucket[entry.paidBy] || 0) + amount);
      months[key].count++;

      if (date >= suggestionCutoff && position) {
        const norm = normalizePosition(position);
        const counts = suggestionCounts[entry.type];
        counts[norm] = (counts[norm] || 0) + 1;
      }
    }
  }

  // Verlauf: alle Einträge der letzten RECENT_MONTHS Monate, mindestens RECENT_LIMIT Stück
  let recent = entries.filter(function (e) { return e.iso && e.iso >= recentCutoffIso; });
  if (recent.length < CONFIG.RECENT_LIMIT) {
    const seen = {};
    recent.forEach(function (e) { seen[e.row] = true; });
    recent = recent.concat(entries.slice(-CONFIG.RECENT_LIMIT).filter(function (e) { return !seen[e.row]; }));
  }
  recent.sort(function (a, b) {
    if (a.iso !== b.iso) return a.iso < b.iso ? 1 : -1;
    return b.row - a.row;
  });

  const monthList = Object.keys(months).sort().reverse().map(function (k) { return months[k]; });
  const tripList = Object.keys(trips)
    .map(function (k) { return trips[k]; })
    .sort(function (a, b) { return (a.to || "") < (b.to || "") ? 1 : -1; })
    .slice(0, CONFIG.TRIP_LIMIT);

  function topList(counts) {
    return Object.keys(counts)
      .map(function (k) { return { position: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, CONFIG.SUGGESTION_LIMIT);
  }

  return {
    success: true,
    version: CONFIG.VERSION,
    generatedAt: new Date().toISOString(),
    types: CONFIG.TYPES,
    features: FEATURES,
    tripSettlements: readTripSettlements(),
    totalRows: entries.length,
    recentFrom: recentCutoffIso,
    entries: recent,
    months: monthList,
    trips: tripList,
    suggestions: {
      "Familie": topList(suggestionCounts["Familie"]),
      "Persönlich": topList(suggestionCounts["Persönlich"]),
      "Reise": topList(suggestionCounts["Reise"]),
      "Anschaffung": topList(suggestionCounts["Anschaffung"])
    }
  };
}

function serializeEntry(entry, row, tz) {
  tz = tz || SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const d = entry.date;
  return {
    id: entry.id || null,
    row: row,
    position: entry.position,
    amount: entry.amount,
    date: d ? Utilities.formatDate(d, tz, "dd.MM.yyyy") : "",
    iso: d ? Utilities.formatDate(d, tz, "yyyy-MM-dd") : "",
    paidBy: entry.paidBy,
    comment: entry.comment,
    type: entry.type,
    trip: entry.trip || "",
    special: !!entry.special
  };
}

/* ------------------------------------------------------------------ */
/*  Hilfsfunktionen                                                    */
/* ------------------------------------------------------------------ */
function round2(n) { return Math.round(n * 100) / 100; }

function isTokenRequired() {
  return !!(CONFIG.SECRET_TOKEN && CONFIG.SECRET_TOKEN.trim() !== "");
}

function isAuthorized(token) {
  if (!isTokenRequired()) return true;
  return String(token || "") === CONFIG.SECRET_TOKEN;
}

function isPrivateAuthorized(ptoken) {
  const t = String(CONFIG.PRIVATE_TOKEN || "").trim();
  if (t && t.indexOf("HIER_") !== 0) return String(ptoken || "") === t;
  // Kein eigenes Privat-Token gesetzt: normales Token genügt (nur, wenn eins gesetzt ist)
  return isTokenRequired() && isAuthorized(ptoken);
}

/** Offener Ausgleich je Reise aus „Dashboard Reisen“ (+ = Sonja schuldet Sascha). 5 Min. gecacht. */
function readTripSettlements() {
  const id = String(CONFIG.REISEN_ID || "").trim();
  if (!id || id.indexOf("HIER_") === 0) return null;
  const cache = CacheService.getScriptCache();
  const hit = cache.get("trip_settle");
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* neu lesen */ } }
  try {
    const sheet = SpreadsheetApp.openById(id).getSheetByName("Dashboard Reisen");
    if (!sheet) return null;
    const vals = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 80), 6).getValues();
    let headerRow = -1, colName = 0, colOpen = -1;
    for (let r = 0; r < vals.length && headerRow < 0; r++) {
      const row = vals[r].map(function (v) { return String(v || "").toLowerCase(); });
      if (row[0] === "reise") {
        for (let c = 0; c < row.length; c++) if (row[c].indexOf("ausgleich offen") === 0) colOpen = c;
        if (colOpen >= 0) headerRow = r;
      }
    }
    if (headerRow < 0) return null;
    const out = {};
    for (let r = headerRow + 1; r < vals.length; r++) {
      const name = String(vals[r][colName] || "").trim();
      if (!name) continue;
      if (name.toLowerCase().indexOf("summe") === 0) break;
      out[name] = planNum(vals[r][colOpen]);
    }
    cache.put("trip_settle", JSON.stringify(out), 300);
    return out;
  } catch (err) {
    return null; // Reise-Ausgleich ist optional – App rechnet dann selbst
  }
}

/* ------------------------------------------------------------------ */
/*  Finanzplan (privates Sheet, nur mit PRIVATE_TOKEN)                 */
/* ------------------------------------------------------------------ */
function planNum(v) {
  if (typeof v === "number") return round2(v);
  const n = parseAmount(v);
  return isNaN(n) ? 0 : n;
}

/** Sucht in einer Spalte die erste Zeile, deren Text mit einem der Präfixe beginnt, und liefert den Wert daneben. */
function findByLabel(values, labelCol, valueCol, prefixes) {
  for (let i = 0; i < values.length; i++) {
    const label = String(values[i][labelCol] || "").replace(/^[−\-\s]+/, "").trim().toLowerCase();
    for (let j = 0; j < prefixes.length; j++) {
      if (label.indexOf(prefixes[j].toLowerCase()) === 0) return planNum(values[i][valueCol]);
    }
  }
  return null;
}

function buildPlanResponse() {
  const ss = SpreadsheetApp.openById(CONFIG.FINANZPLAN_ID);
  const tz = ss.getSpreadsheetTimeZone();
  const sh = function (name) {
    const x = ss.getSheetByName(name);
    if (!x) throw new Error('Blatt "' + name + '" im Finanzplan nicht gefunden.');
    return x;
  };

  // Monatswerte – Spalten über die Überschriften in Zeile 5 finden (robust gegen neue Spalten)
  const mSheet = sh("Monate");
  const mVals = mSheet.getRange(5, 1, Math.max(mSheet.getLastRow() - 4, 1), mSheet.getLastColumn()).getValues();
  const head = mVals[0].map(function (h) { return String(h || "").toLowerCase(); });
  const col = function () {
    for (let a = 0; a < arguments.length; a++) {
      for (let i = 0; i < head.length; i++) if (head[i].indexOf(arguments[a]) === 0) return i;
    }
    return -1;
  };
  const C = {
    sparrate: col("topf einzahlung"), entnahmen: col("entnahmen gesamt"), ungeplant: col("davon ungeplant"),
    netto: col("netto im topf"), topf: col("topf-stand"), sonstige: col("persönlich laufend", "sonstige anschaffungen"),
    gemeinsam: col("gem. sonderzahlungen", "gem. anschaffungen"), kleidung: col("kleidung"), bargeld: col("bargeld"),
    lebensmittel: col("lebensmittel"), etf: col("etf"), extra: col("extra-einzahlungen"),
    herkunft: col("herkunft"), sonder: col("persönlich sonderausgaben", "sonderausgaben")
  };
  const now = new Date();
  const nowKey = Utilities.formatDate(now, tz, "yyyy-MM");
  const months = [];
  for (let r = 1; r < mVals.length; r++) {
    const a = mVals[r][0];
    let key = "";
    if (Object.prototype.toString.call(a) === "[object Date]" && !isNaN(a)) key = Utilities.formatDate(a, tz, "yyyy-MM");
    else if (/^\d{4}-\d{2}$/.test(String(a).trim())) key = String(a).trim();
    if (!key || key > nowKey) continue;
    const g = function (k) { return C[k] >= 0 ? mVals[r][C[k]] : ""; };
    const sparrateRaw = g("sparrate");
    months.push({
      month: key,
      sparrate: planNum(sparrateRaw),
      hasSparrate: sparrateRaw !== "" && sparrateRaw !== null,
      extra: planNum(g("extra")), herkunft: String(g("herkunft") || ""),
      entnahmen: planNum(g("entnahmen")), ungeplant: planNum(g("ungeplant")),
      netto: planNum(g("netto")), topf: g("topf") === "" ? null : planNum(g("topf")),
      sonstige: planNum(g("sonstige")), sonder: planNum(g("sonder")), gemeinsam: planNum(g("gemeinsam")),
      kleidung: planNum(g("kleidung")), bargeld: planNum(g("bargeld")),
      lebensmittel: planNum(g("lebensmittel")), etf: planNum(g("etf"))
    });
  }

  // Monatsbilanz und Topf-Block aus der Fixkostenübersicht (über die Beschriftungen)
  const fx = sh("Sascha Monats-Fixkostenübersicht").getRange(1, 1, 16, 7).getValues();
  const plan = {
    netto: findByLabel(fx, 0, 1, ["Nettogehalt"]),
    kindergeld: findByLabel(fx, 0, 1, ["Kindergeld"]),
    fixkosten: findByLabel(fx, 0, 1, ["Laufende Fixkosten"]),
    familie: findByLabel(fx, 0, 1, ["Variable Familienkosten"]),
    alltag: findByLabel(fx, 0, 1, ["Ø Persönlich ohne Sonderausgaben", "Ø persönliche Alltagskosten", "Ø persönliche variable"]),
    freiraum: findByLabel(fx, 0, 1, ["Freiraum pro Monat"]),
    sonderSchnitt: findByLabel(fx, 0, 1, ["Zum Vergleich"]),
    ruecklage: findByLabel(fx, 3, 6, ["Rücklage pro Monat"]),
    sparrate: findByLabel(fx, 3, 6, ["Sparrate Topf"]),
    reisebudget: findByLabel(fx, 3, 6, ["Reisebudget"]),
    topfRest: findByLabel(fx, 3, 6, ["Topf-Rest für Anschaffungen"])
  };

  const ein = sh("Einstellungen").getRange(1, 1, 20, 2).getValues();
  const targets = {
    sonstige: findByLabel(ein, 0, 1, ["Budget Persönlich laufend", "Budget sonstige"]),
    sonstigeMax: findByLabel(ein, 0, 1, ["Obergrenze Persönlich laufend", "Obergrenze sonstige"]),
    lebensmittel: findByLabel(ein, 0, 1, ["Ziel Lebensmittel"]),
    bargeld: findByLabel(ein, 0, 1, ["Ziel Bargeld"])
  };

  // Topf-Entnahmen der letzten 12 Monate
  const eSheet = sh("Entnahmen");
  const eLast = eSheet.getLastRow();
  const withdrawals = [];
  if (eLast >= 5) {
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    eSheet.getRange(5, 1, eLast - 4, 5).getValues().forEach(function (r) {
      const d = parseDateInput(r[0]);
      const amt = planNum(r[1]);
      if (!d || !amt || d < cutoff) return;
      withdrawals.push({
        iso: Utilities.formatDate(d, tz, "yyyy-MM-dd"), date: Utilities.formatDate(d, tz, "dd.MM.yyyy"),
        amount: amt, purpose: String(r[2] || ""), planned: String(r[3] || "").toLowerCase() !== "nein", ref: String(r[4] || "")
      });
    });
    withdrawals.sort(function (a, b) { return a.iso < b.iso ? 1 : -1; });
  }

  const gemSheet = ss.getSheetByName("Gemeinsame Sonderzahlungen") || ss.getSheetByName("Gemeinsame Anschaffungen");
  let saldoSonja = 0;
  if (gemSheet) {
    const top = gemSheet.getRange(1, 1, 4, 6).getValues();
    for (let r = 0; r < top.length; r++) {
      if (String(top[r][0] || "").toLowerCase().indexOf("saldo gesamt") === 0) {
        for (let c = 1; c < top[r].length; c++) {
          if (typeof top[r][c] === "number") { saldoSonja = round2(top[r][c]); break; }
        }
        break;
      }
    }
  }

  return { success: true, version: CONFIG.VERSION, generatedAt: new Date().toISOString(),
    months: months, plan: plan, targets: targets, withdrawals: withdrawals, saldoSonja: saldoSonja };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Tabellenblatt "' + CONFIG.SHEET_NAME + '" nicht gefunden.');
  return sheet;
}

function createJsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Einmal im Apps-Script-Editor ausführen: erlaubt den Zugriff auf das Finanzplan-Sheet
 * und zeigt, ob alle Werte gefunden werden. Liest nur, schreibt nichts.
 */
function testFinanzplan() {
  const res = buildPlanResponse();
  Logger.log("Monate: " + res.months.map(function (m) { return m.month; }).join(", "));
  Logger.log("Plan: " + JSON.stringify(res.plan));
  Logger.log("Ziele: " + JSON.stringify(res.targets));
  Logger.log("Entnahmen (12 Mon.): " + res.withdrawals.length + " · Saldo Sonja: " + res.saldoSonja);
}

/**
 * Manueller Test im Apps-Script-Editor (Funktion auswählen ➔ Ausführen).
 * Liest nur, schreibt nichts.
 */
function testReadData() {
  const res = buildDataResponse();
  Logger.log("Einträge: " + res.totalRows);
  Logger.log("Letzter Monat: " + JSON.stringify(res.months[0]));
  Logger.log("Top-Vorschläge Familie: " + JSON.stringify(res.suggestions["Familie"].slice(0, 10)));
  Logger.log("Reisen: " + JSON.stringify(res.trips));
  Logger.log("Backend-Version: " + res.version);
  Logger.log("Einträge ohne ID: " + res.entries.filter(function (e) { return !e.id; }).length + " (von " + res.entries.length + " im Verlauf)");
}
