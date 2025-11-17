function loadBlockedElements() {
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error loading blocked elements:', chrome.runtime.lastError);
      return;
    }
    
    const blocked = result.blockedElements || {};
    const content = document.getElementById('content');
    console.log(blocked);
    if (Object.keys(blocked).length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <h2>No Blocked Elements</h2>
          <p>Start blocking elements on any website to see them here</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    for (const [site, selectors] of Object.entries(blocked)) {
      if (selectors.length === 0) continue;
      
      html += `
        <div class="site-card" data-site="${site}">
          <div class="site-header">
            <div class="site-name">
              ${site}
              <span class="site-count">${selectors.length} blocked</span>
            </div>
            <button class="clear-site-btn" data-site="${site}">
              Clear All
            </button>
          </div>
          <div class="elements-list">
      `;
      
      selectors.forEach((selector, index) => {
        html += `
          <div class="element-item">
            <span class="element-selector">${escapeHtml(selector)}</span>
            <button class="unblock-btn" data-site="${site}" data-index="${index}">
              Unblock
            </button>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    html += `
      <button class="clear-all-btn">
        Clear All Sites
      </button>
    `;
    
    content.innerHTML = html;
    
    // Attach event listeners using event delegation
    attachEventListeners();
  });
}

function attachEventListeners() {
  const content = document.getElementById('content');
  
  // Clear All Sites button
  const clearAllBtn = content.querySelector('.clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAll);
  }
  
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

function unblockElement(site, index) {
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error accessing storage:', chrome.runtime.lastError);
      return;
    }
    const blocked = result.blockedElements || {};
    
    if (blocked[site]) {
      blocked[site].splice(index, 1);
      
      if (blocked[site].length === 0) {
        delete blocked[site];
      }
      
      chrome.storage.local.set({ blockedElements: blocked }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Error saving storage:', chrome.runtime.lastError);
        } else {
          loadBlockedElements();
        }
      });
    }
  });
}

function clearSite(site) {
  if (!confirm('Clear all blocked elements for ' + site + '?')) return;
  
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) {
      console.warn('Error accessing storage:', chrome.runtime.lastError);
      return;
    }
    const blocked = result.blockedElements || {};
    delete blocked[site];
    
    chrome.storage.local.set({ blockedElements: blocked }, () => {
      if (chrome.runtime.lastError) {
        console.warn('Error saving storage:', chrome.runtime.lastError);
      } else {
        loadBlockedElements();
      }
    });
  });
}

function clearAll() {
  if (!confirm('Clear all blocked elements from all sites?')) return;
  
  chrome.storage.local.set({ blockedElements: {} }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Error clearing all:', chrome.runtime.lastError);
    } else {
      loadBlockedElements();
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load on page load
loadBlockedElements();