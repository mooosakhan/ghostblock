let isBlocking = false;
let hoveredElement = null;
let blockedElements = []; // <-- will now be repopulated after load

// Helper function to escape CSS selector values
function escapeSelector(str) {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(str);
  }
  return str.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

function getElementSelector(element) {
  if (element.id) {
    return '#' + escapeSelector(element.id);
  }

  const attrs = element.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith('data-') && attr.value) {
      try {
        const selector = element.tagName.toLowerCase() + '[' + attr.name + '="' + escapeSelector(attr.value) + '"]';
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (e) {}
    }
  }

  if (element.tagName === 'A' && element.href) {
    try {
      const url = new URL(element.href);
      const path = url.pathname + url.search;
      const selector = 'a[href="' + escapeSelector(path) + '"]';
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch (e) {}
  }

  const uniqueId = 'eb-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  element.setAttribute('data-element-blocker-id', uniqueId);

  return '[data-element-blocker-id="' + uniqueId + '"]';
}


// ⭐ MAIN FIX — loads selectors and updates blockedElements array
function loadBlockedElements() {
  const url = window.location.hostname;

  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) return;

    const blocked = result.blockedElements || {};
    const selectors = blocked[url] || [];

    blockedElements = selectors; // <-- now your manage page sees them

    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          el.classList.add("element-blocker-blocked");
        });
      } catch (e) {}
    });
  });
}


// Save element
function saveBlockedElement(url, selector) {
  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) return;

    const blocked = result.blockedElements || {};
    if (!blocked[url]) blocked[url] = [];

    if (!blocked[url].includes(selector)) {
      blocked[url].push(selector);
    }

    chrome.storage.local.set({ blockedElements: blocked });
  });
}


// Remove highlight
function removeHighlight() {
  if (hoveredElement) {
    hoveredElement.classList.remove('element-blocker-highlight');
    hoveredElement = null;
  }
}


// Clear all blocks on this site
function clearAllBlocks() {
  const url = window.location.hostname;

  chrome.storage.local.get(['blockedElements'], (result) => {
    if (chrome.runtime.lastError) return;

    const blocked = result.blockedElements || {};
    delete blocked[url];

    chrome.storage.local.set({ blockedElements: blocked });
  });

  document.querySelectorAll('.element-blocker-blocked').forEach(el => {
    el.classList.remove('element-blocker-blocked');
  });

  blockedElements = [];
  removeHighlight();
}


// Block element
function blockElement(element) {
  if (element.classList.contains('element-blocker-blocked')) return;

  const selector = getElementSelector(element);
  const url = window.location.hostname;

  element.classList.add("element-blocker-blocked");

  saveBlockedElement(url, selector);
  blockedElements.push(selector);
}


// Load blocks on page load
loadBlockedElements();


// ⭐ MutationObserver — reapply blocks for dynamic pages
const observer = new MutationObserver(() => {
  const url = window.location.hostname;

  chrome.storage.local.get(['blockedElements'], (result) => {
    const blocked = result.blockedElements || {};
    const selectors = blocked[url] || [];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.classList.add('element-blocker-blocked');
      });
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });


// Popup message listeners
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleBlock') {
    isBlocking = request.enabled;
    if (!isBlocking) removeHighlight();
    sendResponse({ success: true });

  } else if (request.action === 'clearBlocks') {
    clearAllBlocks();
    isBlocking = false;
    sendResponse({ success: true });

  } else if (request.action === 'getState') {
    sendResponse({ isBlocking });
  }

  return true;
});


// Mouse highlight
document.addEventListener('mousemove', (e) => {
  if (!isBlocking) return;

  if (hoveredElement) {
    hoveredElement.classList.remove('element-blocker-highlight');
  }

  hoveredElement = e.target;
  hoveredElement.classList.add('element-blocker-highlight');
}, true);


// Click → block
document.addEventListener('click', (e) => {
  if (!isBlocking) return;

  e.preventDefault();
  e.stopPropagation();

  blockElement(e.target);
  removeHighlight();
}, true);


// Escape → stop blocking
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isBlocking) {
    isBlocking = false;
    removeHighlight();
  }
});
