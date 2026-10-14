/**
 * file-sync.js
 * Scouts Queensland Youth Program Team Roadmap
 * 
 * Direct File System Sync Manager using the W3C File System Access API
 * and IndexedDB for handle persistence.
 * 
 * Allows live auto-saving directly to a shared OneDrive JSON file (e.g. data/roadmap-data.json)
 * so changes sync seamlessly between computers without staying trapped in browser localStorage.
 */

class FileSyncManager {
  constructor() {
    this.fileHandle = null;
    this.fileName = null;
    this.isConnected = false;
    this.lastSavedTimestamp = null;
    this.lastModifiedTimestamp = null;
    this.saveTimer = null;
    this.checkInterval = null;
    this.db = null;
    this.dbName = 'scouts_ypt_sync_db';
    this.storeName = 'file_handles';
    this.handleKey = 'active_roadmap_file';
  }

  // Check if File System Access API is supported and in a secure context
  isSupported() {
    return typeof window.showOpenFilePicker === 'function' && (window.isSecureContext || window.location.protocol === 'file:');
  }

  // --- IndexedDB Handle Storage ---
  async openDB() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getStoredHandle() {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(this.handleKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('Could not read stored handle from IndexedDB:', e);
      return null;
    }
  }

  async saveStoredHandle(handle) {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(handle, this.handleKey);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (e) {
      console.warn('Could not persist handle in IndexedDB:', e);
    }
  }

