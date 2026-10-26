/**
 * Kostentracker PWA - Client Logic (v3.1)
 *
 * Neu in v3.1:
 *  - Typ "Reise" mit Reisename (Spalte G) – erscheint erst, wenn das Backend v3.1 läuft
 *  - Reisen-Saldo pro Reise inkl. 50/50-Ausgleich und Werten für die Obsidian-Reisenotiz
 *  - Monatsabschluss: Anschaffungen ≥ 100 €, Kleidung, Lebensmittel als Obsidian-Properties zum Kopieren
 *
 * Neu in v3:
 *  - Typ-Umschalter Familie / Persönlich (Spalte F im Sheet)
 *  - Verlauf direkt aus dem Sheet inkl. Bearbeiten & Löschen
 *  - Monatsübersicht mit Ausgleich Sascha/Sonja und persönlichen Kosten
 *  - Positions-Vorschläge & Schnellwahl-Chips aus den echten Daten
 *  - Vereinheitlichung der Positionsnamen, robuster Betragsparser
 *  - Sicherheits-Token für alle Zugriffe, Doppelbuchungs-Schutz für die Offline-Warteschlange
 */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // ---------- Elements ----------
  const btnSascha = $('btn-sascha');
  const btnSonja = $('btn-sonja');
  const btnTypeFamily = $('btn-type-family');
  const btnTypePersonal = $('btn-type-personal');
  const btnTypeTrip = $('btn-type-trip');
  const tripSelect = $('trip-select');
  const tripNewInput = $('trip-new-input');
  const typeHint = $('type-hint');
  const expenseForm = $('expense-form');
  const amountInput = $('amount-input');
  const positionInput = $('position-input');
  const chipsContainer = $('quick-chips');
  const suggestionList = $('position-suggestions');
  const dateInput = $('date-input');
  const btnToday = $('btn-today');
  const btnYesterday = $('btn-yesterday');
  const toggleCommentBtn = $('toggle-comment-btn');
  const commentBox = $('comment-box');
  const commentInput = $('comment-input');
  const commentIcon = $('comment-toggle-icon');
  const submitBtn = $('submit-btn');
  const btnSpinner = $('btn-spinner');
  const btnLabel = $('btn-label');
  const toast = $('toast');
  const toastIcon = $('toast-icon');
  const toastText = $('toast-text');
  const offlineBanner = $('offline-banner');
  const offlineMessage = $('offline-message');
  const syncNowBtn = $('sync-now-btn');
  const statusDot = $('status-dot');
  const connectionText = $('connection-text');

  // History
  const historyList = $('history-list');
  const historyNote = $('history-note');
  const historySearch = $('history-search');
  const historyRefreshBtn = $('history-refresh-btn');
  const filterTypeSeg = $('filter-type');
  const filterPayerSeg = $('filter-payer');

  // Summary
  const monthLabel = $('month-label');
  const monthPrev = $('month-prev');
  const monthNext = $('month-next');
  const summaryFamily = $('summary-family');
  const summaryPersonal = $('summary-personal');
  const summaryTrend = $('summary-trend');
  const summaryNote = $('summary-note');
  const trendPerson = $('trend-person');
  const summaryClose = $('summary-close');
  const closePerson = $('close-person');
  const tripsCard = $('trips-card');
  const summaryTrips = $('summary-trips');

  // Edit dialog
  const editDialog = $('edit-dialog');
  const editAmount = $('edit-amount');
  const editPosition = $('edit-position');
  const editDate = $('edit-date');
  const editPayer = $('edit-payer');
  const editType = $('edit-type');
  const editComment = $('edit-comment');
  const editTripGroup = $('edit-trip-group');
  const editTrip = $('edit-trip');
  const tripSuggestionList = $('trip-suggestions');
  const editTypeTripOption = $('edit-type-trip');
  const editRowNote = $('edit-row-note');
  const editSaveBtn = $('edit-save-btn');
  const editDeleteBtn = $('edit-delete-btn');
  const closeEditBtn = $('close-edit-btn');

  // Settings
  const settingsDialog = $('settings-dialog');
  const openSettingsBtn = $('open-settings-btn');
  const closeSettingsBtn = $('close-settings-btn');
  const saveSettingsBtn = $('save-settings-btn');
  const testConnectionBtn = $('test-connection-btn');
  const cfgApiUrl = $('cfg-api-url');
  const cfgSecretToken = $('cfg-secret-token');
  const shareLinkBtn = $('share-link-btn');
  const pasteClipboardBtn = $('paste-clipboard-btn');
  const forceReloadBtn = $('force-reload-btn');

  // ---------- Storage helpers ----------
  const store = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
    getJSON(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    setJSON(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  // ---------- Auto-Setup via URL Parameters ----------
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get('api');
    const tokenParam = urlParams.get('token');
    if (apiParam) {
      store.set('kostentracker_api_url', apiParam.trim());
      if (tokenParam !== null) store.set('kostentracker_secret_token', tokenParam.trim());
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (paramErr) {
    console.warn('URL params parsing failed:', paramErr);
  }

  // ---------- Constants ----------
  const TYPE_FAMILY = 'Familie';
  const TYPE_PERSONAL = 'Persönlich';
  const TYPE_TRIP = 'Reise';
  const NEW_TRIP = '__new__';
  const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const DEFAULT_CHIPS = {
    [TYPE_FAMILY]: ['Edeka', 'Rewe', 'Bäckerei', 'Edeka + Bäckerei', 'Kraus', 'Kleidung Kinder', 'Flaschenpost', 'Happycoffee', 'Baumarkt', 'Apotheke'],
    [TYPE_PERSONAL]: ['Mittagessen', 'Kaffee', 'Tanken', 'Kleidung', 'Sport', 'Bücher', 'Geschenk', 'Parken', 'Friseur', 'Freizeit'],
    [TYPE_TRIP]: ['Flug', 'Unterkunft', 'Mietwagen', 'Restaurant', 'Supermarkt', 'Eintritt', 'Ausflug', 'Taxi', 'Parken', 'Souvenirs']
  };

  // ---------- Kategorien (für den Monatsabschluss) ----------
  // Reihenfolge zählt: erster Treffer gewinnt.
  const CATEGORY_RULES = [
    ['Kleidung', /kleidung|schuh|sohle|zalando|p&c|peek|h&m|zara|uniqlo|jeans|hose|mantel|jacke|pullover|hemd|shirt|pyjama|socken|gorewear|schiesser|shoppen|shopping/i],
    ['Lebensmittel', /edeka|rewe|aldi|lidl|kaufland|netto|penny|supermarkt|bäcker|brot|flaschenpost|kraus|hähnchen|metzger|wochenmarkt|einkauf|getränke|obst|gemüse/i],
    ['Gastro', /restaurant|mittagessen|abendessen|essen|café|cafe|eiscafé|\beis\b|pizza|mcdonald|imbiss|strandbude|pfannkuchen|kneipe|döner|sushi|burger/i],
    ['Drogerie & Gesundheit', /\bdm\b|dm kinder|rossmann|drogerie|apotheke|arzt|brille/i]
  ];

  function categoryOf(entry) {
    const text = `${entry.position || ''} ${entry.comment || ''}`;
    for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
    return 'Sonstiges';
  }

  const ANSCHAFFUNG_MIN = 100;
  function isAnschaffung(entry) {
    const c = categoryOf(entry);
    return entry.amount >= ANSCHAFFUNG_MIN && c !== 'Lebensmittel' && c !== 'Kleidung' && c !== 'Gastro';
  }

  function normalizeTrip(val) {
    return String(val == null ? '' : val).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  const CHIP_ICONS = [
    [/edeka|rewe|aldi|lidl|supermarkt|einkauf|kaufland|netto/i, '🛒'],
    [/bäcker|brot|kuchen/i, '🥐'],
    [/flaschenpost|getränk/i, '🥤'],
    [/kaffee|coffee|café|cafe/i, '☕'],
    [/baumarkt|haushalt/i, '🔨'],
    [/kleidung|schuh/i, '👕'],
    [/apotheke|arzt/i, '💊'],
    [/dm|rossmann|drogerie|windel|pampers/i, '🧴'],
    [/tank|benzin|laden/i, '⛽'],
    [/essen|restaurant|mittag|lieferando|mcdonald|pizza|vapiano/i, '🍽️'],
    [/kiosk|zeitung/i, '📰'],
    [/sport|fitness/i, '🏋️'],
    [/buch|bücher/i, '📚'],
    [/geschenk|geburtstag/i, '🎁'],
    [/parken|parkhaus|parkplatz|^park\b/i, '🅿️'],
    [/friseur|frisör/i, '💇'],
    [/kirmes|freizeit|kino|zoo|eintritt|freizeitpark|siam/i, '🎡'],
    [/kraus|gemüse|obst|markt/i, '🥕'],
    [/flug|reise|hotel|urlaub/i, '✈️'],
    [/taxi|bahn|ticket/i, '🚕']
  ];

  // ---------- Positions-Vereinheitlichung (identisch zu Code.gs) ----------
  const POSITION_ALIASES = {
    'bäcker': 'Bäckerei', 'baecker': 'Bäckerei', 'bäckerei': 'Bäckerei', 'backerei': 'Bäckerei',
    'edeka': 'Edeka', 'rewe': 'Rewe', 'aldi': 'Aldi', 'lidl': 'Lidl', 'dm': 'DM', 'dm kinder': 'DM Kinder',
    'apotheke': 'Apotheke', 'kinderkleidung': 'Kleidung Kinder', 'kleidung kinder': 'Kleidung Kinder',
    'mc donalds': "McDonald's", 'mcdonalds': "McDonald's", "mc donald's": "McDonald's", "mcdonald's": "McDonald's",
    'frisör': 'Friseur', 'flaschenpost': 'Flaschenpost', 'happycoffee': 'Happycoffee', 'happy coffee': 'Happycoffee',
    'baumarkt': 'Baumarkt', 'kiosk': 'Kiosk'
  };

  function normalizePosition(raw) {
    const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return s.split(/\s*\+\s*|\s+und\s+/i)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => POSITION_ALIASES[p.toLowerCase()] || (p.charAt(0).toUpperCase() + p.slice(1)))
      .join(' + ');
  }

  // Parse Amount: "14,99", "14.99", "1.234,56", "1,234.56"
  function parseAmount(val) {
    if (typeof val === 'number') return val;
    if (val == null) return NaN;
    let s = String(val).replace(/€/g, '').replace(/\s/g, '');
    if (!s) return NaN;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      s = s.replace(',', '.');
    } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Math.round(parseFloat(s) * 100) / 100;
  }

  // ---------- Formatting ----------
  const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmtEur = (n) => eurFmt.format(Number(n) || 0);

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isoToGerman(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function germanToIso(de) {
    const m = String(de || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }

  function dayHeader(iso) {
    if (!iso) return 'Ohne Datum';
    const today = formatDateForInput(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (iso === today) return 'Heute';
    if (iso === formatDateForInput(y)) return 'Gestern';
    const [yy, mm, dd] = iso.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    return `${WEEKDAYS[d.getDay()]}, ${dd}. ${MONTH_SHORT[mm - 1]} ${yy}`;
  }

  function newClientId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // ---------- State ----------
  let currentPayer = store.get('kostentracker_payer', 'Sascha');
  let currentType = [TYPE_PERSONAL, TYPE_TRIP].includes(store.get('kostentracker_type', TYPE_FAMILY))
    ? store.get('kostentracker_type') : TYPE_FAMILY;
  let localTrips = store.getJSON('kostentracker_trips_local', []);
  let offlineQueue = store.getJSON('kostentracker_queue', []);
  let sheetData = store.getJSON('kostentracker_data', null);
  let isSyncing = false;
  let isLoadingData = false;
  let lastDataLoad = 0;
  let historyFilter = { type: 'all', payer: 'all', q: '' };
  let summaryMonth = null; // 'YYYY-MM'
  let editingEntry = null;

  // Migration: alte Offline-Einträge ohne Typ/clientId ergänzen
  offlineQueue = offlineQueue.map(item => ({
    ...item,
    type: item.type || TYPE_FAMILY,
    clientId: item.clientId || newClientId()
  }));
  store.setJSON('kostentracker_queue', offlineQueue);

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(text, icon = '✅', type = 'success', duration = 3000) {
    clearTimeout(toastTimer);
    toastText.textContent = text;
    toastIcon.textContent = icon;
    toast.className = `toast show ${type}`;
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ---------- API ----------
  function getApiConfig() {
    const storedUrl = store.get('kostentracker_api_url');
    const storedToken = store.get('kostentracker_secret_token');
    const windowConfig = window.APP_CONFIG || {};
    return {
      apiUrl: storedUrl || windowConfig.API_URL || '',
      secretToken: storedToken !== null ? storedToken : (windowConfig.SECRET_TOKEN || '')
    };
  }

  async function apiGet(action, extra = {}) {
    const config = getApiConfig();
    if (!config.apiUrl) throw new Error('Keine Web-App-URL hinterlegt.');
    const params = new URLSearchParams({ action, token: config.secretToken || '', ...extra, _: Date.now() });
    const sep = config.apiUrl.includes('?') ? '&' : '?';
    const resp = await fetch(config.apiUrl + sep + params.toString());
    return resp.json();
  }

  async function apiPost(body) {
    const config = getApiConfig();
    if (!config.apiUrl) throw new Error('Keine Web-App-URL hinterlegt.');
    // text/plain vermeidet den CORS-Preflight bei Google Apps Script
    const resp = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: config.secretToken || '' })
    });
    return resp.json();
  }

  function handleAuthError(result) {
    if (result && result.code === 'AUTH') {
      showToast('Sicherheits-Token fehlt oder ist falsch – bitte unter ⚙️ eintragen.', '🔒', 'error', 5000);
      return true;
    }
    return false;
  }

  // ---------- Payer & Type ----------
  function setPayer(payer) {
    currentPayer = payer;
    store.set('kostentracker_payer', payer);
    btnSascha.classList.toggle('active', payer === 'Sascha');
    btnSonja.classList.toggle('active', payer === 'Sonja');
    if (document.querySelector('#view-summary.active')) renderSummary();
  }

  const TYPE_HINTS = {
    [TYPE_FAMILY]: 'Geteilte Familienkosten – zählt für den Ausgleich',
    [TYPE_PERSONAL]: 'Nur für dich – zählt NICHT für den Familien-Ausgleich',
    [TYPE_TRIP]: 'Reisekosten – werden pro Reise abgerechnet, nicht im Monatsausgleich'
  };
  const SUBMIT_LABELS = {
    [TYPE_FAMILY]: 'Familienkosten speichern',
    [TYPE_PERSONAL]: 'Persönlich speichern',
    [TYPE_TRIP]: 'Reisekosten speichern'
  };

  // Läuft im Backend schon v3.1 (kennt Typ "Reise")?
  function tripsEnabled() {
    return !!(sheetData && Array.isArray(sheetData.types) && sheetData.types.includes(TYPE_TRIP));
  }

  function setType(type) {
    let persist = true;
    if (type === TYPE_TRIP && !tripsEnabled()) { type = TYPE_FAMILY; persist = false; }
    currentType = [TYPE_PERSONAL, TYPE_TRIP].includes(type) ? type : TYPE_FAMILY;
    if (persist) store.set('kostentracker_type', currentType);
    document.body.classList.toggle('mode-personal', currentType === TYPE_PERSONAL);
    document.body.classList.toggle('mode-trip', currentType === TYPE_TRIP);
    btnTypeFamily.classList.toggle('active', currentType === TYPE_FAMILY);
    btnTypePersonal.classList.toggle('active', currentType === TYPE_PERSONAL);
    btnTypeTrip.classList.toggle('active', currentType === TYPE_TRIP);
    typeHint.textContent = TYPE_HINTS[currentType];
    btnLabel.textContent = SUBMIT_LABELS[currentType];
    if (currentType === TYPE_TRIP) renderTripSelect();
    renderChips();
    renderSuggestions();
  }

  btnSascha.addEventListener('click', () => setPayer('Sascha'));
  btnSonja.addEventListener('click', () => setPayer('Sonja'));
  btnTypeFamily.addEventListener('click', () => setType(TYPE_FAMILY));
  btnTypePersonal.addEventListener('click', () => setType(TYPE_PERSONAL));
  btnTypeTrip.addEventListener('click', () => setType(TYPE_TRIP));

  // ---------- Reisen ----------
  function knownTrips() {
    const fromSheet = ((sheetData && sheetData.trips) || []).map(t => t.name).filter(n => n && n !== 'Ohne Namen');
    return [...new Set([...localTrips, ...fromSheet])]
      .sort((a, b) => (a < b ? 1 : -1)); // "JJJJ-MM Name" → neueste zuerst
  }

  function renderTripSelect() {
    const trips = knownTrips();
    const remembered = store.get('kostentracker_trip', '');
    const prev = tripSelect.value;
    tripSelect.innerHTML = trips.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('') +
      `<option value="${NEW_TRIP}">＋ Neue Reise…</option>`;
    const pick = [prev, remembered].find(v => v && (v === NEW_TRIP || trips.includes(v))) || trips[0] || NEW_TRIP;
    tripSelect.value = pick;
    updateTripNewInput();
    if (tripSuggestionList) tripSuggestionList.innerHTML = trips.map(t => `<option value="${escapeHtml(t)}"></option>`).join('');
  }

  function updateTripNewInput() {
    const isNew = tripSelect.value === NEW_TRIP;
    tripNewInput.style.display = isNew ? 'block' : 'none';
    if (isNew && !tripNewInput.value) tripNewInput.value = currentMonthKey() + ' ';
  }

  tripSelect.addEventListener('change', () => {
    updateTripNewInput();
    if (tripSelect.value !== NEW_TRIP) store.set('kostentracker_trip', tripSelect.value);
    else tripNewInput.focus();
  });

  function currentTrip() {
    if (currentType !== TYPE_TRIP) return '';
    return tripSelect.value === NEW_TRIP ? normalizeTrip(tripNewInput.value) : tripSelect.value;
  }

  function rememberTrip(name) {
    if (!name) return;
    if (!localTrips.includes(name)) {
      localTrips = [name, ...localTrips].slice(0, 20);
      store.setJSON('kostentracker_trips_local', localTrips);
    }
    store.set('kostentracker_trip', name);
    tripNewInput.value = '';
    renderTripSelect();
    tripSelect.value = name;
    updateTripNewInput();
  }

  function applyCapabilities() {
    const on = tripsEnabled();
    document.body.classList.toggle('trips-enabled', on);
    if (on && !editTypeTripOption.parentNode) editType.appendChild(editTypeTripOption);
    if (!on && editTypeTripOption.parentNode) editTypeTripOption.remove();
    if (!on && currentType === TYPE_TRIP) setType(TYPE_FAMILY);
    if (on && store.get('kostentracker_type') === TYPE_TRIP && currentType !== TYPE_TRIP) setType(TYPE_TRIP);
    if (on) renderTripSelect();
  }

  // ---------- Date ----------
  function setToday() { dateInput.value = formatDateForInput(new Date()); }
  function setYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    dateInput.value = formatDateForInput(d);
  }
  btnToday.addEventListener('click', setToday);
  btnYesterday.addEventListener('click', setYesterday);

  // ---------- Chips & Suggestions ----------
  function chipIcon(pos) {
    for (const [re, icon] of CHIP_ICONS) if (re.test(pos)) return icon;
    return '•';
  }

  function topPositions(type, n) {
    const list = (sheetData && sheetData.suggestions && sheetData.suggestions[type]) || [];
    return list.slice(0, n).map(s => s.position);
  }

  function renderChips() {
    let chips = topPositions(currentType, 10);
    if (chips.length < 6) {
      const extra = DEFAULT_CHIPS[currentType].filter(c => !chips.includes(c));
      chips = chips.concat(extra).slice(0, 10);
    }
    chipsContainer.innerHTML = chips.map(pos =>
      `<button type="button" class="chip-btn" data-pos="${escapeHtml(pos)}">${chipIcon(pos)} ${escapeHtml(pos)}</button>`
    ).join('');
    syncChipSelection();
  }

  function syncChipSelection() {
    const val = positionInput.value.trim().toLowerCase();
    chipsContainer.querySelectorAll('.chip-btn').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.pos.toLowerCase() === val);
    });
  }

  chipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (!chip) return;
    positionInput.value = chip.dataset.pos;
    syncChipSelection();
    if (amountInput.value) submitBtn.focus();
    else amountInput.focus();
  });

  positionInput.addEventListener('input', syncChipSelection);
  positionInput.addEventListener('blur', () => {
    const norm = normalizePosition(positionInput.value);
    if (norm && norm !== positionInput.value) positionInput.value = norm;
    syncChipSelection();
  });

  function renderSuggestions() {
    const s = (sheetData && sheetData.suggestions) || {};
    const primary = (s[currentType] || []).map(x => x.position);
    const other = [TYPE_FAMILY, TYPE_PERSONAL, TYPE_TRIP]
      .filter(t => t !== currentType)
      .flatMap(t => (s[t] || []).map(x => x.position));
    const all = [...new Set([...primary, ...other])];
    suggestionList.innerHTML = all.map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
  }

  // ---------- Comment ----------
  toggleCommentBtn.addEventListener('click', () => {
    const isOpen = commentBox.classList.toggle('open');
    commentIcon.textContent = isOpen ? '−' : '＋';
    if (isOpen) commentInput.focus();
  });

  // ---------- Connectivity ----------
  function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    statusDot.classList.toggle('offline', !isOnline);
    connectionText.textContent = isOnline ? 'Bereit' : 'Offline';
    updateQueueBanner();
  }

  function updateQueueBanner() {
    if (offlineQueue.length > 0) {
      offlineBanner.classList.add('show');
      offlineMessage.textContent = `⚡ ${offlineQueue.length} ${offlineQueue.length === 1 ? 'Eintrag' : 'Einträge'} in Offline-Warteschlange`;
    } else if (!navigator.onLine) {
      offlineBanner.classList.add('show');
      offlineMessage.textContent = '📡 Offline-Modus (Buchungen werden lokal gepuffert)';
    } else {
      offlineBanner.classList.remove('show');
    }
  }

  window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('Wieder online! Synchronisiere...', '📶');
    syncOfflineQueue();
  });

  window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('Offline-Modus aktiv.', '📡', 'warning');
  });

  syncNowBtn.addEventListener('click', syncOfflineQueue);

  // ---------- Daten aus dem Sheet laden ----------
  async function loadData(force = false) {
    if (isLoadingData) return;
    if (!force && Date.now() - lastDataLoad < 60000) return;
    if (!navigator.onLine || !getApiConfig().apiUrl) return;
    isLoadingData = true;
    historyRefreshBtn.disabled = true;
    historyRefreshBtn.textContent = '↻ Lädt...';
    try {
      const result = await apiGet('data');
      if (result && result.success) {
        sheetData = result;
        lastDataLoad = Date.now();
        store.setJSON('kostentracker_data', sheetData);
        renderAll();
      } else if (!handleAuthError(result)) {
        const msg = result && result.error ? result.error : 'Unbekannte Antwort';
        // Ältere Code.gs-Version kennt "data" noch nicht
        historyNote.textContent = 'Daten konnten nicht geladen werden: ' + msg;
      }
    } catch (err) {
      console.warn('Daten laden fehlgeschlagen:', err);
      historyNote.textContent = 'Daten konnten nicht geladen werden (offline?). Zeige zuletzt gespeicherten Stand.';
    } finally {
      isLoadingData = false;
      historyRefreshBtn.disabled = false;
      historyRefreshBtn.textContent = '↻ Aktualisieren';
    }
  }

  historyRefreshBtn.addEventListener('click', () => loadData(true));

  // Lokale Daten nach Änderungen sofort anpassen (bis zum nächsten Laden)
  function applyLocalAdd(entry) {
    if (!sheetData) return;
    sheetData.entries = [entry, ...(sheetData.entries || [])];
    adjustMonth(entry, +1);
  }

  function adjustMonth(entry, sign) {
    if (!sheetData || !entry.iso) return;
    const key = entry.iso.slice(0, 7);
    let m = (sheetData.months || []).find(x => x.month === key);
    if (!m) {
      m = { month: key, family: {}, personal: {}, trip: {}, count: 0 };
      sheetData.months = [...(sheetData.months || []), m].sort((a, b) => (a.month < b.month ? 1 : -1));
    }
    if (!m.trip) m.trip = {};
    const bucket = entry.type === TYPE_PERSONAL ? m.personal : entry.type === TYPE_TRIP ? m.trip : m.family;
    bucket[entry.paidBy] = Math.round(((bucket[entry.paidBy] || 0) + sign * entry.amount) * 100) / 100;
    m.count += sign;
    if (entry.type === TYPE_TRIP) adjustTrip(entry, sign);
  }

  function adjustTrip(entry, sign) {
    const name = entry.trip || 'Ohne Namen';
    sheetData.trips = sheetData.trips || [];
    let t = sheetData.trips.find(x => x.name === name);
    if (!t) {
      t = { name, total: 0, byPayer: {}, count: 0, from: entry.iso, to: entry.iso };
      sheetData.trips = [t, ...sheetData.trips];
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    t.total = r2(t.total + sign * entry.amount);
    t.byPayer[entry.paidBy] = r2((t.byPayer[entry.paidBy] || 0) + sign * entry.amount);
    t.count += sign;
    if (entry.iso && sign > 0) {
      if (!t.from || entry.iso < t.from) t.from = entry.iso;
      if (!t.to || entry.iso > t.to) t.to = entry.iso;
    }
    if (t.count <= 0) sheetData.trips = sheetData.trips.filter(x => x !== t);
  }

  function persistData() {
    store.setJSON('kostentracker_data', sheetData);
  }

  // ---------- Erfassen ----------
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const numericAmount = parseAmount(amountInput.value.trim());
    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben.', '⚠️', 'error');
      amountInput.focus();
      return;
    }

    const position = normalizePosition(positionInput.value);
    if (!position) {
      showToast('Bitte Wo/Wofür angeben.', '⚠️', 'error');
      positionInput.focus();
      return;
    }

    const trip = currentTrip();
    if (currentType === TYPE_TRIP && !trip) {
      showToast('Bitte eine Reise wählen oder benennen.', '✈️', 'error');
      (tripSelect.value === NEW_TRIP ? tripNewInput : tripSelect).focus();
      return;
    }

    const config = getApiConfig();
    if (!config.apiUrl) {
      openSettings();
      showToast('Bitte zuerst Google Web-App URL hinterlegen.', '⚙️', 'warning', 4000);
      return;
    }

    const payload = {
      action: 'add',
      clientId: newClientId(),
      position,
      amount: numericAmount,
      date: isoToGerman(dateInput.value),
      paidBy: currentPayer,
      type: currentType,
      comment: commentInput.value.trim()
    };
    if (currentType === TYPE_TRIP) payload.trip = trip;

    if (!navigator.onLine) {
      queueEntry(payload);
      if (trip) rememberTrip(trip);
      resetFormAfterSubmit();
      showToast('Offline gespeichert (wird synchronisiert).', '💾', 'warning');
      return;
    }

    setLoadingState(true);
    try {
      const result = await apiPost(payload);
      if (result && result.success) {
        if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
        const label = currentType === TYPE_PERSONAL ? 'Persönlich gespeichert'
          : currentType === TYPE_TRIP ? `Reise ${trip}` : 'Im Sheet gespeichert';
        showToast(`${label}: ${position} ${fmtEur(numericAmount)}`, '✅', 'success');
        if (trip) rememberTrip(trip);
        if (result.data && !result.duplicate) {
          applyLocalAdd(result.data);
          persistData();
          renderAll();
        }
        resetFormAfterSubmit();
        // Im Hintergrund frische Daten holen (Zeilennummern, Summen)
        lastDataLoad = 0;
        setTimeout(() => loadData(true), 400);
      } else if (!handleAuthError(result)) {
        showToast(result && result.error ? result.error : 'Fehler beim Speichern', '❌', 'error', 4500);
      }
    } catch (err) {
      console.warn('Network error, saving to offline queue:', err);
      queueEntry(payload);
      if (trip) rememberTrip(trip);
      resetFormAfterSubmit();
      showToast('Verbindung fehlgeschlagen – offline gespeichert.', '💾', 'warning');
    } finally {
      setLoadingState(false);
    }
  });

  function queueEntry(payload) {
    offlineQueue.push({ ...payload, queuedAt: new Date().toISOString() });
    store.setJSON('kostentracker_queue', offlineQueue);
    updateQueueBanner();
    renderHistory();
  }

  async function syncOfflineQueue() {
    if (isSyncing || offlineQueue.length === 0 || !navigator.onLine) return;
    if (!getApiConfig().apiUrl) return;

    isSyncing = true;
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Synchronisiere...';

    let syncedCount = 0;
    let authFailed = false;
    const remainingQueue = [];

    for (const item of [...offlineQueue]) {
      try {
        // Immer das aktuelle Token verwenden (nicht das beim Puffern gespeicherte)
        const { token, queuedAt, ...body } = item;
        const result = await apiPost({ action: 'add', ...body });
        if (result && result.success) {
          syncedCount++;
        } else {
          if (result && result.code === 'AUTH') authFailed = true;
          remainingQueue.push(item);
        }
      } catch (err) {
        remainingQueue.push(item);
      }
    }

    offlineQueue = remainingQueue;
    store.setJSON('kostentracker_queue', offlineQueue);
    updateQueueBanner();
    syncNowBtn.disabled = false;
    syncNowBtn.textContent = 'Jetzt synchronisieren';
    isSyncing = false;

    if (authFailed) handleAuthError({ code: 'AUTH' });
    if (syncedCount > 0) {
      showToast(`${syncedCount} ${syncedCount === 1 ? 'Eintrag' : 'Einträge'} synchronisiert!`, '✅');
      loadData(true);
    }
    renderHistory();
  }

  function setLoadingState(loading) {
    submitBtn.disabled = loading;
    btnSpinner.style.display = loading ? 'inline-block' : 'none';
    btnLabel.textContent = loading ? 'Wird gespeichert...' : SUBMIT_LABELS[currentType];
  }

  function resetFormAfterSubmit() {
    amountInput.value = '';
    positionInput.value = '';
    commentInput.value = '';
    commentBox.classList.remove('open');
    commentIcon.textContent = '＋';
    syncChipSelection();
    setToday();
    amountInput.focus();
  }

  // ---------- Views / Navigation ----------
  const navButtons = document.querySelectorAll('.nav-btn');
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
    store.set('kostentracker_view', viewId);
    if (viewId === 'view-history') renderHistory();
    if (viewId === 'view-summary') renderSummary();
    if (viewId !== 'view-add') loadData(false);
    window.scrollTo(0, 0);
  }
  navButtons.forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  // ---------- Verlauf ----------
  function bindSeg(seg, key) {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      historyFilter[key] = btn.dataset.val;
      renderHistory();
    });
  }
  bindSeg(filterTypeSeg, 'type');
  bindSeg(filterPayerSeg, 'payer');
  historySearch.addEventListener('input', () => {
    historyFilter.q = historySearch.value.trim().toLowerCase();
    renderHistory();
  });

  function matchesFilter(entry) {
    if (historyFilter.type !== 'all' && entry.type !== historyFilter.type) return false;
    if (historyFilter.payer !== 'all' && entry.paidBy !== historyFilter.payer) return false;
    if (historyFilter.q) {
      const hay = `${entry.position} ${entry.comment || ''} ${entry.trip || ''}`.toLowerCase();
      if (!hay.includes(historyFilter.q)) return false;
    }
    return true;
  }

  function entryHtml(entry, pending) {
    const personal = entry.type === TYPE_PERSONAL;
    const isTrip = entry.type === TYPE_TRIP;
    const meta = [entry.paidBy];
    if (personal) meta.push('Persönlich');
    if (isTrip) meta.push('✈️ ' + (entry.trip || 'Reise'));
    if (entry.comment) meta.push(entry.comment);
    if (pending) meta.push('⏳ wartet auf Sync');
    const cls = personal ? 'personal' : isTrip ? 'trip' : 'family';
    return `
      <button type="button" class="entry-item ${cls} ${pending ? 'pending' : ''}" ${pending ? 'disabled' : `data-row="${entry.row}"`}>
        <span class="entry-info">
          <span class="entry-pos">${escapeHtml(entry.position)}</span>
          <span class="entry-meta">${escapeHtml(meta.join(' · '))}</span>
        </span>
        <span class="entry-amount">${fmtEur(entry.amount)}</span>
      </button>`;
  }

  function renderHistory() {
    const pending = offlineQueue.map(q => ({
      position: q.position, amount: q.amount, paidBy: q.paidBy, type: q.type || TYPE_FAMILY,
      trip: q.trip || '', comment: q.comment, iso: germanToIso(q.date), pending: true
    })).filter(matchesFilter);

    if (!sheetData) {
      historyList.innerHTML = pending.map(p => entryHtml(p, true)).join('') +
        `<div class="empty-state">${getApiConfig().apiUrl ? 'Noch keine Daten geladen. Tippe auf „Aktualisieren“.' : 'Bitte zuerst unter ⚙️ die Web-App-URL und das Token hinterlegen.'}</div>`;
      historyNote.textContent = '';
      return;
    }

    const entries = (sheetData.entries || []).filter(matchesFilter);
    const all = [...pending, ...entries].sort((a, b) => (a.iso === b.iso ? 0 : (a.iso < b.iso ? 1 : -1)));
    if (all.length === 0) {
      historyList.innerHTML = '<div class="empty-state">Keine Einträge für diesen Filter.</div>';
    } else {
      // Nach Tag gruppieren
      const groups = [];
      let cur = null;
      all.slice(0, 120).forEach(e => {
        if (!cur || cur.iso !== e.iso) {
          cur = { iso: e.iso, items: [], sum: 0 };
          groups.push(cur);
        }
        cur.items.push(e);
        cur.sum += Number(e.amount) || 0;
      });
      historyList.innerHTML = groups.map(g => `
        <div class="day-group">
          <div class="day-header"><span>${escapeHtml(dayHeader(g.iso))}</span><span>${fmtEur(g.sum)}</span></div>
          ${g.items.map(e => entryHtml(e, !!e.pending)).join('')}
        </div>`).join('');
    }
    const when = sheetData.generatedAt ? new Date(sheetData.generatedAt) : null;
    historyNote.textContent = `Letzte ${(sheetData.entries || []).length} Einträge aus dem Sheet` +
      (when ? ` · Stand ${when.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '') +
      ' · Tippen zum Bearbeiten';
  }

  historyList.addEventListener('click', (e) => {
    const item = e.target.closest('.entry-item[data-row]');
    if (!item || !sheetData) return;
    const row = Number(item.dataset.row);
    const entry = (sheetData.entries || []).find(x => x.row === row);
    if (entry) openEdit(entry);
  });

  // ---------- Bearbeiten / Löschen ----------
  let deleteArmed = false;
  function resetDeleteBtn() {
    deleteArmed = false;
    editDeleteBtn.classList.remove('confirm');
    editDeleteBtn.textContent = 'Löschen';
  }

  function openEdit(entry) {
    editingEntry = entry;
    editAmount.value = String(entry.amount.toFixed(2)).replace('.', ',');
    editPosition.value = entry.position;
    editDate.value = entry.iso || '';
    editPayer.value = entry.paidBy === 'Sonja' ? 'Sonja' : 'Sascha';
    editType.value = [TYPE_PERSONAL, TYPE_TRIP].includes(entry.type) && (entry.type !== TYPE_TRIP || tripsEnabled())
      ? entry.type : TYPE_FAMILY;
    editTrip.value = entry.trip || '';
    updateEditTripGroup();
    editComment.value = entry.comment || '';
    editRowNote.textContent = `Zeile ${entry.row} im Sheet`;
    resetDeleteBtn();
    editDialog.showModal();
  }

  function updateEditTripGroup() {
    const isTrip = editType.value === TYPE_TRIP;
    editTripGroup.style.display = isTrip ? 'flex' : 'none';
    if (isTrip && !editTrip.value) editTrip.value = store.get('kostentracker_trip', '') || '';
  }
  editType.addEventListener('change', updateEditTripGroup);

  closeEditBtn.addEventListener('click', () => editDialog.close());

  function setEditBusy(busy) {
    editSaveBtn.disabled = busy;
    editDeleteBtn.disabled = busy;
  }

  editSaveBtn.addEventListener('click', async () => {
    if (!editingEntry) return;
    const amount = parseAmount(editAmount.value);
    if (isNaN(amount) || amount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben.', '⚠️', 'error');
      return;
    }
    const position = normalizePosition(editPosition.value);
    if (!position) {
      showToast('Bitte Wo/Wofür angeben.', '⚠️', 'error');
      return;
    }
    const editTripName = editType.value === TYPE_TRIP ? normalizeTrip(editTrip.value) : '';
    if (editType.value === TYPE_TRIP && !editTripName) {
      showToast('Bitte einen Reisenamen angeben.', '✈️', 'error');
      return;
    }
    if (!navigator.onLine) {
      showToast('Bearbeiten geht nur online.', '📡', 'warning');
      return;
    }
    setEditBusy(true);
    try {
      const entryBody = {
        position, amount,
        date: isoToGerman(editDate.value) || editingEntry.date,
        paidBy: editPayer.value,
        type: editType.value,
        comment: editComment.value.trim()
      };
      if (tripsEnabled()) entryBody.trip = editTripName;
      const result = await apiPost({
        action: 'update',
        row: editingEntry.row,
        expected: { position: editingEntry.position, amount: editingEntry.amount },
        entry: entryBody
      });
      if (result && result.success) {
        adjustMonth(editingEntry, -1);
        const updated = result.data;
        sheetData.entries = sheetData.entries.map(x => (x.row === editingEntry.row ? updated : x));
        adjustMonth(updated, +1);
        persistData();
        editDialog.close();
        renderAll();
        showToast('Eintrag aktualisiert.', '✏️');
        loadData(true);
      } else if (!handleAuthError(result)) {
        showToast(result && result.error ? result.error : 'Fehler beim Speichern', '❌', 'error', 5000);
        if (result && result.code === 'CONFLICT') { editDialog.close(); loadData(true); }
      }
    } catch (err) {
      showToast('Verbindung fehlgeschlagen: ' + err.message, '❌', 'error', 4500);
    } finally {
      setEditBusy(false);
    }
  });

  editDeleteBtn.addEventListener('click', async () => {
    if (!editingEntry) return;
    if (!deleteArmed) {
      deleteArmed = true;
      editDeleteBtn.classList.add('confirm');
      editDeleteBtn.textContent = 'Wirklich löschen?';
      setTimeout(() => { if (deleteArmed) resetDeleteBtn(); }, 4000);
      return;
    }
    if (!navigator.onLine) {
      showToast('Löschen geht nur online.', '📡', 'warning');
      return;
    }
    setEditBusy(true);
    try {
      const result = await apiPost({
        action: 'delete',
        row: editingEntry.row,
        expected: { position: editingEntry.position, amount: editingEntry.amount }
      });
      if (result && result.success) {
        adjustMonth(editingEntry, -1);
        const removedRow = editingEntry.row;
        // Nachfolgende Zeilen rutschen im Sheet eine Zeile nach oben
        sheetData.entries = sheetData.entries
          .filter(x => x.row !== removedRow)
          .map(x => (x.row > removedRow ? { ...x, row: x.row - 1 } : x));
        persistData();
        editDialog.close();
        renderAll();
        showToast('Eintrag gelöscht.', '🗑️');
        loadData(true);
      } else if (!handleAuthError(result)) {
        showToast(result && result.error ? result.error : 'Fehler beim Löschen', '❌', 'error', 5000);
        if (result && result.code === 'CONFLICT') { editDialog.close(); loadData(true); }
      }
    } catch (err) {
      showToast('Verbindung fehlgeschlagen: ' + err.message, '❌', 'error', 4500);
    } finally {
      setEditBusy(false);
      resetDeleteBtn();
    }
  });

  // ---------- Übersicht ----------
  function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthName(key, short = false) {
    const [y, m] = key.split('-').map(Number);
    return short ? `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}` : `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function getMonth(key) {
    const m = sheetData && (sheetData.months || []).find(x => x.month === key);
    return m || { month: key, family: {}, personal: {}, trip: {}, count: 0 };
  }

  // ---------- Monatsabschluss (Werte für die Obsidian-Monatsnotiz) ----------
  const TARGETS = { anschaffungen: 250, anschaffungenMax: 400, lebensmittel: 850 };

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Kopiert – in Obsidian bei den Properties einfügen.', '📋');
    } catch (e) {
      prompt('Zum Kopieren markieren:', text);
    }
    if (btn) { btn.textContent = '✓ Kopiert'; setTimeout(() => { btn.textContent = btn.dataset.label; }, 2000); }
  }

  function targetSpan(val, target, max) {
    if (!target) return '';
    const cls = val <= target ? 'target-ok' : (max && val <= max ? '' : 'target-bad');
    return ` <span class="${cls}" style="font-size:0.75rem;">(Ziel ≤ ${fmtEur(target)}${max ? `, max. ${fmtEur(max)}` : ''})</span>`;
  }

  function renderClose() {
    const person = currentPayer;
    closePerson.textContent = `· ${person}`;
    const key = summaryMonth;
    const entries = (sheetData.entries || []).filter(e => e.iso && e.iso.slice(0, 7) === key && e.paidBy === person);
    const recentFrom = sheetData.recentFrom || (() => {
      const isos = (sheetData.entries || []).map(e => e.iso).filter(Boolean).sort();
      return isos[0] || '';
    })();
    const complete = recentFrom && recentFrom <= `${key}-01`;

    const personal = entries.filter(e => e.type === TYPE_PERSONAL);
    const anschaffungen = personal.filter(isAnschaffung);
    const kleidung = personal.filter(e => categoryOf(e) === 'Kleidung');
    const lebensmittel = entries.filter(e => e.type !== TYPE_TRIP && categoryOf(e) === 'Lebensmittel');
    const familyBig = entries.filter(e => e.type === TYPE_FAMILY && isAnschaffung(e));
    const sum = (list) => Math.round(list.reduce((s, e) => s + (Number(e.amount) || 0), 0) * 100) / 100;

    const sA = sum(anschaffungen), sK = sum(kleidung), sL = sum(lebensmittel);
    const yaml = `anschaffungen: ${Math.round(sA)}\nkleidung: ${Math.round(sK)}\nlebensmittel: ${Math.round(sL)}`;
    const listHtml = (list) => list.length
      ? `<div class="close-list">${list.map(e => `<div><span>${escapeHtml(e.date)} · ${escapeHtml(e.position)}</span><span>${fmtEur(e.amount)}</span></div>`).join('')}</div>`
      : '';

    summaryClose.innerHTML = `
      ${complete ? '' : '<div class="muted-note" style="text-align:left; color:#fbbf24;">⚠️ Für diesen Monat liegen nicht alle Einzelbuchungen in der App vor. Werte sind unvollständig.</div>'}
      <div class="sum-row"><span>Anschaffungen ≥ 100 €${targetSpan(sA, TARGETS.anschaffungen, TARGETS.anschaffungenMax)}</span><span class="val">${fmtEur(sA)}</span></div>
      ${listHtml(anschaffungen)}
      <div class="sum-row"><span>Kleidung</span><span class="val">${fmtEur(sK)}</span></div>
      <div class="sum-row"><span>Lebensmittel (von dir bezahlt)${targetSpan(sL, TARGETS.lebensmittel)}</span><span class="val">${fmtEur(sL)}</span></div>
      ${familyBig.length ? `<div class="muted-note" style="text-align:left;">Familien-Käufe ≥ 100 € von dir (nicht mitgezählt, ggf. selbst addieren):</div>${listHtml(familyBig)}` : ''}
      <pre class="yaml-box" id="close-yaml">${escapeHtml(yaml)}</pre>
      <button type="button" class="icon-btn copy-btn" id="close-copy-btn" data-label="📋 Für Obsidian kopieren">📋 Für Obsidian kopieren</button>
      <div class="muted-note" style="text-align:left;">Topf, Bargeld und Kontostand kommen aus der Banking-App. Anschaffungen = persönliche Einträge ab 100 € ohne Lebensmittel, Kleidung und Gastro.</div>`;
    $('close-copy-btn').addEventListener('click', (e) => copyText(yaml, e.currentTarget));
  }

  // ---------- Reisen-Saldo ----------
  function formatRange(from, to) {
    if (!from) return '';
    const f = isoToGerman(from), t = isoToGerman(to || from);
    return f === t ? f : `${f} – ${t}`;
  }

  function renderTrips() {
    const trips = (sheetData.trips || []).filter(t => t.count > 0);
    tripsCard.style.display = tripsEnabled() ? 'flex' : 'none';
    if (!tripsEnabled()) return;
    if (!trips.length) {
      summaryTrips.innerHTML = '<div class="empty-state">Noch keine Reisekosten erfasst. Oben beim Erfassen „Reise“ wählen.</div>';
      return;
    }
    summaryTrips.innerHTML = trips.slice(0, 4).map((t, i) => {
      const sa = t.byPayer.Sascha || 0, so = t.byPayer.Sonja || 0;
      const diff = sa - so;
      let settle;
      if (Math.abs(diff) < 0.01) settle = '⚖️ <strong>Ausgeglichen</strong>';
      else {
        const less = diff > 0 ? 'Sonja' : 'Sascha', more = diff > 0 ? 'Sascha' : 'Sonja';
        settle = `⚖️ 50/50: <strong>${less} → ${more}: ${fmtEur(Math.abs(diff) / 2)}</strong>`;
      }
      return `
        <div class="trip-item">
          <div class="trip-name"><span>✈️ ${escapeHtml(t.name)}</span><span>${fmtEur(t.total)}</span></div>
          <div class="trip-dates">${escapeHtml(formatRange(t.from, t.to))} · ${t.count} ${t.count === 1 ? 'Eintrag' : 'Einträge'}</div>
          <div class="sum-row" style="font-size:0.85rem;"><span>Sascha bezahlt</span><span class="val">${fmtEur(sa)}</span></div>
          <div class="sum-row" style="font-size:0.85rem;"><span>Sonja bezahlt</span><span class="val">${fmtEur(so)}</span></div>
          <div class="settle trip-settle">${settle}</div>
          <button type="button" class="icon-btn copy-btn trip-copy" data-idx="${i}" data-label="📋 Für Reisenotiz kopieren">📋 Für Reisenotiz kopieren</button>
        </div>`;
    }).join('') + '<div class="muted-note" style="text-align:left;">Kopiert <code>ist_gesamt</code> und <code>anteil_sonja</code> (was Sonja direkt bezahlt hat). Helga-Anteile bitte in Obsidian ergänzen.</div>';
    summaryTrips.querySelectorAll('.trip-copy').forEach(btn => btn.addEventListener('click', (e) => {
      const t = trips[Number(e.currentTarget.dataset.idx)];
      const yaml = `ist_gesamt: ${Math.round(t.total)}\nanteil_sonja: ${Math.round(t.byPayer.Sonja || 0)}`;
      copyText(yaml, e.currentTarget);
    }));
  }

  monthPrev.addEventListener('click', () => { summaryMonth = shiftMonth(summaryMonth || currentMonthKey(), -1); renderSummary(); });
  monthNext.addEventListener('click', () => {
    const next = shiftMonth(summaryMonth || currentMonthKey(), 1);
    if (next <= currentMonthKey()) { summaryMonth = next; renderSummary(); }
  });

  function renderSummary() {
    if (!summaryMonth) summaryMonth = currentMonthKey();
    monthLabel.textContent = monthName(summaryMonth);
    monthNext.disabled = summaryMonth >= currentMonthKey();

    if (!sheetData) {
      summaryFamily.innerHTML = '<div class="empty-state">Noch keine Daten geladen.</div>';
      summaryPersonal.innerHTML = '';
      summaryTrend.innerHTML = '';
      summaryClose.innerHTML = '';
      tripsCard.style.display = 'none';
      summaryNote.textContent = '';
      return;
    }

    renderClose();
    renderTrips();

    const m = getMonth(summaryMonth);
    const fSascha = m.family.Sascha || 0;
    const fSonja = m.family.Sonja || 0;
    const fTotal = fSascha + fSonja;
    const maxF = Math.max(fSascha, fSonja, 1);

    let settleHtml;
    const diff = fSascha - fSonja;
    if (fTotal === 0) {
      settleHtml = '<div class="empty-state">Keine Familienkosten in diesem Monat.</div>';
    } else if (Math.abs(diff) < 0.01) {
      settleHtml = '<div class="settle">⚖️ <strong>Ausgeglichen</strong> – beide haben gleich viel bezahlt.</div>';
    } else {
      const payerLess = diff > 0 ? 'Sonja' : 'Sascha';
      const payerMore = diff > 0 ? 'Sascha' : 'Sonja';
      settleHtml = `<div class="settle">⚖️ Ausgleich bei 50/50: <strong>${payerLess} → ${payerMore}: ${fmtEur(Math.abs(diff) / 2)}</strong><br>
        <span style="font-size:0.8rem; opacity:0.85;">${payerMore} hat ${fmtEur(Math.abs(diff))} mehr bezahlt.</span></div>`;
    }

    summaryFamily.innerHTML = `
      <div>
        <div class="sum-row"><span>Sascha</span><span class="val">${fmtEur(fSascha)}</span></div>
        <div class="bar fam"><span style="width:${(fSascha / maxF) * 100}%"></span></div>
      </div>
      <div>
        <div class="sum-row"><span>Sonja</span><span class="val">${fmtEur(fSonja)}</span></div>
        <div class="bar fam"><span style="width:${(fSonja / maxF) * 100}%"></span></div>
      </div>
      <div class="sum-row total"><span>Gesamt</span><span class="val">${fmtEur(fTotal)}</span></div>
      ${settleHtml}`;

    const pSascha = m.personal.Sascha || 0;
    const pSonja = m.personal.Sonja || 0;
    const personRows = [['Sascha', pSascha], ['Sonja', pSonja]]
      .filter(([name, val]) => val > 0 || name === currentPayer)
      .map(([name, val]) => `<div class="sum-row"><span>${name}${name === currentPayer ? ' <span class="type-badge">du</span>' : ''}</span><span class="val">${fmtEur(val)}</span></div>`)
      .join('');

    // Ø der letzten 12 abgeschlossenen Monate
    let avgF = 0, avgP = 0;
    for (let i = 1; i <= 12; i++) {
      const mm = getMonth(shiftMonth(currentMonthKey(), -i));
      avgF += (mm.family.Sascha || 0) + (mm.family.Sonja || 0);
      avgP += mm.personal[currentPayer] || 0;
    }
    avgF /= 12; avgP /= 12;

    summaryPersonal.innerHTML = personRows +
      (pSascha + pSonja === 0 ? '<div class="muted-note" style="text-align:left;">Noch keine persönlichen Kosten in diesem Monat. Zum Erfassen oben „Persönlich“ wählen.</div>' : '') +
      `<div class="muted-note" style="text-align:left;">Ø pro Monat (12 Monate): Familie ${fmtEur(avgF)} · Persönlich ${currentPayer} ${fmtEur(avgP)}</div>`;

    // Trend: letzte 6 Monate bis zum gewählten Monat
    trendPerson.textContent = currentPayer;
    const keys = [];
    for (let i = 5; i >= 0; i--) keys.push(shiftMonth(summaryMonth, -i));
    const rows = keys.map(k => {
      const mm = getMonth(k);
      return { k, fam: (mm.family.Sascha || 0) + (mm.family.Sonja || 0), per: mm.personal[currentPayer] || 0 };
    });
    const maxT = Math.max(1, ...rows.map(r => Math.max(r.fam, r.per)));
    summaryTrend.innerHTML = rows.map(r => `
      <div>
        <div class="trend-row"><span class="lbl">${monthName(r.k, true)}</span>
          <div class="bar fam"><span style="width:${(r.fam / maxT) * 100}%"></span></div>
          <span class="num">${fmtEur(r.fam)}</span></div>
        <div class="trend-row"><span></span>
          <div class="bar per"><span style="width:${(r.per / maxT) * 100}%"></span></div>
          <span class="num" style="color:#c4b5fd;">${fmtEur(r.per)}</span></div>
      </div>`).join('');

    const when = sheetData.generatedAt ? new Date(sheetData.generatedAt) : null;
    summaryNote.textContent = 'Nur variable Kosten aus „Familie Variable Kosten“' +
      (tripsEnabled() ? ' · Reisen zählen nicht im Familien-Ausgleich' : '') +
      (when ? ` · Stand ${when.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '');
  }

  function renderAll() {
    applyCapabilities();
    renderChips();
    renderSuggestions();
    renderHistory();
    renderSummary();
  }

  // ---------- Settings ----------
  function updateShareButton() {
    const config = getApiConfig();
    if (shareLinkBtn) shareLinkBtn.style.display = (config.apiUrl && config.apiUrl.startsWith('http')) ? 'block' : 'none';
  }

  function openSettings() {
    const config = getApiConfig();
    cfgApiUrl.value = config.apiUrl;
    cfgSecretToken.value = config.secretToken;
    updateShareButton();
    settingsDialog.showModal();
  }

  openSettingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', () => settingsDialog.close());

  saveSettingsBtn.addEventListener('click', () => {
    const url = cfgApiUrl.value.trim();
    const token = cfgSecretToken.value.trim();
    if (!url) {
      showToast('Bitte die Web-App-URL einfügen!', '⚠️', 'error', 4000);
      cfgApiUrl.focus();
      return;
    }
    if (!url.startsWith('https://script.google.com/')) {
      showToast('URL muss mit https://script.google.com/ beginnen.', '⚠️', 'error', 4500);
      cfgApiUrl.focus();
      return;
    }
    store.set('kostentracker_api_url', url);
    store.set('kostentracker_secret_token', token);
    settingsDialog.close();
    showToast('Einstellungen gespeichert!', '⚙️');
    updateConnectionStatus();
    updateShareButton();
    loadData(true);
    syncOfflineQueue();
  });

  if (shareLinkBtn) {
    shareLinkBtn.addEventListener('click', () => {
      const config = getApiConfig();
      if (!config.apiUrl) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?api=${encodeURIComponent(config.apiUrl)}${config.secretToken ? '&token=' + encodeURIComponent(config.secretToken) : ''}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('Link kopiert! Per WhatsApp an Sonja senden.', '📋', 'success', 4500);
        }).catch(() => prompt('Persönlicher Einrichtungs-Link für Sonja:', shareUrl));
      } else {
        prompt('Persönlicher Einrichtungs-Link für Sonja:', shareUrl);
      }
    });
  }

  testConnectionBtn.addEventListener('click', async () => {
    const url = cfgApiUrl.value.trim();
    if (!url) {
      showToast('Bitte zuerst eine URL eintragen.', '⚠️', 'error');
      cfgApiUrl.focus();
      return;
    }
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Prüfe...';
    try {
      const sep = url.includes('?') ? '&' : '?';
      const resp = await fetch(`${url}${sep}action=ping&token=${encodeURIComponent(cfgSecretToken.value.trim())}&_=${Date.now()}`);
      const data = await resp.json();
      if (data && data.status === 'ok') {
        if (data.authOk === false) {
          showToast('Verbindung ok, aber Token falsch oder fehlt.', '🔒', 'warning', 5000);
        } else if (!data.version) {
          showToast('Verbindung ok – aber alte Code.gs-Version. Bitte neue Version bereitstellen.', '⚠️', 'warning', 6000);
        } else if (!(data.types || []).includes(TYPE_TRIP)) {
          showToast(`Verbindung & Token ok (Backend v${data.version}). Für „Reise“ Code.gs v3.1 bereitstellen.`, '✅', 'success', 5000);
        } else {
          showToast(`Verbindung & Token ok (Backend v${data.version}).`, '✅', 'success', 4000);
        }
        updateShareButton();
      } else {
        showToast('Antwort erhalten, aber unerwartetes Format.', '⚠️', 'warning', 4000);
      }
    } catch (err) {
      showToast('Verbindung fehlgeschlagen: ' + err.message, '❌', 'error', 4500);
    } finally {
      testConnectionBtn.disabled = false;
      testConnectionBtn.textContent = 'Verbindung testen';
    }
  });

  if (pasteClipboardBtn) {
    pasteClipboardBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            cfgApiUrl.value = text.trim();
            showToast('URL eingefügt!', '📋');
          } else {
            showToast('Zwischenablage ist leer.', '⚠️');
          }
        } else {
          showToast('Bitte URL manuell in das Feld einfügen.', 'ℹ️');
          cfgApiUrl.focus();
        }
      } catch (err) {
        showToast('Zugriff auf Zwischenablage verweigert.', '⚠️');
        cfgApiUrl.focus();
      }
    });
  }

  if (forceReloadBtn) {
    forceReloadBtn.addEventListener('click', async () => {
      showToast('Cache wird geleert...', '🔄');
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) await reg.unregister();
      }
      setTimeout(() => window.location.reload(), 500);
    });
  }

  // ---------- Init ----------
  setPayer(currentPayer);
  setType(currentType);
  setToday();
  updateConnectionStatus();
  renderAll();
  loadData(true);
  syncOfflineQueue();

  // Wenn die App aus dem Hintergrund zurückkommt: Daten auffrischen
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadData(false);
  });

  // ---------- Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=3.1')
        .then((reg) => {
          reg.update();
          console.log('Service Worker v3.1 aktiv.');
        })
        .catch(err => console.warn('Service Worker Registrierung fehlgeschlagen:', err));
    });
  }
});
