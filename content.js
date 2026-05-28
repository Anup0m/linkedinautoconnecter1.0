// LinkedIn Auto-Connect Pro - Content Script (MVP - Real LinkedIn)
// This script runs on *.linkedin.com/* pages and handles all DOM interaction.

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  let state = {
    active: false,
    paused: false,
    sentThisSession: 0,
    sessionLimit: 20,
    delayMin: 4,
    delayMax: 9,
    enableNotes: false,
    userCollege: "",
    userField: "",
    activeTemplate: "",
    sentProfiles: {},
    quotaCount: 0,
    weeklyLimit: 100,
    // Cool-down tracking
    recentTimestamps: [],
    cooldownActive: false,
    // Scroll retry tracking
    scrollRetries: 0,
    maxScrollRetries: 3,
    // Session batch for undo
    sessionBatch: []
  };

  let domElements = {
    panel: null,
    statusDot: null,
    statusText: null,
    sentCountVal: null,
    weeklyVal: null,
    progressBar: null,
    btnStart: null,
    btnPause: null,
    btnStop: null,
    logList: null,
    cooldownDisplay: null
  };

  // ═══════════════════════════════════════════════════════════════
  // INJECT FLOATING PANEL UI
  // ═══════════════════════════════════════════════════════════════
  function injectPanel() {
    if (document.getElementById('lac-floating-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'lac-floating-panel';
    panel.className = 'lac-panel';
    panel.innerHTML = `
      <div class="lac-header">
        <div class="lac-brand">
          <div class="lac-logo-glow"></div>
          <span class="lac-title">Auto-Connect Pro</span>
        </div>
        <button class="lac-btn-close" id="lac-btn-hide" title="Minimize Panel">×</button>
      </div>
      <div class="lac-status-row">
        <div class="lac-status-label">
          <div class="lac-indicator" id="lac-status-dot"></div>
          <span>Status:</span>
        </div>
        <span class="lac-status-text" id="lac-status-txt">Idle</span>
      </div>
      <div class="lac-progress-outer">
        <div class="lac-progress-inner" id="lac-progress-bar"></div>
      </div>
      <div class="lac-stats-grid">
        <div class="lac-stat-card">
          <div class="lac-stat-val" id="lac-stat-sent">0</div>
          <div class="lac-stat-lbl">Sent (Session)</div>
        </div>
        <div class="lac-stat-card">
          <div class="lac-stat-val" id="lac-stat-weekly">0 / 100</div>
          <div class="lac-stat-lbl">Weekly Quota</div>
        </div>
      </div>
      <div class="lac-quick-settings">
        <div class="lac-setting-row">
          <span class="lac-setting-lbl">Session Limit:</span>
          <input type="number" class="lac-setting-input" id="lac-limit-input" value="20" min="1" max="100" />
        </div>
        <div class="lac-setting-row">
          <span class="lac-setting-lbl">Delay Range:</span>
          <span class="lac-setting-val"><span id="lac-delay-min">4</span>s - <span id="lac-delay-max">9</span>s</span>
        </div>
        <div class="lac-setting-row">
          <span class="lac-setting-lbl">Custom Notes:</span>
          <span class="lac-setting-val" id="lac-notes-toggle-status">Disabled</span>
        </div>
      </div>
      <div class="lac-cooldown-bar" id="lac-cooldown-display" style="display:none;">
        <span class="lac-cooldown-text">⏳ Cool-down active: <span id="lac-cooldown-timer">60</span>s remaining</span>
      </div>
      <ul class="lac-log" id="lac-log-list">
        <li class="lac-log-item">Panel loaded. Ready to connect!</li>
      </ul>
      <div class="lac-actions">
        <button class="lac-btn lac-btn-start" id="lac-btn-start">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Start
        </button>
        <button class="lac-btn lac-btn-pause" id="lac-btn-pause" style="display: none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause
        </button>
        <button class="lac-btn lac-btn-stop" id="lac-btn-stop" style="display: none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg> Stop
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    // Cache DOM elements
    domElements.panel = panel;
    domElements.statusDot = document.getElementById('lac-status-dot');
    domElements.statusText = document.getElementById('lac-status-txt');
    domElements.sentCountVal = document.getElementById('lac-stat-sent');
    domElements.weeklyVal = document.getElementById('lac-stat-weekly');
    domElements.progressBar = document.getElementById('lac-progress-bar');
    domElements.btnStart = document.getElementById('lac-btn-start');
    domElements.btnPause = document.getElementById('lac-btn-pause');
    domElements.btnStop = document.getElementById('lac-btn-stop');
    domElements.logList = document.getElementById('lac-log-list');
    domElements.cooldownDisplay = document.getElementById('lac-cooldown-display');

    // Event listeners
    domElements.btnStart.addEventListener('click', startSession);
    domElements.btnPause.addEventListener('click', togglePause);
    domElements.btnStop.addEventListener('click', stopSession);

    document.getElementById('lac-btn-hide').addEventListener('click', () => {
      panel.style.transform = 'translateY(120%)';
      addLog("Panel minimized. Click extension icon or reload to restore.", "warn");
      setTimeout(() => { panel.style.display = 'none'; }, 500);
    });

    document.getElementById('lac-limit-input').addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0 && val <= 100) {
        state.sessionLimit = val;
        addLog(`Session limit updated to ${val}`);
      }
    });

    updateUI();
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════
  function addLog(msg, type = "info") {
    if (!domElements.logList) return;
    const li = document.createElement('li');
    li.className = 'lac-log-item';
    if (type === "success") li.classList.add('lac-log-success');
    if (type === "warn") li.classList.add('lac-log-warn');
    if (type === "err") li.classList.add('lac-log-err');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    li.innerText = `[${time}] ${msg}`;
    domElements.logList.appendChild(li);
    domElements.logList.scrollTop = domElements.logList.scrollHeight;

    // Keep log manageable (max 50 entries)
    while (domElements.logList.children.length > 50) {
      domElements.logList.removeChild(domElements.logList.firstChild);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI STATE UPDATES
  // ═══════════════════════════════════════════════════════════════
  function updateUI() {
    if (!domElements.panel) return;

    // Status indicators
    domElements.statusDot.className = 'lac-indicator';
    if (!state.active) {
      domElements.statusDot.classList.add('lac-status-idle');
      domElements.statusText.innerText = "Idle";
      domElements.btnStart.style.display = 'flex';
      domElements.btnPause.style.display = 'none';
      domElements.btnStop.style.display = 'none';
    } else if (state.cooldownActive) {
      domElements.statusDot.classList.add('lac-status-paused');
      domElements.statusText.innerText = "Cooling down...";
      domElements.btnStart.style.display = 'none';
      domElements.btnPause.style.display = 'none';
      domElements.btnStop.style.display = 'flex';
    } else if (state.paused) {
      domElements.statusDot.classList.add('lac-status-paused');
      domElements.statusText.innerText = "Paused";
      domElements.btnStart.style.display = 'none';
      domElements.btnPause.style.display = 'flex';
      domElements.btnPause.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Resume`;
      domElements.btnStop.style.display = 'flex';
    } else {
      domElements.statusDot.classList.add('lac-status-connecting');
      domElements.statusText.innerText = "Running...";
      domElements.btnStart.style.display = 'none';
      domElements.btnPause.style.display = 'flex';
      domElements.btnPause.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause`;
      domElements.btnStop.style.display = 'flex';
    }

    // Metrics
    domElements.sentCountVal.innerText = state.sentThisSession;
    domElements.weeklyVal.innerText = `${state.quotaCount} / ${state.weeklyLimit}`;

    // Quota warning color
    if (state.quotaCount >= state.weeklyLimit * 0.8) {
      domElements.weeklyVal.style.color = '#ef4444';
    } else {
      domElements.weeklyVal.style.color = '';
    }

    // Progress bar
    const progressPercent = Math.min((state.sentThisSession / state.sessionLimit) * 100, 100);
    domElements.progressBar.style.width = `${progressPercent}%`;

    // Quick settings sync
    document.getElementById('lac-delay-min').innerText = state.delayMin;
    document.getElementById('lac-delay-max').innerText = state.delayMax;
    document.getElementById('lac-notes-toggle-status').innerText = state.enableNotes ? "Enabled" : "Disabled";
    document.getElementById('lac-notes-toggle-status').style.color = state.enableNotes ? "#06b6d4" : "#94a3b8";
  }

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS LOADER
  // ═══════════════════════════════════════════════════════════════
  function loadSettings(callback) {
    chrome.storage.local.get(['settings', 'templates', 'activeTemplateId', 'sentProfiles', 'quotaLog'], (res) => {
      if (res.settings) {
        state.delayMin = res.settings.delayMin || 4;
        state.delayMax = res.settings.delayMax || 9;
        state.sessionLimit = res.settings.sessionLimit || 20;
        state.weeklyLimit = res.settings.weeklyLimit || 100;
        state.enableNotes = res.settings.enableNotes || false;
        state.userCollege = res.settings.userCollege || "";
        state.userField = res.settings.userField || "";
      }

      if (res.templates && res.activeTemplateId) {
        const activeT = res.templates.find(t => t.id === res.activeTemplateId);
        state.activeTemplate = activeT ? activeT.text : "";
      }

      state.sentProfiles = res.sentProfiles || {};

      // Compute rolling weekly quota
      const quotaLog = res.quotaLog || [];
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      state.quotaCount = quotaLog.filter(ts => ts > sevenDaysAgo).length;

      const limitInput = document.getElementById('lac-limit-input');
      if (limitInput) limitInput.value = state.sessionLimit;

      updateUI();
      if (callback) callback();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CONNECT BUTTON DISCOVERY (Multi-Strategy)
  // ═══════════════════════════════════════════════════════════════
  function findConnectButtons() {
    const allButtons = Array.from(document.querySelectorAll('button'));
    const connectButtons = [];
    const seen = new Set(); // Deduplicate within same scan

    for (const btn of allButtons) {
      // Skip if button is inside a modal (don't queue modal buttons)
      if (btn.closest('.artdeco-modal, [role="dialog"], .artdeco-modal-overlay')) continue;

      // Skip disabled buttons
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') continue;

      const text = (btn.innerText || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

      let isConnect = false;

      // Strategy 1: aria-label starts with "invite" (LinkedIn's current primary pattern)
      if (ariaLabel.startsWith('invite') && ariaLabel.includes('to connect')) {
        isConnect = true;
      }
      // Strategy 2: aria-label starts with "connect with" or "connect to"
      else if (ariaLabel.startsWith('connect with') || ariaLabel.startsWith('connect to')) {
        isConnect = true;
      }
      // Strategy 3: Button text is exactly "Connect" (common in PYMK cards)
      else if (text === 'connect') {
        isConnect = true;
      }
      // Strategy 4: Button contains an icon + "Connect" text (some card layouts)
      else if (text.includes('connect') && !text.includes('connected') && !text.includes('disconnect')) {
        // Check it's not a "1st" / "2nd" / "3rd" degree link already
        const parentCard = btn.closest('li, [data-urn], .discover-entity-card, .mn-discovery-card');
        if (parentCard) {
          const degreeText = parentCard.innerText || '';
          if (!degreeText.match(/\b1st\b/) && !degreeText.includes('Connected')) {
            isConnect = true;
          }
        } else {
          isConnect = true;
        }
      }

      if (!isConnect) continue;

      // Exclude pending, follow, message, or already-connected states
      const isPending = text.includes('pending') || ariaLabel.includes('pending');
      const isMessage = text.includes('message') || ariaLabel.includes('message');
      const isFollow = text === 'follow' || ariaLabel.includes('follow');
      const isWithdraw = text.includes('withdraw') || ariaLabel.includes('withdraw');

      if (isPending || isMessage || isFollow || isWithdraw) continue;

      // Extract profile info
      const info = extractProfileInfo(btn);

      // Deduplicate: skip already-sent profiles and already-queued in this scan
      if (state.sentProfiles[info.url] || seen.has(info.url)) continue;
      seen.add(info.url);

      connectButtons.push({ button: btn, ...info });
    }

    return connectButtons;
  }

  // ═══════════════════════════════════════════════════════════════
  // PROFILE INFO EXTRACTION
  // ═══════════════════════════════════════════════════════════════
  function extractProfileInfo(buttonElement) {
    let name = "Professional";
    let url = "";

    // Traverse up to find the card/container
    const card = buttonElement.closest(
      // LinkedIn uses various card structures across different pages
      '.org-people-profile-card, ' +          // Alumni page
      '.entity-result, ' +                     // Search results
      '.discover-entity-card, ' +              // PYMK cards
      '.mn-discovery-card, ' +                 // My Network discovery
      '.artdeco-card, ' +                      // Generic card
      'li[class*="result"], ' +                // List-based results
      'li, ' +                                 // Fallback list items
      '[data-urn]'                             // Data-urn tagged containers
    );

    if (card) {
      // Find profile anchor (multiple strategies)
      const anchor = card.querySelector(
        'a[href*="/in/"], ' +
        'a.app-aware-link[href*="/in/"], ' +
        'a.discover-person-card__link'
      );

      if (anchor) {
        url = anchor.href.split('?')[0]; // Strip query params

        // Find the name from various LinkedIn title structures
        const titleEl = card.querySelector(
          '.org-people-profile-card__profile-title, ' +
          '.entity-result__title-text a span[aria-hidden="true"], ' +
          '.entity-result__title-text span[aria-hidden="true"], ' +
          '.entity-result__title-line span[dir="ltr"] span[aria-hidden="true"], ' +
          '.discover-person-card__name, ' +
          '.mn-discovery-card__name, ' +
          'span[aria-hidden="true"], ' +
          'span[dir="ltr"]'
        );

        if (titleEl) {
          name = titleEl.innerText.trim().split('\n')[0];
        } else if (anchor.innerText.trim()) {
          name = anchor.innerText.trim().split('\n')[0];
        }
      }
    }

    // Fallback: parse name from aria-label
    if (!url || name === "Professional") {
      const ariaLabel = buttonElement.getAttribute('aria-label') || '';

      // "Invite NAME to connect" (current LinkedIn pattern)
      let match = ariaLabel.match(/invite\s+(.+?)\s+to connect/i);
      if (!match) {
        // "Connect with NAME"
        match = ariaLabel.match(/connect (?:with|to)\s+([^,]+)/i);
      }

      if (match && match[1]) {
        name = match[1].trim();
      }

      // If no URL found, create a virtual key for dedup
      if (!url) {
        url = `virtual-id:${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      }
    }

    // Clean up: remove pronouns, titles, extra lines
    name = name
      .split('\n')[0]
      .replace(/\s*(?:\(|,)\s*(?:he\/him|she\/her|they\/them|dr\.|ph\.?d\.?|MBA|CPA|PMP|CISSP)\s*(?:\)|$)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit name length
    if (name.length > 60) name = name.substring(0, 57) + '...';

    return { name, url };
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelay() {
    return (Math.floor(Math.random() * (state.delayMax - state.delayMin + 1)) + state.delayMin) * 1000;
  }

  // ═══════════════════════════════════════════════════════════════
  // TEMPLATE COMPILER
  // ═══════════════════════════════════════════════════════════════
  function compileTemplate(templateStr, firstName) {
    return templateStr
      .replace(/{first_name}/g, firstName)
      .replace(/{college}/g, state.userCollege || "our college")
      .replace(/{field}/g, state.userField || "this field");
  }

  // ═══════════════════════════════════════════════════════════════
  // REACT-COMPATIBLE INPUT INJECTION
  // Uses native value setter to bypass React's controlled components
  // ═══════════════════════════════════════════════════════════════
  function setReactInputValue(element, value) {
    // Get the native setter — this is how we bypass React's controlled input guard
    const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    const setter = element.tagName === 'TEXTAREA' ? nativeTextAreaSetter : nativeInputSetter;

    if (setter) {
      setter.call(element, value);
    } else {
      // Fallback
      element.value = value;
    }

    // Dispatch events that React listens to
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Also dispatch React's internal event tracking (React 16+)
    const reactKey = Object.keys(element).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (reactKey) {
      // Trigger React's onChange by simulating a native event
      const nativeEvent = new Event('input', { bubbles: true });
      Object.defineProperty(nativeEvent, 'target', { writable: false, value: element });
      element.dispatchEvent(nativeEvent);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECURITY / SAFETY CHECKS
  // ═══════════════════════════════════════════════════════════════
  function checkForSecurityBlocks() {
    // 1. Check for CAPTCHA iframes - Only flag if the iframe is actually visible to the user
    // (Filtering out hidden, background, tracking, or SSO-related iframes)
    const captchaIframes = Array.from(document.querySelectorAll('iframe[src*="captcha"], iframe[src*="challenge"], iframe[title*="captcha"], iframe[src*="arkoselabs"]'));
    const visibleCaptchaIframes = captchaIframes.filter(iframe => {
      try {
        const rect = iframe.getBoundingClientRect();
        const style = window.getComputedStyle(iframe);
        // A visible blocking CAPTCHA must have positive dimensions and not be hidden via CSS styles
        return rect.width > 50 && rect.height > 50 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
      } catch (e) {
        return false;
      }
    });

    if (visibleCaptchaIframes.length > 0) {
      return { blocked: true, reason: "CAPTCHA detected" };
    }

    // 2. Check for security challenge dialog
    // Flag if there's a visible blocking challenge dialog
    const challengeDialog = document.querySelector('.challenge-dialog, [data-test-modal="challenge"]');
    if (challengeDialog) {
      const style = window.getComputedStyle(challengeDialog);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        return { blocked: true, reason: "Security challenge dialog detected" };
      }
    }

    // 3. Check page text for restriction indicators
    // Real security blocks/checkpoints will strip out global navigation bars and redirect the user.
    // If global nav is present, any security-related keywords in feed posts or search results are false positives.
    const hasGlobalNav = document.getElementById('global-nav') !== null || document.querySelector('.global-nav') !== null;
    const isCheckpointPage = location.pathname.includes('/checkpoint/') || location.pathname.includes('/challenge/') || location.pathname.includes('/login/checkpoint');

    // We only enforce text-based restriction checks if either:
    // - We are on a known checkpoint URL, OR
    // - The global navigation header is NOT present (meaning a full-page blocker/checkpoint is active)
    if (isCheckpointPage || !hasGlobalNav) {
      const bodyText = document.body.innerText.toLowerCase();
      const restrictionPhrases = [
        'unusual activity',
        'verify your identity',
        'security verification',
        'we noticed unusual',
        'restricted your account',
        'account restricted',
        'let us know you\'re not a robot'
      ];

      for (const phrase of restrictionPhrases) {
        if (bodyText.includes(phrase)) {
          return { blocked: true, reason: `Security restriction: "${phrase}"` };
        }
      }
    }

    return { blocked: false };
  }

  function checkForWeeklyLimitModal() {
    const bodyText = document.body.innerText.toLowerCase();
    const limitPhrases = [
      'reached your weekly invitation limit',
      'reached the weekly invitation limit',
      'out of invitations',
      'you\'ve reached the weekly limit',
      'invitation limit',
      'you can send up to'
    ];
    return limitPhrases.some(p => bodyText.includes(p));
  }

  function checkForEmailRequired() {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes("enter an email") ||
           bodyText.includes("enter their email") ||
           bodyText.includes("how do you know") ||
           bodyText.includes("we need their email");
  }

  // ═══════════════════════════════════════════════════════════════
  // COOL-DOWN ENFORCEMENT
  // If 10 requests within 5 minutes → mandatory 60s cool-down
  // ═══════════════════════════════════════════════════════════════
  async function enforceCooldownIfNeeded() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    state.recentTimestamps = state.recentTimestamps.filter(ts => ts > fiveMinutesAgo);

    if (state.recentTimestamps.length >= 10) {
      state.cooldownActive = true;
      updateUI();
      addLog("⏳ Cool-down triggered: 10 requests in 5 minutes. Waiting 60 seconds...", "warn");

      const display = domElements.cooldownDisplay;
      const timerEl = document.getElementById('lac-cooldown-timer');
      if (display) display.style.display = 'flex';

      for (let i = 60; i > 0; i--) {
        if (!state.active) break;
        if (timerEl) timerEl.innerText = i;
        await sleep(1000);
      }

      if (display) display.style.display = 'none';
      state.cooldownActive = false;
      state.recentTimestamps = [];
      addLog("Cool-down complete. Resuming...", "info");
      updateUI();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION CONTROL
  // ═══════════════════════════════════════════════════════════════
  function startSession() {
    loadSettings(() => {
      // Safety checks
      if (state.quotaCount >= state.weeklyLimit) {
        addLog("⛔ Weekly safety quota exceeded! Cannot start.", "err");
        alert("Warning: You've reached your weekly connection limit. Operations suspended for account safety.");
        return;
      }

      const security = checkForSecurityBlocks();
      if (security.blocked) {
        addLog(`⛔ ${security.reason}. Cannot start.`, "err");
        alert(`Security block detected: ${security.reason}. Please resolve it manually before using Auto-Connect.`);
        return;
      }

      state.active = true;
      state.paused = false;
      state.sentThisSession = 0;
      state.scrollRetries = 0;
      state.sessionBatch = [];
      state.recentTimestamps = [];
      state.cooldownActive = false;

      addLog(`▶ Starting session. Target: ${state.sessionLimit} | Delay: ${state.delayMin}-${state.delayMax}s`, "info");
      updateUI();
      processQueue();
    });
  }

  function togglePause() {
    if (!state.active) return;

    state.paused = !state.paused;
    if (state.paused) {
      addLog("⏸ Session paused by user.", "warn");
    } else {
      addLog("▶ Session resumed.", "info");
      processQueue();
    }
    updateUI();
  }

  function stopSession() {
    const sentCount = state.sentThisSession;
    state.active = false;
    state.paused = false;
    state.cooldownActive = false;

    // Store session batch for undo
    if (state.sessionBatch.length > 0) {
      chrome.runtime.sendMessage({
        action: "storeLastBatch",
        batch: state.sessionBatch
      });
    }

    addLog(`⏹ Session stopped. Sent: ${sentCount} connection requests.`, "warn");
    updateUI();
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PROCESSING LOOP
  // ═══════════════════════════════════════════════════════════════
  async function processQueue() {
    while (state.active && !state.paused) {
      // 1. Security pre-check
      const security = checkForSecurityBlocks();
      if (security.blocked) {
        addLog(`🛑 ${security.reason}. Auto-stopping for safety.`, "err");
        alert(`Auto-Connect stopped: ${security.reason}. Please handle it manually.`);
        stopSession();
        break;
      }

      // 2. Quota guard
      if (state.quotaCount >= state.weeklyLimit) {
        addLog("🛑 Weekly safety quota reached! Auto-stopping.", "err");
        stopSession();
        break;
      }

      // 3. Session limit check
      if (state.sentThisSession >= state.sessionLimit) {
        addLog(`✅ Session limit of ${state.sessionLimit} reached!`, "success");
        stopSession();
        break;
      }

      // 4. Cool-down check
      await enforceCooldownIfNeeded();
      if (!state.active || state.paused) break;

      // 5. Scan page for connect targets
      const targets = findConnectButtons();
      addLog(`🔍 Scanned page: Found ${targets.length} connectable profiles.`);

      if (targets.length === 0) {
        // Try scrolling to load more
        state.scrollRetries++;
        if (state.scrollRetries > state.maxScrollRetries) {
          addLog("📄 No more profiles found after scrolling. Session complete.", "warn");
          stopSession();
          break;
        }

        addLog(`📜 No buttons visible. Scrolling to load more (attempt ${state.scrollRetries}/${state.maxScrollRetries})...`, "warn");

        // Try clicking "Show more" button if it exists
        const showMoreBtn = findShowMoreButton();
        if (showMoreBtn) {
          addLog("📜 Clicking 'Show more results' button...");
          showMoreBtn.click();
          await sleep(3000);
          continue;
        }

        // Smooth scroll
        window.scrollBy({ top: 800, behavior: 'smooth' });
        await sleep(3000);

        // Check if at page bottom
        const isAtBottom = (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - 100;
        if (isAtBottom) {
          addLog("📄 Reached the bottom of the results page.", "warn");
          // Wait a bit more for lazy-loaded content
          await sleep(2000);
          const newTargets = findConnectButtons();
          if (newTargets.length === 0) {
            stopSession();
            break;
          }
        }
        continue;
      }

      // Reset scroll retries on successful find
      state.scrollRetries = 0;

      // 6. Process the first available target
      const target = targets[0];
      const firstName = target.name.split(' ')[0];
      addLog(`👤 Targeting: ${target.name}`, "info");

      try {
        // Scroll button into view
        target.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(800);

        // Click Connect
        target.button.click();
        addLog("🔘 Clicked 'Connect' button...");

        // Wait for any modal/dialog to appear
        await sleep(1500);

        // Handle the LinkedIn response flow
        const result = await handleLinkedInResponse(target.name, firstName);

        if (result.success) {
          // Log to background storage
          await logRequestToStore(target.url, target.name);
          state.sentThisSession++;
          state.quotaCount++;
          state.recentTimestamps.push(Date.now());
          state.sessionBatch.push({ url: target.url, name: target.name });
          addLog(`✅ Sent connection to ${target.name}!`, "success");

          // Check quota warning
          if (state.quotaCount >= state.weeklyLimit * 0.8) {
            addLog(`⚠️ Approaching weekly limit: ${state.quotaCount}/${state.weeklyLimit}`, "warn");
          }
        } else {
          addLog(`⚠️ Skipped ${target.name}: ${result.reason}`, "warn");
          // Mark as sent to avoid retry loops
          state.sentProfiles[target.url] = true;
        }

      } catch (err) {
        addLog(`❌ Error processing ${target.name}: ${err.message}`, "err");
        // Close any open modals
        closeAllModals();
      }

      updateUI();

      // 7. Apply randomized delay
      if (state.active && !state.paused && state.sentThisSession < state.sessionLimit) {
        const delayMs = randomDelay();
        const delaySec = Math.round(delayMs / 1000);
        addLog(`⏱ Waiting ${delaySec}s before next request...`);

        // Interruptible delay
        for (let i = 0; i < delaySec; i++) {
          if (!state.active || state.paused) break;
          await sleep(1000);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FIND "SHOW MORE" BUTTONS
  // ═══════════════════════════════════════════════════════════════
  function findShowMoreButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => {
      const text = (btn.innerText || '').trim().toLowerCase();
      return text.includes('show more') || text.includes('load more') || text.includes('see more');
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // LINKEDIN MODAL/RESPONSE HANDLER
  // Handles all possible flows after clicking "Connect"
  // ═══════════════════════════════════════════════════════════════
  async function handleLinkedInResponse(fullName, firstName) {
    // Check for weekly limit modal
    if (checkForWeeklyLimitModal()) {
      addLog("🛑 LinkedIn weekly limit restriction detected!", "err");
      alert("LinkedIn has flagged your weekly invitation limit. Auto-connect paused for safety.");
      stopSession();
      return { success: false, reason: "Weekly limit reached" };
    }

    // Check for email verification requirement
    if (checkForEmailRequired()) {
      addLog("📧 Email verification required. Skipping...", "warn");
      // Try to handle "How do you know?" modal
      const handled = await handleHowDoYouKnowModal();
      if (!handled) {
        closeAllModals();
        return { success: false, reason: "Email/verification required" };
      }
    }

    // Look for any open modal
    const modal = document.querySelector('.artdeco-modal:not(.artdeco-modal--closed), [role="dialog"][aria-modal="true"]');

    if (modal) {
      // MODAL FLOW: A dialog appeared after clicking Connect

      // Check if it's a "How do you know?" dialog
      const modalText = (modal.innerText || '').toLowerCase();
      if (modalText.includes('how do you know') || modalText.includes('relationship')) {
        const handled = await handleHowDoYouKnowModal();
        if (!handled) {
          closeAllModals();
          return { success: false, reason: "'How do you know' modal - couldn't handle" };
        }
        await sleep(1000);
      }

      // Handle note injection if enabled
      if (state.enableNotes && state.activeTemplate) {
        await injectNoteInModal(firstName);
      }

      // Find and click Send button
      const sent = await clickSendButton();
      if (sent) {
        await sleep(800);
        return { success: true };
      } else {
        closeAllModals();
        return { success: false, reason: "Could not find Send button in modal" };
      }
    } else {
      // NO MODAL FLOW: Connect may have been sent directly
      // Check if button state changed (some pages send directly without modal)
      await sleep(500);

      // Verify: look for "Pending" text or changed button state near the target
      const bodyText = document.body.innerText;
      // If no error appeared and no modal, it likely sent successfully
      if (!checkForEmailRequired() && !checkForWeeklyLimitModal()) {
        return { success: true };
      } else {
        return { success: false, reason: "Unknown state after click" };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HANDLE "HOW DO YOU KNOW?" MODAL
  // ═══════════════════════════════════════════════════════════════
  async function handleHowDoYouKnowModal() {
    // Find radio buttons or option selectors
    const modal = document.querySelector('.artdeco-modal:not(.artdeco-modal--closed), [role="dialog"]');
    if (!modal) return false;

    // Try to find "Other" option
    const labels = Array.from(modal.querySelectorAll('label, [role="radio"], input[type="radio"]'));
    const otherOption = labels.find(el => {
      const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      return text.includes('other');
    });

    if (otherOption) {
      otherOption.click();
      await sleep(500);

      // Now click "Connect" or "Send" button inside the modal
      const connectBtn = Array.from(modal.querySelectorAll('button')).find(btn => {
        const text = (btn.innerText || '').trim().toLowerCase();
        return text === 'connect' || text === 'send' || text.includes('send');
      });

      if (connectBtn) {
        connectBtn.click();
        await sleep(1000);
        return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // INJECT NOTE INTO MODAL
  // ═══════════════════════════════════════════════════════════════
  async function injectNoteInModal(firstName) {
    const modal = document.querySelector('.artdeco-modal:not(.artdeco-modal--closed), [role="dialog"]');
    if (!modal) return;

    // Find "Add a note" button
    const addNoteBtn = Array.from(modal.querySelectorAll('button')).find(btn => {
      const text = (btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      return text.includes('add a note') || aria.includes('add a note');
    });

    if (addNoteBtn) {
      addLog("📝 Clicking 'Add a note'...");
      addNoteBtn.click();
      await sleep(800);
    }

    // Find textarea in modal
    const textarea = modal.querySelector(
      'textarea#custom-message, ' +
      'textarea[name="message"], ' +
      'textarea.connect-button-send-invite__custom-message, ' +
      '.artdeco-text-input--textarea textarea, ' +
      'textarea'
    );

    if (textarea) {
      const noteContent = compileTemplate(state.activeTemplate, firstName);

      // Use React-compatible setter
      setReactInputValue(textarea, noteContent);

      addLog(`📝 Note injected: "${noteContent.substring(0, 40)}..."`);
      await sleep(500);
    } else {
      addLog("📝 Note textarea not found. Sending without note.", "warn");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CLICK SEND BUTTON
  // ═══════════════════════════════════════════════════════════════
  async function clickSendButton() {
    const modal = document.querySelector('.artdeco-modal:not(.artdeco-modal--closed), [role="dialog"]');
    const searchContext = modal || document;

    // Multi-strategy send button finder
    const allButtons = Array.from(searchContext.querySelectorAll('button'));
    const sendBtn = allButtons.find(btn => {
      const text = (btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (
        text === 'send' ||
        text === 'send now' ||
        text === 'send without a note' ||
        text === 'send invitation' ||
        aria.includes('send invitation') ||
        aria.includes('send now') ||
        (text.includes('send') && !text.includes('cancel'))
      );
    });

    if (sendBtn) {
      addLog("📤 Sending invitation...");
      sendBtn.click();
      await sleep(1000);
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // MODAL CLEANUP
  // ═══════════════════════════════════════════════════════════════
  function closeAllModals() {
    // Find and click all dismiss/close buttons
    const dismissButtons = Array.from(document.querySelectorAll(
      'button.artdeco-modal__dismiss, ' +
      'button[aria-label="Dismiss"], ' +
      'button[aria-label="dismiss"], ' +
      'button[data-test-modal-close-btn], ' +
      '.artdeco-modal__dismiss'
    ));

    dismissButtons.forEach(btn => {
      try { btn.click(); } catch (e) { /* ignore */ }
    });

    // Also try ESC key as fallback
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND STORAGE COMMUNICATION
  // ═══════════════════════════════════════════════════════════════
  function logRequestToStore(profileUrl, name) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "logRequest",
        profileUrl: profileUrl,
        name: name
      }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('LAC: Background message error:', chrome.runtime.lastError.message);
          resolve();
          return;
        }
        if (res && res.success) {
          state.quotaCount = res.count;
          state.sentProfiles[profileUrl] = true;
        }
        resolve();
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGE LISTENER (from popup/background)
  // ═══════════════════════════════════════════════════════════════
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "refreshSettings") {
      loadSettings(() => {
        addLog("⚙️ Settings re-synced from popup.", "info");
        sendResponse({ success: true });
      });
      return true; // async
    }

    if (message.action === "getPanelStatus") {
      sendResponse({
        active: state.active,
        paused: state.paused,
        sent: state.sentThisSession,
        quota: state.quotaCount
      });
    }

    if (message.action === "restorePanel") {
      const panel = document.getElementById('lac-floating-panel');
      if (panel) {
        panel.style.display = 'flex';
        panel.style.transform = 'translateY(0)';
        addLog("Panel restored.");
      } else {
        injectPanel();
        loadSettings();
      }
      sendResponse({ success: true });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  injectPanel();
  loadSettings();

  // Handle LinkedIn SPA navigation (URL changes without full reload)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      addLog("🔄 Page navigated. Reloading settings...");
      loadSettings();
      // Re-inject panel if it was removed during navigation
      setTimeout(() => {
        if (!document.getElementById('lac-floating-panel')) {
          injectPanel();
          loadSettings();
        }
      }, 2000);
    }
  }).observe(document, { subtree: true, childList: true });

})();