  async clearStoredHandle() {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(this.handleKey);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('Could not clear stored handle:', e);
    }
  }

  // --- Initialization ---
  async init() {
    this.bindUIEvents();
    
    // Check if previous handle exists in IndexedDB
    const storedHandle = await this.getStoredHandle();
    if (storedHandle) {
      this.fileHandle = storedHandle;
      this.fileName = storedHandle.name || 'roadmap-data.json';
      
      try {
        // Query readwrite permission
        const permission = await storedHandle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          await this.loadFromFile(storedHandle, false);
          this.setConnected(true);
        } else {
          // Requires user gesture to re-grant permission
          this.updateStatusUI('needs-reconnect');
        }
      } catch (err) {
        console.warn('Stored handle query error:', err);
        this.updateStatusUI('needs-reconnect');
      }
    } else {
      this.updateStatusUI('disconnected');
    }

    // Start external change polling (to catch OneDrive updates from other computers)
    this.startWatcher();
  }

  // --- Connect Actions ---
  async openExistingFile() {
    if (!this.isSupported()) {
      this.showUnsupportedDialog();
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON Roadmap Data File (*.json)',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      });

      if (!handle) return;

      const permission = await this.verifyPermission(handle, true);
      if (!permission) {
        alert('Read & write permission is needed to sync directly to this file.');
        return;
      }

      this.fileHandle = handle;
      this.fileName = handle.name;
      await this.saveStoredHandle(handle);
      await this.loadFromFile(handle, true);
      this.setConnected(true);

      const modal = document.getElementById('fileSyncDialog');
      if (modal && modal.open) modal.close();

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error opening file:', err);
        if (window.location.protocol === 'file:') {
          this.showFileProtocolHelp();
        } else {
          alert('Could not open file: ' + err.message);
        }
      }
    }
  }

  async createNewFile() {
    if (!this.isSupported()) {
      this.showUnsupportedDialog();
      return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'roadmap-data.json',
        types: [{
          description: 'JSON Roadmap Data File (*.json)',
          accept: { 'application/json': ['.json'] }
        }]
      });

      if (!handle) return;

      this.fileHandle = handle;
      this.fileName = handle.name;
      await this.saveStoredHandle(handle);

      // Write current master dataset to the newly created file
      await this.writeToFile();
      this.setConnected(true);

      const modal = document.getElementById('fileSyncDialog');
      if (modal && modal.open) modal.close();

      alert(`Successfully created and linked to "${this.fileName}"! Live auto-save is now active.`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error creating file:', err);
        if (window.location.protocol === 'file:') {
          this.showFileProtocolHelp();
        } else {
          alert('Could not create file: ' + err.message);
        }
      }
    }
  }

  async reconnectStoredHandle() {
    if (!this.fileHandle) return;
    try {
      const permission = await this.verifyPermission(this.fileHandle, true);
      if (permission) {
        await this.loadFromFile(this.fileHandle, true);
        this.setConnected(true);
      } else {
        alert('Permission was not granted. Please click "Connect Different File" to select it again.');
      }
    } catch (err) {
      console.error('Error reconnecting handle:', err);
      alert('Could not reconnect to the saved file: ' + err.message);
    }
  }

  async verifyPermission(fileHandle, readWrite = true) {
    const opts = {};
    if (readWrite) opts.mode = 'readwrite';
    if ((await fileHandle.queryPermission(opts)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(opts)) === 'granted') {
      return true;
    }
    return false;
  }

  // --- Reading from File ---
  async loadFromFile(handle, showNotification = false) {
    try {
      const file = await handle.getFile();
      const text = await file.text();
      this.lastModifiedTimestamp = file.lastModified;

      if (!window.storageManager) {
        console.warn('StorageManager not found');
        return;
      }

      const res = window.storageManager.importJSON(text);
      if (res.success) {
        this.lastSavedTimestamp = file.lastModified;
        if (window.app && typeof window.app.render === 'function') {
          window.app.selectedCategories = new Set(Object.keys(window.storageManager.getCategories()));
          window.app.populateCategoryFilters();
          window.app.renderLegendBar();
          window.app.updateBlockoutControls();
          window.app.render();
        }
        if (showNotification) {
          this.showToast(`Loaded ${res.count} items from ${handle.name}`);
        }
      } else {
        console.error('Failed to parse file JSON:', res.error);
        alert(`Error loading data from ${handle.name}: ${res.error}`);
      }
    } catch (err) {
      console.error('Error reading file:', err);
      throw err;
    }
  }

  // --- Writing to File ---
  async writeToFile() {
    if (!this.fileHandle || !this.isConnected) return;

    this.updateStatusUI('saving');

    try {
      const payload = {
        version: '2.1',
        lastSaved: new Date().toISOString(),
        items: window.storageManager.getItems(),
        categories: window.storageManager.getCategories(),
        blockouts: window.storageManager.getBlockouts()
      };

      const writable = await this.fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();

      const file = await this.fileHandle.getFile();
      this.lastModifiedTimestamp = file.lastModified;
      this.lastSavedTimestamp = Date.now();

      this.updateStatusUI('synced');
    } catch (err) {
      console.error('Error writing to file:', err);
      this.updateStatusUI('error');
    }
  }

  // Debounced trigger called by storageManager.save()
  onStorageSaved() {
    if (!this.fileHandle || !this.isConnected) return;
    
    clearTimeout(this.saveTimer);
    this.updateStatusUI('saving');
    this.saveTimer = setTimeout(() => {
      this.writeToFile();
    }, 400);
  }

  // --- External Sync & File Watcher (OneDrive from other computer) ---
  startWatcher() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    
    // Check every 6 seconds
    this.checkInterval = setInterval(() => this.checkForExternalChanges(), 6000);

    // Also check immediately when browser tab regains focus
    window.addEventListener('focus', () => this.checkForExternalChanges());
  }

  async checkForExternalChanges() {
    if (!this.fileHandle || !this.isConnected) return;

    try {
      const permission = await this.fileHandle.queryPermission({ mode: 'read' });
      if (permission !== 'granted') return;

      const file = await this.fileHandle.getFile();
      
      // If disk timestamp is newer than our last read/write by at least 1.5 seconds
      if (this.lastModifiedTimestamp && (file.lastModified - this.lastModifiedTimestamp) > 1500) {
        const text = await file.text();
        const currentDataStr = JSON.stringify({
          version: '2.1',
          items: window.storageManager.getItems(),
          categories: window.storageManager.getCategories(),
          blockouts: window.storageManager.getBlockouts()
        });
        
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { return; }

        const fileItemsStr = JSON.stringify({
          version: parsed.version || '2.1',
          items: parsed.items || parsed.roadmap || [],
          categories: parsed.categories || {},
          blockouts: parsed.blockouts || []
        });

        // If the content is actually different
        if (currentDataStr !== fileItemsStr) {
          this.pendingExternalFileText = text;
          this.pendingExternalTimestamp = file.lastModified;
          this.showExternalUpdateBanner(file.lastModified);
        } else {
          // Content identical, just update timestamp
          this.lastModifiedTimestamp = file.lastModified;
        }
      }
    } catch (err) {
      // Non-fatal, just retry next cycle
    }
  }

  showExternalUpdateBanner(timestamp) {
    const banner = document.getElementById('externalSyncBanner');
    const timeSpan = document.getElementById('externalSyncTime');
    if (!banner) return;

    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (timeSpan) timeSpan.textContent = `(${timeStr})`;
    banner.style.display = 'flex';
  }

  hideExternalUpdateBanner() {
    const banner = document.getElementById('externalSyncBanner');
    if (banner) banner.style.display = 'none';
  }

  async applyExternalChanges() {
    if (!this.pendingExternalFileText) return;

    const res = window.storageManager.importJSON(this.pendingExternalFileText);
    if (res.success) {
      this.lastModifiedTimestamp = this.pendingExternalTimestamp;
      this.lastSavedTimestamp = Date.now();
      this.hideExternalUpdateBanner();
      
      if (window.app && typeof window.app.render === 'function') {
        window.app.selectedCategories = new Set(Object.keys(window.storageManager.getCategories()));
        window.app.populateCategoryFilters();
        window.app.renderLegendBar();
        window.app.updateBlockoutControls();
        window.app.render();
      }
      this.showToast('Updated roadmap with changes from OneDrive!');
      this.updateStatusUI('synced');
    }
  }

  // --- Disconnect ---
  async disconnect() {
    this.fileHandle = null;
    this.fileName = null;
    this.isConnected = false;
    await this.clearStoredHandle();
    this.hideExternalUpdateBanner();
    this.updateStatusUI('disconnected');
    
    const modal = document.getElementById('fileSyncDialog');
    if (modal && modal.open) modal.close();

    this.showToast('Disconnected from file. Now using browser storage.');
  }

  setConnected(connected) {
    this.isConnected = connected;
    if (connected) {
      this.updateStatusUI('synced');
    } else {
      this.updateStatusUI('disconnected');
    }
  }

  // --- UI Update & Event Wiring ---
  updateStatusUI(state) {
    const btn = document.getElementById('fileSyncBtn');
    const dot = document.getElementById('fileSyncDot');
    const label = document.getElementById('fileSyncLabel');
    if (!btn || !dot || !label) return;

    dot.className = 'sync-dot';

    switch (state) {
      case 'synced':
        dot.classList.add('synced');
        label.textContent = `🟢 ${this.fileName || 'OneDrive File'} (Synced)`;
        btn.title = `Direct OneDrive File Sync is active (${this.fileName}). Click for options.`;
        break;

      case 'saving':
        dot.classList.add('saving');
        label.textContent = `🟡 Saving to ${this.fileName || 'file'}...`;
        btn.title = 'Writing changes directly to file...';
        break;

      case 'needs-reconnect':
        dot.classList.add('needs-reconnect');
        label.textContent = `📁 Reconnect: ${this.fileName || 'roadmap-data.json'}`;
        btn.title = 'Click to re-activate auto-saving to your OneDrive file.';
        break;

      case 'error':
        dot.classList.add('error');
        label.textContent = `❌ Sync Error`;
        btn.title = 'Failed to write to file. Click to check file access.';
        break;

      case 'disconnected':
      default:
        dot.classList.add('disconnected');
        label.textContent = `📁 Connect OneDrive File`;
        btn.title = 'Connect directly to a shared OneDrive JSON file to sync across computers.';
        break;
    }
  }

  bindUIEvents() {
    // Top Bar Sync Button Click
    const syncBtn = document.getElementById('fileSyncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        if (!this.isConnected && this.fileHandle) {
          // If handle is waiting for permission reconnect
          this.reconnectStoredHandle();
        } else {
          this.openSyncModal();
        }
      });
    }

    // Modal Action Buttons
    document.getElementById('syncOpenFileBtn')?.addEventListener('click', () => this.openExistingFile());
    document.getElementById('syncSwitchFileBtn')?.addEventListener('click', () => this.openExistingFile());
    document.getElementById('syncCreateFileBtn')?.addEventListener('click', () => this.createNewFile());
    document.getElementById('syncSaveNowBtn')?.addEventListener('click', () => this.writeToFile());
    document.getElementById('syncReloadBtn')?.addEventListener('click', () => {
      if (this.fileHandle) {
        this.loadFromFile(this.fileHandle, true);
        document.getElementById('fileSyncDialog')?.close();
      }
    });
    document.getElementById('syncDisconnectBtn')?.addEventListener('click', () => this.disconnect());
    document.getElementById('closeSyncDialogBtn')?.addEventListener('click', () => {
      document.getElementById('fileSyncDialog')?.close();
    });
    document.getElementById('cancelSyncBtn')?.addEventListener('click', () => {
      document.getElementById('fileSyncDialog')?.close();
    });

    // External Sync Banner Actions
    document.getElementById('reloadExternalFileBtn')?.addEventListener('click', () => this.applyExternalChanges());
    document.getElementById('dismissExternalFileBtn')?.addEventListener('click', () => {
      this.hideExternalUpdateBanner();
      // Record latest timestamp so we don't nag repeatedly for the same change
      if (this.pendingExternalTimestamp) {
        this.lastModifiedTimestamp = this.pendingExternalTimestamp;
      }
    });

    // Standard Import JSON Button & File Input
    const importJsonBtn = document.getElementById('importJsonBtn');
    const jsonFileInput = document.getElementById('jsonFileInput');
    if (importJsonBtn && jsonFileInput) {
      importJsonBtn.addEventListener('click', () => {
        jsonFileInput.value = '';
        jsonFileInput.click();
      });

      jsonFileInput.addEventListener('change', (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const res = window.storageManager.importJSON(evt.target.result);
          if (res.success) {
            this.showToast(`Imported ${res.count} items from ${file.name}!`);
            if (window.app && typeof window.app.render === 'function') {
              window.app.selectedCategories = new Set(Object.keys(window.storageManager.getCategories()));
              window.app.populateCategoryFilters();
              window.app.renderLegendBar();
              window.app.updateBlockoutControls();
              window.app.render();
            }
          } else {
            alert(`JSON Import Failed: ${res.error}`);
          }
        };
        reader.readAsText(file);
      });
    }
  }

  openSyncModal() {
    const dialog = document.getElementById('fileSyncDialog');
    if (!dialog) return;

    const modalStatus = document.getElementById('syncModalStatus');
    const modalFileName = document.getElementById('syncModalFileName');
    const modalLastSaved = document.getElementById('syncModalLastSaved');
    const connectedActions = document.getElementById('syncConnectedActions');
    const disconnectedActions = document.getElementById('syncDisconnectedActions');

    if (this.isConnected && this.fileHandle) {
      if (modalStatus) modalStatus.innerHTML = '<span style="color: #16a34a; font-weight: 700;">🟢 Active (Auto-Saving to Disk)</span>';
      if (modalFileName) modalFileName.textContent = this.fileName;
      if (modalLastSaved) {
        modalLastSaved.textContent = this.lastSavedTimestamp 
          ? new Date(this.lastSavedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'Just now';
      }
      if (connectedActions) connectedActions.style.display = 'block';
      if (disconnectedActions) disconnectedActions.style.display = 'none';
    } else {
      if (modalStatus) modalStatus.innerHTML = '<span style="color: #64748b; font-weight: 700;">⚪ Disconnected (Saved only in browser localStorage)</span>';
      if (modalFileName) modalFileName.textContent = 'None';
      if (modalLastSaved) modalLastSaved.textContent = 'N/A';
      if (connectedActions) connectedActions.style.display = 'none';
      if (disconnectedActions) disconnectedActions.style.display = 'block';
    }

    dialog.showModal();
  }

  showUnsupportedDialog() {
    alert(
      'Direct file writing requires a browser that supports the File System Access API (such as Google Chrome, Microsoft Edge, Brave, or Opera).\n\n' +
      'On Safari or Firefox, please use the "Import JSON" and "Backup JSON" buttons in the top toolbar to load and save your data file.'
    );
  }

  showFileProtocolHelp() {
    alert(
      'Browser Security Note:\n\n' +
      'Browsers block direct auto-saving when opening a file directly from Finder/Explorer (file:///...).\n\n' +
      'To enable direct live file syncing to your OneDrive folder:\n' +
      '1. Double-click "start-mac.command" (or "start-windows.bat") in your roadmap folder.\n' +
      '2. It will open http://localhost:8080 where direct file auto-saving is fully permitted!\n\n' +
      'Alternatively, you can use the "Import JSON" button in the toolbar anytime.'
    );
  }

  showToast(message) {
    let toast = document.getElementById('syncToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'syncToast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.backgroundColor = '#1c4270';
      toast.style.color = '#ffffff';
      toast.style.padding = '0.6rem 1rem';
      toast.style.borderRadius = '8px';
      toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      toast.style.fontSize = '0.85rem';
      toast.style.fontWeight = '700';
      toast.style.zIndex = '9999';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3500);
  }
}

// Global instance
window.fileSyncManager = new FileSyncManager();
document.addEventListener('DOMContentLoaded', () => {
  window.fileSyncManager.init();
});
