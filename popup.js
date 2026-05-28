// LinkedIn Auto-Connect Pro - Popup Script (MVP)

document.addEventListener('DOMContentLoaded', () => {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  let appState = {
    settings: {},
    templates: [],
    activeTemplateId: "",
    sentProfiles: {},
    quotaLog: [],
    lastBatch: [],
    editingTemplateId: null
  };

  // ═══════════════════════════════════════════════════════════════
  // DOM CACHE
  // ═══════════════════════════════════════════════════════════════
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  // Dashboard
  const dashQuotaCount = document.getElementById('dash-quota-count');
  const dashQuotaMax = document.getElementById('dash-quota-max');
  const quotaGaugeBar = document.getElementById('quota-gauge-bar');
  const statRemaining = document.getElementById('stat-remaining');
  const statTotalSent = document.getElementById('stat-total-sent');
  const undoSection = document.getElementById('undo-section');
  const undoCount = document.getElementById('undo-count');
  const btnViewBatch = document.getElementById('btn-view-batch');

  // Templates
  const templatesListContainer = document.getElementById('templates-list-container');
  const inputTemplateName = document.getElementById('template-name');
  const textareaTemplateText = document.getElementById('template-text');
  const charCounter = document.getElementById('char-counter');
  const editorTitle = document.getElementById('editor-title');
  const btnSaveTemplate = document.getElementById('btn-save-template');
  const btnClearTemplate = document.getElementById('btn-clear-template');
  const tagButtons = document.querySelectorAll('.btn-tag');

  // Settings
  const inputSessionLimit = document.getElementById('setting-session-limit');
  const inputWeeklyLimit = document.getElementById('setting-weekly-limit');
  const inputDelayMin = document.getElementById('setting-delay-min');
  const inputDelayMax = document.getElementById('setting-delay-max');
  const checkboxEnableNotes = document.getElementById('setting-enable-notes');
  const inputUserCollege = document.getElementById('setting-user-college');
  const inputUserField = document.getElementById('setting-user-field');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnResetLogs = document.getElementById('btn-reset-logs');

  // Footer
  const footerStatusDot = document.getElementById('footer-status-dot');
  const footerStatusText = document.getElementById('footer-status-text');

  // ═══════════════════════════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (targetTab === 'dashboard') {
        loadDataFromStorage(updateDashboard);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // STORAGE LOADER
  // ═══════════════════════════════════════════════════════════════
  function loadDataFromStorage(callback) {
    chrome.storage.local.get(
      ['settings', 'templates', 'activeTemplateId', 'sentProfiles', 'quotaLog', 'lastBatch'],
      (res) => {
        appState.settings = res.settings || {
          delayMin: 4,
          delayMax: 9,
          sessionLimit: 20,
          weeklyLimit: 100,
          enableNotes: false,
          userCollege: "",
          userField: ""
        };
        appState.templates = res.templates || [];
        appState.activeTemplateId = res.activeTemplateId || "";
        appState.sentProfiles = res.sentProfiles || {};
        appState.quotaLog = res.quotaLog || [];
        appState.lastBatch = res.lastBatch || [];

        if (callback) callback();
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  function updateDashboard() {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const activeQuotaLogs = appState.quotaLog.filter(ts => ts > sevenDaysAgo);

    const count = activeQuotaLogs.length;
    const max = appState.settings.weeklyLimit || 100;

    // Text metrics
    dashQuotaCount.innerText = count;
    dashQuotaMax.innerText = max;

    const remaining = Math.max(0, max - count);
    statRemaining.innerText = remaining;
    statTotalSent.innerText = Object.keys(appState.sentProfiles).length;

    // SVG Gauge: circumference = 2 × π × 50 ≈ 314.159
    const circumference = 2 * Math.PI * 50;
    quotaGaugeBar.style.strokeDasharray = circumference;

    const percentage = Math.min(count / max, 1);
    const offset = circumference - (percentage * circumference);
    quotaGaugeBar.style.strokeDashoffset = offset;

    // Warn at 80%
    if (percentage >= 0.8) {
      quotaGaugeBar.style.stroke = '#ef4444';
      dashQuotaCount.style.color = '#ef4444';
    } else if (percentage >= 0.5) {
      quotaGaugeBar.style.stroke = '#f59e0b';
      dashQuotaCount.style.color = '#f59e0b';
    } else {
      quotaGaugeBar.style.stroke = '';
      dashQuotaCount.style.color = '';
    }

    // Undo section
    if (appState.lastBatch.length > 0) {
      undoSection.style.display = 'block';
      undoCount.innerText = appState.lastBatch.length;
    } else {
      undoSection.style.display = 'none';
    }
  }

  // ─── Undo: View last batch ───
  btnViewBatch.addEventListener('click', () => {
    if (appState.lastBatch.length === 0) {
      alert("No recent batch to show.");
      return;
    }

    const profileNames = appState.lastBatch.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const action = confirm(
      `Last session sent ${appState.lastBatch.length} connection requests:\n\n${profileNames}\n\nTo withdraw these requests, visit each person's profile on LinkedIn and click "Withdraw".\n\nClick OK to clear this batch from memory.`
    );

    if (action) {
      chrome.runtime.sendMessage({ action: "clearLastBatch" }, () => {
        appState.lastBatch = [];
        updateDashboard();
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // TEMPLATE MANAGER
  // ═══════════════════════════════════════════════════════════════
  function renderTemplatesList() {
    templatesListContainer.innerHTML = '';

    if (appState.templates.length === 0) {
      templatesListContainer.innerHTML =
        '<div class="glass-card" style="text-align:center; padding:12px; font-size:11px; color:#64748b;">No note templates configured yet.</div>';
      return;
    }

    appState.templates.forEach(t => {
      const isActive = t.id === appState.activeTemplateId;
      const card = document.createElement('div');
      card.className = `template-item ${isActive ? 'active' : ''}`;

      card.innerHTML = `
        <div class="template-item-info">
          <span class="template-item-name">${escapeHtml(t.name)}</span>
          <span class="template-item-body">${escapeHtml(t.text)}</span>
        </div>
        <div class="template-actions">
          ${isActive ? '<span class="active-badge">Active</span>' : ''}
          <button class="btn-del" data-id="${t.id}" title="Delete Template">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Click to set active
      card.querySelector('.template-item-info').addEventListener('click', () => {
        appState.activeTemplateId = t.id;
        chrome.storage.local.set({ activeTemplateId: t.id }, () => {
          loadDataFromStorage(() => {
            renderTemplatesList();
            notifyContentScriptSettingsChanged();
          });
        });
      });

      // Delete
      card.querySelector('.btn-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTemplate(t.id);
      });

      templatesListContainer.appendChild(card);
    });
  }

  function deleteTemplate(id) {
    appState.templates = appState.templates.filter(t => t.id !== id);
    if (appState.activeTemplateId === id) {
      appState.activeTemplateId = appState.templates.length > 0 ? appState.templates[0].id : "";
    }

    chrome.storage.local.set({
      templates: appState.templates,
      activeTemplateId: appState.activeTemplateId
    }, () => {
      loadDataFromStorage(() => {
        renderTemplatesList();
        notifyContentScriptSettingsChanged();
      });
    });
  }

  // ─── Template editor ───
  function updateCharCount() {
    const len = textareaTemplateText.value.length;
    charCounter.innerText = len;
    charCounter.style.color = len >= 280 ? '#f59e0b' : '';
  }

  textareaTemplateText.addEventListener('input', updateCharCount);

  // Tag insertion at cursor
  tagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      const start = textareaTemplateText.selectionStart;
      const end = textareaTemplateText.selectionEnd;
      const val = textareaTemplateText.value;

      textareaTemplateText.value = val.substring(0, start) + tag + val.substring(end);
      textareaTemplateText.selectionStart = textareaTemplateText.selectionEnd = start + tag.length;
      textareaTemplateText.focus();
      updateCharCount();
    });
  });

  // Save/Create template
  btnSaveTemplate.addEventListener('click', () => {
    const name = inputTemplateName.value.trim();
    const text = textareaTemplateText.value.trim();

    if (!name || !text) {
      alert("Please complete both template name and note body before saving.");
      return;
    }

    if (text.length > 300) {
      alert("LinkedIn limits connection notes to 300 characters. Please shorten your message.");
      return;
    }

    const newTemplate = {
      id: appState.editingTemplateId || `t-${Date.now()}`,
      name: name,
      text: text
    };

    if (appState.editingTemplateId) {
      appState.templates = appState.templates.map(t => t.id === appState.editingTemplateId ? newTemplate : t);
    } else {
      appState.templates.push(newTemplate);
    }

    if (!appState.activeTemplateId) {
      appState.activeTemplateId = newTemplate.id;
    }

    chrome.storage.local.set({
      templates: appState.templates,
      activeTemplateId: appState.activeTemplateId
    }, () => {
      inputTemplateName.value = '';
      textareaTemplateText.value = '';
      appState.editingTemplateId = null;
      editorTitle.innerText = "New Note Template";
      charCounter.innerText = "0";

      loadDataFromStorage(() => {
        renderTemplatesList();
        notifyContentScriptSettingsChanged();
      });
    });
  });

  btnClearTemplate.addEventListener('click', () => {
    inputTemplateName.value = '';
    textareaTemplateText.value = '';
    appState.editingTemplateId = null;
    editorTitle.innerText = "New Note Template";
    updateCharCount();
  });

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════
  function populateSettingsForm() {
    inputSessionLimit.value = appState.settings.sessionLimit || 20;
    inputWeeklyLimit.value = appState.settings.weeklyLimit || 100;
    inputDelayMin.value = appState.settings.delayMin || 4;
    inputDelayMax.value = appState.settings.delayMax || 9;
    checkboxEnableNotes.checked = appState.settings.enableNotes || false;
    inputUserCollege.value = appState.settings.userCollege || "";
    inputUserField.value = appState.settings.userField || "";
  }

  btnSaveSettings.addEventListener('click', () => {
    const sessionL = parseInt(inputSessionLimit.value, 10);
    const weeklyL = parseInt(inputWeeklyLimit.value, 10);
    const delayMin = parseInt(inputDelayMin.value, 10);
    const delayMax = parseInt(inputDelayMax.value, 10);

    if (delayMin >= delayMax) {
      alert("Minimum delay must be less than maximum delay.");
      return;
    }
    if (sessionL <= 0 || weeklyL <= 0) {
      alert("Limits must be greater than zero.");
      return;
    }
    if (delayMin < 2) {
      alert("Minimum delay must be at least 2 seconds for account safety.");
      return;
    }

    const updatedSettings = {
      sessionLimit: sessionL,
      weeklyLimit: weeklyL,
      delayMin: delayMin,
      delayMax: delayMax,
      enableNotes: checkboxEnableNotes.checked,
      userCollege: inputUserCollege.value.trim(),
      userField: inputUserField.value.trim()
    };

    chrome.storage.local.set({ settings: updatedSettings }, () => {
      // Visual feedback
      btnSaveSettings.innerText = '✓ Saved!';
      btnSaveSettings.style.opacity = '0.8';
      setTimeout(() => {
        btnSaveSettings.innerText = 'Save Settings';
        btnSaveSettings.style.opacity = '';
      }, 1500);

      loadDataFromStorage(() => {
        notifyContentScriptSettingsChanged();
      });
    });
  });

  // Clear logs
  btnResetLogs.addEventListener('click', () => {
    const confirmClear = confirm(
      "Are you sure you want to clear your sent-profile logs and reset quota tracking?\n\nThis cannot be undone."
    );
    if (confirmClear) {
      chrome.storage.local.set({
        sentProfiles: {},
        quotaLog: [],
        lastBatch: []
      }, () => {
        alert("Logs cleared successfully.");
        loadDataFromStorage(() => {
          updateDashboard();
          notifyContentScriptSettingsChanged();
        });
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════════════════════════════
  function notifyContentScriptSettingsChanged() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "refreshSettings" }, (res) => {
          if (chrome.runtime.lastError) {
            // Tab is likely not LinkedIn — expected
          }
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FOOTER: LinkedIn Tab Detection
  // ═══════════════════════════════════════════════════════════════
  function checkLinkedInTab() {
    chrome.runtime.sendMessage({ action: "checkLinkedInTab" }, (res) => {
      if (chrome.runtime.lastError) {
        setFooterStatus(false);
        return;
      }
      setFooterStatus(res && res.isLinkedIn);
    });
  }

  function setFooterStatus(isLinkedIn) {
    if (isLinkedIn) {
      footerStatusDot.style.backgroundColor = '#10b981';
      footerStatusDot.style.boxShadow = '0 0 6px #10b981';
      footerStatusText.innerText = 'Connected to LinkedIn';
      footerStatusText.style.color = '#10b981';
    } else {
      footerStatusDot.style.backgroundColor = '#64748b';
      footerStatusDot.style.boxShadow = 'none';
      footerStatusText.innerText = 'Not on LinkedIn';
      footerStatusText.style.color = '#64748b';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  loadDataFromStorage(() => {
    updateDashboard();
    renderTemplatesList();
    populateSettingsForm();
    checkLinkedInTab();
  });
});
