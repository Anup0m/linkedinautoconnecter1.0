// LinkedIn Auto-Connect Pro - Background Service Worker (MVP)

// ═══════════════════════════════════════════════════════════════
// INSTALLATION — Initialize default settings and templates
// ═══════════════════════════════════════════════════════════════
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'templates', 'sentProfiles', 'quotaLog', 'lastBatch'], (res) => {
    const updates = {};

    if (!res.settings) {
      updates.settings = {
        delayMin: 4,
        delayMax: 9,
        sessionLimit: 20,
        weeklyLimit: 100,
        enableNotes: false,
        userCollege: "",
        userField: ""
      };
    }

    if (!res.templates) {
      updates.templates = [
        {
          id: "t1",
          name: "Alumni Outreach",
          text: "Hi {first_name}, I saw we both went to {college}. I'm in the {field} field too and would love to connect and exchange notes!"
        },
        {
          id: "t2",
          name: "Industry Peer",
          text: "Hi {first_name}, I'm expanding my network in {field} and came across your profile. Would love to connect and stay in touch!"
        }
      ];
      updates.activeTemplateId = "t1";
    }

    if (!res.sentProfiles) {
      updates.sentProfiles = {};
    }

    if (!res.quotaLog) {
      updates.quotaLog = [];
    }

    if (!res.lastBatch) {
      updates.lastBatch = [];
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        console.log("LinkedIn Auto-Connect Pro: Storage initialized with defaults.");
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLERS
// ═══════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ─── Log a sent connection request ───
  if (message.action === "logRequest") {
    const { profileUrl, name } = message;
    const timestamp = Date.now();

    chrome.storage.local.get(['sentProfiles', 'quotaLog', 'settings'], (res) => {
      const sentProfiles = res.sentProfiles || {};
      const quotaLog = res.quotaLog || [];
      const settings = res.settings || {};

      // Add to sent profiles
      sentProfiles[profileUrl] = { name, timestamp };

      // Add to quota log
      quotaLog.push(timestamp);

      // Clean up entries older than 7 days
      const sevenDaysAgo = timestamp - 7 * 24 * 60 * 60 * 1000;
      const filteredQuotaLog = quotaLog.filter(ts => ts > sevenDaysAgo);

      // Check if approaching limit (80% warning)
      const weeklyLimit = settings.weeklyLimit || 100;
      const warning = filteredQuotaLog.length >= weeklyLimit * 0.8;

      chrome.storage.local.set({
        sentProfiles,
        quotaLog: filteredQuotaLog
      }, () => {
        sendResponse({
          success: true,
          count: filteredQuotaLog.length,
          warning: warning
        });
      });
    });
    return true; // Keep channel open for async
  }

  // ─── Check current quota ───
  if (message.action === "checkQuota") {
    chrome.storage.local.get(['quotaLog', 'settings'], (res) => {
      const quotaLog = res.quotaLog || [];
      const settings = res.settings || {};
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const activeCount = quotaLog.filter(ts => ts > sevenDaysAgo).length;
      const weeklyLimit = settings.weeklyLimit || 100;

      sendResponse({
        count: activeCount,
        limit: weeklyLimit,
        warning: activeCount >= weeklyLimit * 0.8
      });
    });
    return true;
  }

  // ─── Store last session batch (for undo) ───
  if (message.action === "storeLastBatch") {
    const batch = message.batch || [];
    chrome.storage.local.set({ lastBatch: batch }, () => {
      console.log(`LAC: Stored last batch of ${batch.length} profiles for undo.`);
      sendResponse({ success: true });
    });
    return true;
  }

  // ─── Get last batch info ───
  if (message.action === "getLastBatch") {
    chrome.storage.local.get(['lastBatch'], (res) => {
      sendResponse({ batch: res.lastBatch || [] });
    });
    return true;
  }

  // ─── Clear last batch (after undo) ───
  if (message.action === "clearLastBatch") {
    chrome.storage.local.set({ lastBatch: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ─── Export all sent profiles as JSON ───
  if (message.action === "exportLogs") {
    chrome.storage.local.get(['sentProfiles', 'quotaLog'], (res) => {
      sendResponse({
        sentProfiles: res.sentProfiles || {},
        quotaLog: res.quotaLog || [],
        exportDate: new Date().toISOString()
      });
    });
    return true;
  }

  // ─── Check if active tab is LinkedIn ───
  if (message.action === "checkLinkedInTab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const isLinkedIn = (tabs[0].url || '').includes('linkedin.com');
        sendResponse({ isLinkedIn, url: tabs[0].url });
      } else {
        sendResponse({ isLinkedIn: false, url: '' });
      }
    });
    return true;
  }
});
