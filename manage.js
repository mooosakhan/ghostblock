// Global state
let currentTheme = 'auto';

// Theme Management
function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const actualTheme = theme === 'auto' ? detectSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', actualTheme);
  
  // Update theme toggle icon
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (actualTheme === 'dark') {
    sunIcon.style.opacity = '0';
    sunIcon.style.transform = 'rotate(180deg) scale(0.5)';
    moonIcon.style.opacity = '1';
    moonIcon.style.transform = 'rotate(0deg) scale(1)';
  } else {
    sunIcon.style.opacity = '1';
    sunIcon.style.transform = 'rotate(0deg) scale(1)';
    moonIcon.style.opacity = '0';
    moonIcon.style.transform = 'rotate(180deg) scale(0.5)';
  }
}

function initTheme() {
  chrome.storage.local.get(['userPreferences'], (result) => {
    const prefs = result.userPreferences || {};
    currentTheme = prefs.theme || 'auto';
    applyTheme(currentTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'auto') {
        applyTheme('auto');
      }
    });
  });
}

function saveUserPreferences(preferences) {
  chrome.storage.local.get(['userPreferences'], (result) => {
    const currentPrefs = result.userPreferences || {};
    const updatedPrefs = { ...currentPrefs, ...preferences };
    
    chrome.storage.local.set({ userPreferences: updatedPrefs }, () => {
      console.log('Preferences saved:', updatedPrefs);
    });
  });
}

function setupEventListeners() {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const themes = ['auto', 'light', 'dark'];
      const currentIndex = themes.indexOf(currentTheme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      
      currentTheme = nextTheme;
      applyTheme(currentTheme);
      saveUserPreferences({ theme: currentTheme });
    });
  }
  
  // Clear all button
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAll);
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + T for theme toggle
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
      e.preventDefault();
      themeToggle.click();
    }
    
    // Ctrl/Cmd + R for refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      loadBlockedElements();
    }
  });
}

function loadBlockedElements() {
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error loading blocked elements:', chrome.runtime.lastError);
      showError('Failed to load blocked elements');
      return;
    }
    
    const blocked = result.blockedElements || {};
    const content = document.getElementById('content');
    const clearAllBtn = document.getElementById('clearAllBtn');
    
    if (Object.keys(blocked).length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌟</div>
          <h2>No Blocked Elements Yet</h2>
          <p>Start using GhostBlock to hide unwanted elements on websites.<br>
          They'll appear here for easy management.</p>
        </div>
      `;
      clearAllBtn.style.display = 'none';
      return;
    }
    
    clearAllBtn.style.display = 'block';
    let html = '';
    
    // Sort sites alphabetically
    const sortedSites = Object.keys(blocked).sort();
    
    for (const site of sortedSites) {
      const selectors = blocked[site];
      if (!selectors || selectors.length === 0) continue;
      
      const siteIcon = site.charAt(0).toUpperCase();
      const siteDisplay = site.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      
      html += `
        <div class="site-card" data-site="${escapeHtml(site)}">
          <div class="site-header">
            <div class="site-name">
              <div class="site-icon">${siteIcon}</div>
              ${escapeHtml(siteDisplay)}
            </div>
            <div class="site-actions">
              <span class="site-count">${selectors.length} element${selectors.length !== 1 ? 's' : ''}</span>
              <button class="btn clear-site-btn" data-site="${escapeHtml(site)}" title="Clear all elements from this site">
                🗑️
              </button>
            </div>
          </div>
          <div class="elements-list">
      `;
      
      selectors.forEach((selector, index) => {
        const selectorDisplay = selector.length > 60 ? 
          selector.substring(0, 57) + '...' : selector;
        
        html += `
          <div class="element-item">
            <div class="element-info">
              <div class="element-selector">${escapeHtml(selectorDisplay)}</div>
              <div class="element-description">${getElementDescription(selector)}</div>
            </div>
            <button class="btn unblock-btn" 
                    data-site="${escapeHtml(site)}" 
                    data-index="${index}"
                    title="Unblock this element">
              ✓ Restore
            </button>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    content.innerHTML = html;
    
    // Attach event listeners using event delegation
    attachElementListeners();
  });
}

