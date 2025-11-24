// Global state
let isBlocking = false;
let currentTheme = 'auto';

// Utility function
function qs(id) {
  return document.getElementById(id);
}

// Theme Management
function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const actualTheme = theme === 'auto' ? detectSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', actualTheme);
  
  // Update theme toggle icon
  const themeToggle = qs('themeToggle');
  if (themeToggle) {
    themeToggle.setAttribute('title', `Switch to ${actualTheme === 'dark' ? 'light' : 'dark'} theme`);
  }
}

function initTheme() {
  chrome.storage.local.get(['userPreferences'], (result) => {
    const prefs = result.userPreferences || {};
    currentTheme = prefs.theme || 'auto';
    
    // Set theme select value
    const themeSelect = qs('themePreference');
    if (themeSelect) {
      themeSelect.value = currentTheme;
    }
    
    applyTheme(currentTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'auto') {
        applyTheme('auto');
      }
    });
  });
}

// Save user preferences
function saveUserPreferences(preferences) {
  chrome.storage.local.get(['userPreferences'], (result) => {
    const currentPrefs = result.userPreferences || {};
    const updatedPrefs = { ...currentPrefs, ...preferences };
    
    chrome.storage.local.set({ userPreferences: updatedPrefs }, () => {
      console.log('Preferences saved:', updatedPrefs);
    });
  });
}

// Initialize app
function initializeApp() {
  initTheme();
  loadOptions();
  syncInitialState();
  setupEventListeners();
  
  // Apply any saved quick options to the current tab immediately
  applyCurrentQuickOptions();
}

// Clear quick options for the current tab
function clearQuickOptionsForCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const hostname = url.hostname;
      
      // Only clear YouTube quick options for now
      if (hostname.includes('youtube.com')) {
        chrome.storage.local.set({ quickBlockOptions: {} }, () => {
          // Reset all option checkboxes in the UI
          const optionIds = [
            'hideNotificationBell', 'hideFeed', 'disableAutoplay', 'hideShorts',
            'hideSubBar', 'hideNonLists', 'hideRelated', 'hideSidebar',
            'hideLiveChat', 'hidePlaylist', 'hideMerch', 'hideComments', 'disablePlaylists'
          ];
          
          optionIds.forEach(id => {
            const checkbox = qs(id);
            if (checkbox) {
              checkbox.checked = false;
            }
          });
        });
      }
    }
  });
}

// Apply currently saved quick options to the active tab
function applyCurrentQuickOptions() {
  chrome.storage.local.get(['quickBlockOptions'], (result) => {
    const options = result.quickBlockOptions || {};
    
    if (Object.keys(options).some(key => options[key])) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'applyQuickOptions', 
            options: options 
          }, () => {
            // Ignore errors - content script might not be ready
            if (chrome.runtime.lastError) {
              // Silent fail
            }
          });
        }
      });
    }
  });
}

// --- Sync initial state ---
function syncInitialState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (response) => {
        if (chrome.runtime.lastError) return;

        if (response && response.isBlocking) {
          isBlocking = true;
          updateToggle();
        }
      });
    }
  });
}

// Setup all event listeners
function setupEventListeners() {
  // --- Toggle switch handler ---
  qs("blockToggle").addEventListener("change", () => {
    isBlocking = qs("blockToggle").checked;
    
    // Add haptic feedback (if supported)
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "toggleBlock", enabled: isBlocking },
          () => {}
        );
      }
    });
    
    // Save blocking state
    saveUserPreferences({ lastBlockingState: isBlocking });
  });

  // --- Theme toggle handler ---
  qs("themeToggle").addEventListener("click", () => {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    currentTheme = nextTheme;
    applyTheme(currentTheme);
    
    // Update select dropdown
    const themeSelect = qs('themePreference');
    if (themeSelect) {
      themeSelect.value = currentTheme;
    }
    
    // Save preference
    saveUserPreferences({ theme: currentTheme });
  });

  // --- Theme preference select ---
  qs("themePreference").addEventListener("change", (e) => {
    currentTheme = e.target.value;
    applyTheme(currentTheme);
    saveUserPreferences({ theme: currentTheme });
  });

  // --- Clear blocks button ---
  qs("clearBtn").addEventListener("click", () => {
    // Add confirmation for destructive action
    if (confirm('Clear all blocked elements and quick options on this site?\n\nThis will show all hidden elements immediately.')) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Send clear action to content script
          chrome.tabs.sendMessage(tabs[0].id, { action: "clearAllSiteData" }, () => {});
        }
      });

      // Also clear quick options from storage for this action
      clearQuickOptionsForCurrentTab();

      isBlocking = false;
      updateToggle();
      
      // Visual feedback
      const btn = qs("clearBtn");
      const originalText = btn.textContent;
      btn.textContent = "Cleared!";
      btn.style.background = "var(--success)";
      btn.style.color = "white";
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = "";
        btn.style.color = "";
      }, 1500);
    }
  });

  // --- Manage button ---
  qs("manageBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "manage.html" });
  });

  // --- Options button ---
  qs("optionsBtn").addEventListener("click", () => {
    const panel = qs("optionsPanel");
    const isHidden = panel.style.display === "none";
    
    panel.style.display = isHidden ? "block" : "none";
    
    if (isHidden) {
      loadOptions();
      // Update button text
      qs("optionsBtn").textContent = "Hide Options";
    } else {
      qs("optionsBtn").textContent = "Options";
    }
  });

  // --- Save options button ---
  qs("saveOptionsBtn").addEventListener("click", () => {
    saveOptions();
  });
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + T for theme toggle
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
      e.preventDefault();
      qs("themeToggle").click();
    }
    
    // Space for toggle blocking
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      qs("blockToggle").click();
    }
    
    // Escape to close options
    if (e.key === 'Escape') {
      const panel = qs("optionsPanel");
      if (panel.style.display !== "none") {
        panel.style.display = "none";
        qs("optionsBtn").textContent = "Options";
      }
    }
  });
}

// --- Load saved options ---
function loadOptions() {
  chrome.storage.local.get(['quickBlockOptions', 'userPreferences'], (result) => {
    const options = result.quickBlockOptions || {};
    const prefs = result.userPreferences || {};
    
    // Load all checkbox states
    Object.keys(options).forEach(optionId => {
      const checkbox = qs(optionId);
      if (checkbox) {
        checkbox.checked = options[optionId];
      }
    });
    
    // Load theme preference
    currentTheme = prefs.theme || 'auto';
    const themeSelect = qs('themePreference');
    if (themeSelect) {
      themeSelect.value = currentTheme;
    }
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
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'applyQuickOptions', 
          options: options 
        }, () => {});
      }
    });
    
    // Visual feedback
    const saveBtn = qs("saveOptionsBtn");
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saved!";
    saveBtn.style.background = "var(--success)";
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = "";
      // Hide options panel
      qs("optionsPanel").style.display = "none";
      qs("optionsBtn").textContent = "Options";
    }, 1200);
  });
}

// --- Update UI toggle ---
function updateToggle() {
  const toggle = qs("blockToggle");
  toggle.checked = isBlocking;
  
  // Add visual feedback
  const toggleSection = document.querySelector('.main-toggle-section');
  if (isBlocking) {
    toggleSection.style.borderColor = 'var(--primary)';
    toggleSection.style.background = 'var(--primary-light)';
  } else {
    toggleSection.style.borderColor = '';
    toggleSection.style.background = '';
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
