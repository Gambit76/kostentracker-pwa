/**
 * =========================================================================
 * Kostentracker Google Apps Script Backend
 * Tabellenblatt: "Familie Variable Kosten"
 * =========================================================================
 */

// Konfiguration
const CONFIG = {
  SHEET_NAME: "Familie Variable Kosten",
  // Optional: Ein frei wählbares Token zum Schutz vor unbefugten Aufrufen
  // Falls leer (""), wird das Token nicht geprüft.
  SECRET_TOKEN: ""
};

/**
 * GET-Endpunkt: Dient als Health-Check und Verbindungstest im Browser
 */
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    message: "Kostentracker Web App API ist online.",
    sheet: CONFIG.SHEET_NAME,
    timestamp: new Date().toISOString()
  });
}

/**
 * POST-Endpunkt: Empfängt Buchungsdaten und hängt sie an das Sheet an
 */
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 1. Token-Prüfung (falls konfiguriert)
    if (CONFIG.SECRET_TOKEN && CONFIG.SECRET_TOKEN.trim() !== "") {
      if (data.token !== CONFIG.SECRET_TOKEN) {
        return createJsonResponse({ success: false, error: "Ungültiges Sicherheits-Token." }, 403);
      }
    }

    // 2. Pflichtfelder validieren
    const position = (data.position || "").trim();
    if (!position) {
      return createJsonResponse({ success: false, error: "Position/Thema fehlt." }, 400);
    }

    let amount = data.amount;
    if (typeof amount === "string") {
      // Komma in Punkt wandeln, Währungszeichen und Leerzeichen entfernen
      amount = amount.replace("€", "").replace(/\s/g, "").replace(",", ".");
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return createJsonResponse({ success: false, error: "Ungültiger Betrag." }, 400);
    }

    const paidBy = (data.paidBy || "Sascha").trim();
    const comment = (data.comment || "").trim();
    
    // 3. Datum aufbereiten (DD.MM.YYYY oder Date)
    let entryDate;
    if (data.date) {
      if (typeof data.date === "string" && data.date.includes(".")) {
        const parts = data.date.split(".");
        // parts[0] = Tag, parts[1] = Monat, parts[2] = Jahr
        entryDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else {
        entryDate = new Date(data.date);
      }
    } else {
      entryDate = new Date();
    }

    // 4. Tabellenblatt abrufen
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      // Fallback: Erstes Blatt nutzen, falls Name abweicht
      sheet = spreadsheet.getSheets()[0];
    }

    // 5. Zeile anhängen
    // Spalten: Position | Betrag | Datum | Bezahlt von | Kommentar
    sheet.appendRow([
      position,
      numericAmount,
      entryDate,
      paidBy,
      comment
    ]);

    const lastRow = sheet.getLastRow();

    // 6. Formatierung der neuen Zeile sicherstellen
    // Spalte B = Währung (#,##0.00 €)
    sheet.getRange(lastRow, 2).setNumberFormat('#,##0.00 "€"');
    // Spalte C = Datum (dd.MM.yyyy)
    sheet.getRange(lastRow, 3).setNumberFormat('dd.MM.yyyy');

    return createJsonResponse({
      success: true,
      row: lastRow,
      message: "Eintrag erfolgreich in Zeile " + lastRow + " gespeichert.",
      data: {
        position: position,
        amount: numericAmount,
        date: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), "dd.MM.yyyy"),
        paidBy: paidBy,
        comment: comment
      }
    });

  } catch (err) {
    return createJsonResponse({
      success: false,
      error: err.toString()
    }, 500);
  }
}

/**
 * Hilfsfunktion: JSON-Response mit CORS-Unterstützung erstellen
 */
function createJsonResponse(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Testfunktion für den Google Apps Script Editor
 * Kann direkt im Editor ausgeführt werden (Button "Ausführen"), um Funktion zu prüfen.
 */
function testAppend() {
  const dummyEvent = {
    postData: {
      contents: JSON.stringify({
        position: "Testbuchung Script",
        amount: "14,99",
        date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy"),
        paidBy: "Sascha",
        comment: "Automatischer Funktionstest"
      })
    }
  };
  const result = doPost(dummyEvent);
  Logger.log(result.getContent());
}
