let isBlocking = false;

function qs(id) {
  return document.getElementById(id);
}

// --- Sync initial state ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (response) => {
    if (chrome.runtime.lastError) return;

    if (response && response.isBlocking) {
      isBlocking = true;
      updateToggle();
    }
  });
});

// --- Toggle switch handler ---
qs("blockToggle").addEventListener("change", () => {
  isBlocking = qs("blockToggle").checked;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "toggleBlock", enabled: isBlocking },
      () => {}
    );
  });
});

// --- Clear blocks button ---
qs("clearBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "clearBlocks" }, () => {});

    isBlocking = false;
    updateToggle();
  });
});

// --- Manage button ---
qs("manageBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "manage.html" });
});

// --- Options button ---
qs("optionsBtn").addEventListener("click", () => {
  const panel = qs("optionsPanel");
  if (panel.style.display === "none") {
    panel.style.display = "block";
    loadOptions();
  } else {
    panel.style.display = "none";
  }
});

// --- Save options button ---
qs("saveOptionsBtn").addEventListener("click", () => {
  saveOptions();
});

// --- Load saved options ---
function loadOptions() {
  chrome.storage.local.get(['quickBlockOptions'], (result) => {
    const options = result.quickBlockOptions || {};
    
    // Load all checkbox states
    Object.keys(options).forEach(optionId => {
      const checkbox = qs(optionId);
      if (checkbox) {
        checkbox.checked = options[optionId];
      }
    });
  });
}

// --- Save options ---
function saveOptions() {
  const optionIds = [
    'hideNotificationBell', 'hideFeed', 'disableAutoplay', 'hideShorts',
    'hideSubBar', 'hideNonLists', 'hideRelated', 'hideSidebar',
    'hideLiveChat', 'hidePlaylist', 'hideMerch', 'hideComments', 'disablePlaylists'
  ];
  
  const options = {};
  optionIds.forEach(id => {
    const checkbox = qs(id);
    if (checkbox) {
      options[id] = checkbox.checked;
    }
  });
  
  // Save to storage
  chrome.storage.local.set({ quickBlockOptions: options }, () => {
    // Apply the options immediately
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'applyQuickOptions', 
        options: options 
      }, () => {});
    });
    
    // Hide options panel
    qs("optionsPanel").style.display = "none";
  });
}

// --- Update UI toggle ---
function updateToggle() {
  qs("blockToggle").checked = isBlocking;
}
