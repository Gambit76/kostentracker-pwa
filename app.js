/**
 * Kostentracker PWA - Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const btnSascha = document.getElementById('btn-sascha');
  const btnSonja = document.getElementById('btn-sonja');
  const expenseForm = document.getElementById('expense-form');
  const amountInput = document.getElementById('amount-input');
  const positionInput = document.getElementById('position-input');
  const quickChips = document.querySelectorAll('.chip-btn');
  const dateInput = document.getElementById('date-input');
  const btnToday = document.getElementById('btn-today');
  const btnYesterday = document.getElementById('btn-yesterday');
  const toggleCommentBtn = document.getElementById('toggle-comment-btn');
  const commentBox = document.getElementById('comment-box');
  const commentInput = document.getElementById('comment-input');
  const commentIcon = document.getElementById('comment-toggle-icon');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnLabel = document.getElementById('btn-label');
  const toast = document.getElementById('toast');
  const toastIcon = document.getElementById('toast-icon');
  const toastText = document.getElementById('toast-text');
  const offlineBanner = document.getElementById('offline-banner');
  const offlineMessage = document.getElementById('offline-message');
  const syncNowBtn = document.getElementById('sync-now-btn');
  const statusDot = document.getElementById('status-dot');
  const connectionText = document.getElementById('connection-text');
  const recentList = document.getElementById('recent-list');
  const recentCount = document.getElementById('recent-count');

  // Settings Elements
  const settingsDialog = document.getElementById('settings-dialog');
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const cfgApiUrl = document.getElementById('cfg-api-url');
  const cfgSecretToken = document.getElementById('cfg-secret-token');

  // State
  let currentPayer = localStorage.getItem('kostentracker_payer') || 'Sascha';
  let offlineQueue = JSON.parse(localStorage.getItem('kostentracker_queue') || '[]');
  let recentEntries = JSON.parse(localStorage.getItem('kostentracker_recent') || '[]');
  let isSyncing = false;

  // Initialize Payer
  function setPayer(payer) {
    currentPayer = payer;
    localStorage.setItem('kostentracker_payer', payer);
    btnSascha.classList.toggle('active', payer === 'Sascha');
    btnSonja.classList.toggle('active', payer === 'Sonja');
  }

  btnSascha.addEventListener('click', () => setPayer('Sascha'));
  btnSonja.addEventListener('click', () => setPayer('Sonja'));
  setPayer(currentPayer);

  // Initialize Date (Default: Today in YYYY-MM-DD for HTML5 date input)
  function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function setToday() {
    dateInput.value = formatDateForInput(new Date());
  }

  function setYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateInput.value = formatDateForInput(yesterday);
  }

  setToday();
  btnToday.addEventListener('click', setToday);
  btnYesterday.addEventListener('click', setYesterday);

  // Quick Chips
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const pos = chip.dataset.pos;
      positionInput.value = pos;
      quickChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      if (amountInput.value) {
        submitBtn.focus();
      } else {
        amountInput.focus();
      }
    });
  });

  positionInput.addEventListener('input', () => {
    quickChips.forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.pos.toLowerCase() === positionInput.value.trim().toLowerCase());
    });
  });

  // Collapsible Comment
  toggleCommentBtn.addEventListener('click', () => {
    const isOpen = commentBox.classList.toggle('open');
    commentIcon.textContent = isOpen ? '−' : '＋';
    if (isOpen) {
      commentInput.focus();
    }
  });

  // Toast Notification
  let toastTimer = null;
  function showToast(text, icon = '✅', type = 'success', duration = 3000) {
    clearTimeout(toastTimer);
    toastText.textContent = text;
    toastIcon.textContent = icon;
    toast.className = `toast show ${type}`;
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // API Config Helper
  function getApiConfig() {
    const storedUrl = localStorage.getItem('kostentracker_api_url');
    const storedToken = localStorage.getItem('kostentracker_secret_token');
    const windowConfig = window.APP_CONFIG || {};

    return {
      apiUrl: storedUrl || windowConfig.API_URL || '',
      secretToken: storedToken !== null ? storedToken : (windowConfig.SECRET_TOKEN || '')
    };
  }

  // Connectivity & Status
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
  updateConnectionStatus();

  // Recent Entries Rendering
  function renderRecentEntries() {
    if (!recentEntries || recentEntries.length === 0) {
      recentList.innerHTML = '<div style="color: var(--text-subtle); font-size: 0.82rem; text-align: center; padding: 10px;">Noch keine Einträge in dieser Sitzung.</div>';
      recentCount.textContent = '0 Einträge';
      return;
    }

    recentCount.textContent = `${recentEntries.length} ${recentEntries.length === 1 ? 'Eintrag' : 'Einträge'}`;
    recentList.innerHTML = recentEntries.map(entry => `
      <div class="recent-item">
        <div class="recent-item-info">
          <span class="recent-item-pos">${escapeHtml(entry.position)}</span>
          <span class="recent-item-meta">${entry.date} · ${entry.paidBy}${entry.comment ? ' · ' + escapeHtml(entry.comment) : ''}</span>
        </div>
        <span class="recent-item-amount">${entry.amount.toFixed(2).replace('.', ',')} €</span>
      </div>
    `).join('');
  }

  function addRecentEntry(entry) {
    recentEntries.unshift(entry);
    if (recentEntries.length > 10) recentEntries.pop();
    localStorage.setItem('kostentracker_recent', JSON.stringify(recentEntries));
    renderRecentEntries();
  }

  renderRecentEntries();

  // Helper: Format Date from YYYY-MM-DD to DD.MM.YYYY
  function formatGermanDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  // Parse Amount (e.g. "14,99" or "14.99")
  function parseAmount(val) {
    if (!val) return NaN;
    const clean = val.replace('€', '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(clean);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // Form Submit Handler
  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawAmount = amountInput.value.trim();
    const numericAmount = parseAmount(rawAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      showToast('Bitte einen gültigen Betrag eingeben.', '⚠️', 'error');
      amountInput.focus();
      return;
    }

    const position = positionInput.value.trim();
    if (!position) {
      showToast('Bitte Wo/Wofür angeben.', '⚠️', 'error');
      positionInput.focus();
      return;
    }

    const rawDate = dateInput.value;
    const formattedDate = formatGermanDate(rawDate);
    const comment = commentInput.value.trim();
    const config = getApiConfig();

    const payload = {
      position: position,
      amount: numericAmount,
      date: formattedDate,
      paidBy: currentPayer,
      comment: comment,
      token: config.secretToken
    };

    // Check if API URL is configured
    if (!config.apiUrl) {
      settingsDialog.showModal();
      showToast('Bitte zuerst Google Web-App URL hinterlegen.', '⚙️', 'warning', 4000);
      return;
    }

    // If Offline: Queue it
    if (!navigator.onLine) {
      queueEntry(payload);
      resetFormAfterSubmit();
      showToast('Offline gespeichert (wird synchronisiert).', '💾', 'warning');
      return;
    }

    // Online: Submit to Google Apps Script Web App
    setLoadingState(true);

    try {
      // Use text/plain with POST to avoid CORS preflight options check in Google Apps Script
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result && result.success) {
        if (navigator.vibrate) {
          navigator.vibrate([40, 50, 40]);
        }
        showToast('Erfolgreich im Sheet gespeichert!', '✅', 'success');
        addRecentEntry(payload);
        resetFormAfterSubmit();
      } else {
        const errMsg = result && result.error ? result.error : 'Fehler beim Speichern';
        showToast(errMsg, '❌', 'error', 4500);
      }
    } catch (err) {
      console.warn('Network error, saving to offline queue:', err);
      queueEntry(payload);
      resetFormAfterSubmit();
      showToast('Verbindung fehlgeschlagen – offline gespeichert.', '💾', 'warning');
    } finally {
      setLoadingState(false);
    }
  });

  function queueEntry(payload) {
    offlineQueue.push({
      ...payload,
      queuedAt: new Date().toISOString()
    });
    localStorage.setItem('kostentracker_queue', JSON.stringify(offlineQueue));
    addRecentEntry({ ...payload, isOffline: true });
    updateQueueBanner();
  }

  async function syncOfflineQueue() {
    if (isSyncing || offlineQueue.length === 0 || !navigator.onLine) return;

    const config = getApiConfig();
    if (!config.apiUrl) return;

    isSyncing = true;
    syncNowBtn.disabled = true;
    syncNowBtn.textContent = 'Synchronisiere...';

    const itemsToSync = [...offlineQueue];
    let syncedCount = 0;
    const remainingQueue = [];

    for (const item of itemsToSync) {
      try {
        const response = await fetch(config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(item)
        });
        const result = await response.json();
        if (result && result.success) {
          syncedCount++;
        } else {
          remainingQueue.push(item);
        }
      } catch (err) {
        remainingQueue.push(item);
      }
    }

    offlineQueue = remainingQueue;
    localStorage.setItem('kostentracker_queue', JSON.stringify(offlineQueue));
    updateQueueBanner();
    syncNowBtn.disabled = false;
    syncNowBtn.textContent = 'Jetzt synchronisieren';
    isSyncing = false;

    if (syncedCount > 0) {
      showToast(`${syncedCount} ${syncedCount === 1 ? 'Eintrag' : 'Einträge'} synchronisiert!`, '✅');
    }
  }

  function setLoadingState(loading) {
    submitBtn.disabled = loading;
    btnSpinner.style.display = loading ? 'inline-block' : 'none';
    btnLabel.textContent = loading ? 'Wird gespeichert...' : 'Eintrag speichern';
  }

  function resetFormAfterSubmit() {
    amountInput.value = '';
    positionInput.value = '';
    quickChips.forEach(chip => chip.classList.remove('selected'));
    commentInput.value = '';
    commentBox.classList.remove('open');
    commentIcon.textContent = '＋';
    setToday();
    amountInput.focus();
  }

  // Settings Dialog Logic
  openSettingsBtn.addEventListener('click', () => {
    const config = getApiConfig();
    cfgApiUrl.value = config.apiUrl;
    cfgSecretToken.value = config.secretToken;
    settingsDialog.showModal();
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsDialog.close();
  });

  saveSettingsBtn.addEventListener('click', () => {
    const url = cfgApiUrl.value.trim();
    const token = cfgSecretToken.value.trim();
    localStorage.setItem('kostentracker_api_url', url);
    localStorage.setItem('kostentracker_secret_token', token);
    settingsDialog.close();
    showToast('Einstellungen gespeichert!', '⚙️');
    updateConnectionStatus();
  });

  testConnectionBtn.addEventListener('click', async () => {
    const url = cfgApiUrl.value.trim();
    if (!url) {
      showToast('Bitte zuerst eine URL eintragen.', '⚠️', 'error');
      return;
    }

    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Prüfe...';

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data && data.status === 'ok') {
        showToast('Verbindung erfolgreich! Sheet: ' + data.sheet, '✅', 'success', 4000);
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

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registriert.'))
        .catch(err => console.warn('Service Worker Registrierung fehlgeschlagen:', err));
    });
  }
});
