// content.js - Improved & corrected version
// Unified class names:
//  - element-blocker-hidden  -> applied to hidden elements (and sets display: none !important)
//  - element-blocker-highlight -> temporary highlight during blocking mode

let isBlocking = false;
let hoveredElement = null;
let blockedSelectors = []; // cached selectors for current hostname
const HIDE_CLASS = 'element-blocker-hidden';
const HIGHLIGHT_CLASS = 'element-blocker-highlight';
const STORAGE_KEY = 'blockedElements';
const hostname = window.location.hostname;

// --- Inject CSS to ensure hidden elements are actually hidden and highlight visible ---
(function injectStyles() {
  const css = `
    .${HIDE_CLASS} { display: none !important; visibility: hidden !important; opacity: 0 !important; }
    .${HIGHLIGHT_CLASS} { outline: 3px solid rgba(255,0,0,0.85); background: rgba(255,0,0,0.03); cursor: crosshair; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);
})();

// --- Utility: safe CSS escape ---
function escapeSelector(value) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
}

// --- Utility: test if selector uniquely identifies one element ---
function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch (e) {
    return false;
  }
}

// --- Build a CSS selector for an element, trying to be stable across re-renders ---
// Prefer: id -> data-* (unique) -> a[href path] -> fallback path using tag:nth-of-type
function buildStableSelector(el) {
  if (!el || el.nodeType !== 1) return null;

  // 1) id
  if (el.id) {
    const s = '#' + escapeSelector(el.id);
    if (isUniqueSelector(s)) return s;
  }

  // 2) unique data-* attribute
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith('data-') && attr.value) {
      const sel = `${el.tagName.toLowerCase()}[${attr.name}="${escapeSelector(attr.value)}"]`;
      if (isUniqueSelector(sel)) return sel;
    }
  }

  // 3) anchor with path-only href (avoid full origin)
  if (el.tagName.toLowerCase() === 'a' && el.href) {
    try {
      const url = new URL(el.href, location.origin);
      const path = url.pathname + url.search + url.hash;
      const sel = `a[href="${escapeSelector(path)}"]`;
      if (isUniqueSelector(sel)) return sel;
    } catch (e) {
      // ignore
    }
  }

  // 4) Try to create a reasonably specific path up the DOM using IDs/classes when possible
  const maxDepth = 6;
  let parts = [];
  let node = el;
  for (let depth = 0; node && depth < maxDepth; depth++, node = node.parentElement) {
    let part = node.tagName.toLowerCase();

    // prefer id or unique data-* on ancestor to shorten path
    if (node.id) {
      part = '#' + escapeSelector(node.id);
      parts.unshift(part);
      break;
    }

    // if node has classes, include the first (simple) class
    if (node.classList && node.classList.length) {
      // choose a class that doesn't look like an auto-generated one (heuristic)
      let chosen = null;
      for (let c of node.classList) {
        if (c.length > 1 && !/^\d+$/.test(c)) { chosen = c; break; }
      }
      if (chosen) {
        part += '.' + escapeSelector(chosen.split(' ')[0]);
      }
    }

    // nth-of-type for precision
    const siblings = Array.from(node.parentElement ? node.parentElement.children : []);
    const sameTag = siblings.filter(s => s.tagName === node.tagName);
    if (sameTag.length > 1) {
      const idx = sameTag.indexOf(node) + 1;
      part += `:nth-of-type(${idx})`;
    }

    parts.unshift(part);
  }

  const candidate = parts.join(' > ');
  if (candidate && isUniqueSelector(candidate)) return candidate;

  // 5) As last resort, create a data attribute so we can re-find the element on this DOM instance
  // (Note: this will not survive full page re-renders/navigation but is fallback)
  const uniqueId = 'eb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  try {
    el.setAttribute('data-element-blocker-id', uniqueId);
    return `[data-element-blocker-id="${uniqueId}"]`;
  } catch (e) {
    return null;
  }
}

// --- STORAGE HELPERS ---
function getStoredBlocked(callback) {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    if (chrome.runtime.lastError) {
      console.warn('Storage get error', chrome.runtime.lastError);
      callback({});
      return;
    }
    callback(res[STORAGE_KEY] || {});
  });
}

function setStoredBlocked(obj, callback) {
  const payload = {};
  payload[STORAGE_KEY] = obj;
  chrome.storage.local.set(payload, () => {
    if (chrome.runtime.lastError) {
      console.warn('Storage set error', chrome.runtime.lastError);
    }
    if (typeof callback === 'function') callback();
  });
}

// --- Load selectors for this hostname (once on script load) ---
function loadBlockedSelectorsFromStorage() {
  getStoredBlocked((stored) => {
    const all = stored || {};
    blockedSelectors = Array.isArray(all[hostname]) ? all[hostname].slice() : [];
    // apply them immediately
    reapplyAllBlockedSelectors();
  });
}

// --- Save a selector for this host (avoid duplicates) ---
function saveSelectorForHost(selector) {
  if (!selector) return;
  if (blockedSelectors.includes(selector)) return;

  blockedSelectors.push(selector);
  // persist
  getStoredBlocked((stored) => {
    const newStore = Object.assign({}, stored || {});
    newStore[hostname] = Array.isArray(newStore[hostname]) ? newStore[hostname].slice() : [];
    if (!newStore[hostname].includes(selector)) newStore[hostname].push(selector);
    setStoredBlocked(newStore);
  });
}

// --- Remove all selectors for this host ---
function clearAllBlocks() {
  // clear in-memory
  blockedSelectors = [];

  // clear persisted
  getStoredBlocked((stored) => {
    const s = Object.assign({}, stored || {});
    delete s[hostname];
    setStoredBlocked(s, () => {
      // optional callback
    });
  });

  // remove classes from DOM
  document.querySelectorAll(`.${HIDE_CLASS}`).forEach(el => {
    el.classList.remove(HIDE_CLASS);
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.style.removeProperty('opacity');
  });

  removeHighlight();
}

// --- Apply a selector to all matching elements (and optionally save it) ---
function applySelector(selector, { save = false } = {}) {
  if (!selector) return false;
  let found = false;
  try {
    const els = document.querySelectorAll(selector);
    if (els && els.length) {
      els.forEach(el => {
        if (!el.classList.contains(HIDE_CLASS)) {
          el.classList.add(HIDE_CLASS);
          // double ensure
          try { el.style.setProperty('display', 'none', 'important'); } catch (e) {}
        }
      });
      found = true;
      if (save) saveSelectorForHost(selector);
    }
  } catch (e) {
    // invalid selector etc
    console.warn('applySelector error for', selector, e);
  }
  return found;
}

// Reapply cached selectors (used on load and by MutationObserver)
function reapplyAllBlockedSelectors() {
  if (!blockedSelectors || blockedSelectors.length === 0) return;
  blockedSelectors.forEach(sel => applySelector(sel, { save: false }));
}

// --- Mutation observer: reapply cached selectors when DOM changes ---
// DO NOT re-read storage here; use cached blockedSelectors only.
const mutationHandler = debounce(() => {
  reapplyAllBlockedSelectors();
}, 300);

const observer = new MutationObserver(mutationHandler);
observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

// --- Throttle helpers (rAF based) ---
let rafScheduled = false;
function scheduleMouseMove(fn) {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    fn();
  });
}

// debounce (simple)
function debounce(fn, wait) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// --- Highlight handling ---
function removeHighlight() {
  if (hoveredElement) {
    hoveredElement.classList.remove(HIGHLIGHT_CLASS);
    hoveredElement = null;
  }
}

// --- Block element user clicked (primary action) ---
function blockElement(el) {
  if (!el || el.nodeType !== 1) return;
  if (el.classList.contains(HIDE_CLASS)) return;

  // build the most stable selector we can
  const selector = buildStableSelector(el);
  if (!selector) return;

  // apply hide class immediately
  applySelector(selector, { save: true });

  // remove temporary highlight
  removeHighlight();
}

// --- Popup / background message listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    sendResponse({ success: false });
    return true;
  }

  if (request.action === 'toggleBlock') {
    isBlocking = !!request.enabled;
    if (!isBlocking) removeHighlight();
    sendResponse({ success: true, isBlocking });
  }
  else if (request.action === 'clearBlocks') {
    clearAllBlocks();
    isBlocking = false;
    removeHighlight();
    sendResponse({ success: true });
  }
  else if (request.action === 'getState') {
    sendResponse({ success: true, isBlocking });
  }
  else if (request.action === 'applyQuickOptions') {
    applyQuickOptions(request.options || {});
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false });
  }

  // Indicate async response possible
  return true;
});

// --- Quick option handling (YouTube-specific helpers included) ---
const youtubeSelectors = {
  hideNotificationBell: 'ytd-notification-topbar-button-renderer, #notification-icon, button#notifications-button',
  hideFeed: 'ytd-rich-grid-renderer, #contents, #primary #contents, ytd-browse[page-subtype="home"] #contents',
  disableAutoplay: '.ytp-autonav-toggle-button, .ytp-autonav-toggle',
  hideShorts: 'a[href*="/shorts"], ytd-rich-shelf-renderer[href*="/shorts"], tp-yt-paper-tab a[href*="/shorts"]',
  hideSubBar: '[href*="/feed/subscriptions"], a[href*="/feed/subscriptions"]',
  hideComments: 'ytd-comments#comments, #comments, ytd-comments',
  hideSidebar: '#secondary, ytd-watch-next-secondary-results-renderer, .secondary',
  // add more as needed
};

// fallback simpler selectors per optionId (used only if primary fails)
const fallbackSelectors = {
  hideNotificationBell: '[id*="notification"], [class*="notification"]',
  hideFeed: '[id*="contents"], [class*="feed"]',
  hideShorts: '[href*="shorts"], [title*="Shorts"]',
  hideSubBar: '[href*="subscription"], [title*="Subscription"]',
  hideComments: '[id*="comment"], [class*="comment"]',
  hideSidebar: '[id*="secondary"], [class*="secondary"]'
};

function applyQuickOptions(options) {
  if (!hostname.includes('youtube.com')) {
    console.log('Quick options skipped: not on YouTube');
    return;
  }

  // For each option: try primary selector(s), fallback(s). Save whichever selector actually matched.
  Object.keys(options || {}).forEach(optionId => {
    if (!options[optionId]) return;

    const primary = youtubeSelectors[optionId];
    let matched = false;

    if (primary) {
      try {
        const els = document.querySelectorAll(primary);
        if (els.length > 0) {
          // apply and save the primary selector (but store only if it actually hides something)
          els.forEach(el => {
            if (!el.classList.contains(HIDE_CLASS)) {
              el.classList.add(HIDE_CLASS);
              try { el.style.setProperty('display', 'none', 'important'); } catch (e) {}
            }
          });
          saveSelectorForHost(primary);
          matched = true;
        }
      } catch (e) {
        console.warn('Primary quick selector invalid', primary, e);
      }
    }

    // If not matched, try fallback(s) (may match more broadly). Save the fallback that matched.
    if (!matched && fallbackSelectors[optionId]) {
      try {
        const fsel = fallbackSelectors[optionId];
        const els = document.querySelectorAll(fsel);
        if (els.length > 0) {
          els.forEach(el => {
            if (!el.classList.contains(HIDE_CLASS)) {
              el.classList.add(HIDE_CLASS);
              try { el.style.setProperty('display', 'none', 'important'); } catch (e) {}
            }
          });
          saveSelectorForHost(fsel); // save the fallback selector that actually matched
          matched = true;
        }
      } catch (e) {
        console.warn('Fallback quick selector failed', optionId, e);
      }
    }

    // Special-case: disableAutoplay — try clicking autoplay button reliably
    if (optionId === 'disableAutoplay' && options[optionId]) {
      disableAutoplayReliable();
    }
  });

  // run a delayed re-check for dynamic content
  setTimeout(() => {
    reapplyAllBlockedSelectors();
  }, 1800);
}

function disableAutoplayReliable() {
  const attempts = 6;
  let attempt = 0;
  const interval = 1000;

  const tryToggle = () => {
    attempt++;
    // find possible toggle button variants
    const candidates = [
      document.querySelector('.ytp-autonav-toggle-button'),
      document.querySelector('.ytp-autonav-toggle'),
      document.querySelector('[aria-label*="Autoplay"]'),
      document.querySelector('.ytp-settings-button + .ytp-autonav-toggle-button') // fallback
    ].filter(Boolean);

    if (candidates.length) {
      // pick first that indicates it's on, then click to turn off
      for (const btn of candidates) {
        try {
          const aria = btn.getAttribute('aria-checked') || btn.getAttribute('aria-pressed') || btn.getAttribute('aria-label') || '';
          const isOn = aria === 'true' || /on/i.test(aria) || /enabled/i.test(aria);
          // click anyway, to ensure toggle in case state check is imprecise
          btn.click();
          console.log('Autoplay toggle clicked', btn, 'detectedOn:', isOn);
          return;
        } catch (e) {
          console.warn('Autoplay click failed', e);
        }
      }
    }

    if (attempt < attempts) {
      setTimeout(tryToggle, interval);
    }
  };

  tryToggle();
}

// --- Mouse highlight (throttled via rAF) ---
document.addEventListener('mousemove', (e) => {
  if (!isBlocking) return;
  scheduleMouseMove(() => {
    try {
      const target = e.target;
      if (!target || !(target instanceof Element)) return;

      // ignore if it is part of our extension UI (if any). Example attribute check:
      // if (target.closest('[data-ghostblock-ui]')) return;

      if (hoveredElement && hoveredElement !== target) {
        hoveredElement.classList.remove(HIGHLIGHT_CLASS);
      }

      hoveredElement = target;
      hoveredElement.classList.add(HIGHLIGHT_CLASS);
    } catch (err) {
      console.warn('mousemove highlight error', err);
    }
  });
}, true);

// --- Click to block (left-click) ---
document.addEventListener('click', (e) => {
  if (!isBlocking) return;

  // left button only
  if (e.button !== 0) return;

  // Prevent link navigation and propagation while in blocking mode
  try {
    e.preventDefault();
    e.stopPropagation();
  } catch (err) {}

  // ignore clicks that originate from extension UI if any (example):
  // if (e.target.closest('[data-ghostblock-ui]')) return;

  blockElement(e.target);
}, true);

// --- Escape key to exit blocking mode ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isBlocking) {
    isBlocking = false;
    removeHighlight();
  }
});

// --- Init load ---
loadBlockedSelectorsFromStorage();

// -- Optional: expose small debug for console usage --
window.__elementBlocker = {
  getBlockedSelectors: () => blockedSelectors.slice(),
  reapply: reapplyAllBlockedSelectors,
  clear: clearAllBlocks,
  blockElementBySelector: (s) => applySelector(s, { save: true })
};