function attachElementListeners() {
  const content = document.getElementById('content');
  
  // Clear Site buttons
  const clearSiteBtns = content.querySelectorAll('.clear-site-btn');
  clearSiteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const site = e.target.dataset.site;
      clearSite(site);
    });
  });
  
  // Unblock buttons
  const unblockBtns = content.querySelectorAll('.unblock-btn');
  unblockBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const site = e.target.dataset.site;
      const index = parseInt(e.target.dataset.index);
      unblockElement(site, index);
    });
  });
}

function getElementDescription(selector) {
  // Try to provide a human-readable description of what the selector might target
  if (selector.includes('ads') || selector.includes('advertisement')) {
    return 'Advertisement content';
  } else if (selector.includes('popup') || selector.includes('modal')) {
    return 'Popup or modal dialog';
  } else if (selector.includes('nav') || selector.includes('menu')) {
    return 'Navigation or menu element';
  } else if (selector.includes('sidebar')) {
    return 'Sidebar content';
  } else if (selector.includes('header')) {
    return 'Header content';
  } else if (selector.includes('footer')) {
    return 'Footer content';
  } else if (selector.includes('comment')) {
    return 'Comments section';
  } else if (selector.includes('social')) {
    return 'Social media element';
  } else if (selector.includes('btn') || selector.includes('button')) {
    return 'Button element';
  } else {
    return 'Page element';
  }
}

function unblockElement(site, index) {
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error accessing storage:', chrome.runtime.lastError);
      showError('Failed to unblock element');
      return;
    }
    const blocked = result.blockedElements || {};
    
    if (blocked[site]) {
      const removedSelector = blocked[site][index];
      blocked[site].splice(index, 1);
      
      if (blocked[site].length === 0) {
        delete blocked[site];
      }
      
      chrome.storage.local.set({ blockedElements: blocked }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error saving storage:', chrome.runtime.lastError);
          showError('Failed to save changes');
        } else {
          showSuccess(`Element restored successfully`);
          loadBlockedElements();
        }
      });
    }
  });
}

function clearSite(site) {
  const siteDisplay = site.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  
  if (!confirm(`Remove all blocked elements from ${siteDisplay}?\n\nThis action cannot be undone.`)) {
    return;
  }
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error accessing storage:', chrome.runtime.lastError);
      showError('Failed to clear site');
      return;
    }
    const blocked = result.blockedElements || {};
    const elementCount = blocked[site] ? blocked[site].length : 0;
    delete blocked[site];
    
    chrome.storage.local.set({ blockedElements: blocked }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Error saving storage:', chrome.runtime.lastError);
        showError('Failed to save changes');
      } else {
        showSuccess(`Cleared ${elementCount} element${elementCount !== 1 ? 's' : ''} from ${siteDisplay}`);
        loadBlockedElements();
      }
    });
  });
}

function clearAll() {
  if (!confirm('Remove ALL blocked elements from ALL sites?\n\nThis will permanently delete all your blocked elements and cannot be undone.')) {
    return;
  }
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    const blocked = result.blockedElements || {};
    const totalElements = Object.values(blocked).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    
    chrome.storage.local.set({ blockedElements: {} }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Error clearing all:', chrome.runtime.lastError);
        showError('Failed to clear all elements');
      } else {
        showSuccess(`Cleared ${totalElements} element${totalElements !== 1 ? 's' : ''} from all sites`);
        loadBlockedElements();
      }
    });
  });
}

// Utility functions
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  // Create a toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    max-width: 350px;
    word-wrap: break-word;
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Initialize the application
function initializeApp() {
  initTheme();
  setupEventListeners();
  loadBlockedElements();
}

// Load when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}