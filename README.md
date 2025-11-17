# Element Blocker

A lightweight Chrome extension that allows you to block any unwanted element on any webpage with just one click.

## Features

✨ **Click to Block** - Simply select any element and block it instantly
🎯 **Visual Highlighting** - See exactly what you're about to block with red outline highlighting
💾 **Persistent Blocking** - Your blocked elements stay blocked across page reloads
🗂️ **Manage All Blocks** - View and manage all blocked elements across different websites
🗑️ **Easy Unblocking** - Remove individual blocks or clear entire sites with one click
🌐 **Works Everywhere** - Blocks elements on any website you visit
🔒 **100% Private** - All data stored locally on your device, nothing is sent to servers

## How to Use

### Starting the Block Mode
1. Click the **Element Blocker** extension icon in your Chrome toolbar
2. Click the **"Start Blocking"** toggle to enable blocking mode
3. The popup will show **"Click elements on page to block them"** when active

### Blocking Elements
1. Once blocking mode is active, hover over any element on the page
2. Elements will be highlighted with a **red outline** as you hover
3. Click on any element to block it
4. The element will fade out and disappear from the page

### Exiting Block Mode
- Press **Escape** key to exit blocking mode
- Or click the toggle again to turn off blocking

### Managing Blocked Elements
1. Click **"Manage"** button in the popup
2. View all blocked elements organized by website
3. **Unblock** individual elements or **Clear All** from a site
4. Click **"Clear All Sites"** to reset everything

### Clearing Blocks
1. Click **"Clear This Site"** to remove all blocks from the current website
2. A confirmation dialog will appear before clearing

## How It Works

- **Selection**: The extension analyzes each element and creates a stable CSS selector
- **Storage**: Blocked element selectors are saved to Chrome's local storage
- **Persistence**: When you reload the page, previously blocked elements are automatically hidden
- **Dynamic Content**: The extension monitors the page for new elements and applies blocks automatically

## Privacy

✅ **No Data Collection** - We don't collect any information about you or the sites you visit
✅ **Local Storage Only** - All blocked elements are stored locally on your device
✅ **No Tracking** - No analytics, no cookies, no telemetry
✅ **No Network Requests** - The extension only works offline on your device
✅ **Open Source** - Our code is transparent and available for review

## Technical Details

- **Manifest Version**: 3 (Latest Chrome Extension standard)
- **Permissions**: activeTab, storage, scripting, host access to all URLs
- **Storage**: Chrome Storage API (chrome.storage.local)
- **CSS Selectors**: Stable selector generation with fallback custom attributes
- **Content Script**: Runs on all websites to detect and hide blocked elements

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **"Load unpacked"**
4. Select your `blocker-extension` folder
5. The extension will appear in your Chrome toolbar

## Troubleshooting

### Blocking isn't working
- Make sure the extension toggle is **ON** (green)
- Check the browser console for any errors (F12)
- Try reloading the page

### Elements reappear after reload
- This is normal if you didn't successfully block them
- Make sure the element fades out when you click it

### Can't find blocked elements page
- Click the **"Manage"** button in the popup to view all blocks

## Keyboard Shortcuts

- **Escape** - Exit blocking mode

## Support

If you encounter any issues:
1. Check the console for error messages (F12)
2. Try reloading the page
3. Reload the extension (chrome://extensions/)

## License

This extension is provided as-is for personal use.

## Version History

### v1.0 (Current)
- Initial release
- Click-to-block functionality
- Element highlighting
- Persistent blocking
- Management interface
- Privacy-first design
