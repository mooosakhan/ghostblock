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

// --- Update UI toggle ---
function updateToggle() {
  qs("blockToggle").checked = isBlocking;
}
