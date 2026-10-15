/**
 * storage-wp.js
 * WordPress Storage Manager for Scouts Queensland Youth Program Team Roadmap
 * 
 * Directly interfaces with the WordPress REST API (/wp-json/scouts-ypt/v1/data)
 * and WordPress Database (wp_options) for real-time central multi-user sync.
 */

const STORAGE_KEY = 'scouts_ypt_wp_local_cache_v2';
const COL_WIDTHS_STORAGE_KEY = 'scouts_ypt_col_widths_v1';
const BLOCKOUTS_VISIBILITY_KEY = 'scouts_ypt_blockouts_visible_v1';

const DEFAULT_CATEGORIES = {
  'Youth Program Event': '#0284c7',
  'Branch Calendar Event': '#a43c51',
  'Event': '#d97706',
  'Prep': '#008f88',
  'Comms': '#16a34a',
  'School Term': '#28265c',
  'School Holidays': '#0284c7',
  'Queensland Public Holiday': '#ea580c',
  'Student-Free Day': '#6366f1',
  'Brisbane Public Holiday': '#c2410c',
  'Reference': '#64748b'
};

const DEFAULT_COLUMN_WIDTHS = {
  idx: 44,
  title: 320,
  dates: 150,
  owner: 120,
  actions: 70
};

const DEFAULT_BLOCKOUTS = [
  {
    id: 'bo-eoy-2026-2027',
    title: 'EOY Branch Shutdown & Lockout',
    startDate: '2026-12-18',
    endDate: '2027-01-18',
    color: '#ef4444',
    notes: 'Branch office closure and holiday lockout; avoid scheduling major branch events.'
  },
  {
    id: 'bo-easter-2027',
    title: 'Easter Camp & Activity Moratorium',
    startDate: '2027-03-26',
    endDate: '2027-03-30',
    color: '#f59e0b',
    notes: 'Easter weekend blackout; major section camps in progress.'
  }
];

class StorageManager {
  constructor() {
    this.config = window.SCOUTS_YPT_CONFIG || {
      restUrl: '/wp-json/scouts-ypt/v1/',
      nonce: '',
      isLoggedIn: false,
      canEdit: true,
      currentUser: 'Guest',
      initialData: null
    };

    this.saveTimer = null;
    this.isSaving = false;
    this.lastSavedTimestamp = null;
    this.pollInterval = null;

    this.data = this.initData();
  }

  initData() {
    let d = this.config.initialData;
    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) {}
    }

    // 1. If inlined by WordPress in SCOUTS_YPT_CONFIG, use it directly (0ms load)
    if (d && Array.isArray(d.items) && d.items.length > 0) {
      if (!d.categories || typeof d.categories !== 'object') d.categories = { ...DEFAULT_CATEGORIES };
      if (!d.blockouts || !Array.isArray(d.blockouts)) d.blockouts = JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS));
      this.lastSavedTimestamp = d.lastSaved || null;
      return d;
    }

    // 2. Fall back to local browser cache if offline
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}

    // 3. If inlined data had items array
    if (d && Array.isArray(d.items)) {
      if (!d.categories || typeof d.categories !== 'object') d.categories = { ...DEFAULT_CATEGORIES };
      if (!d.blockouts || !Array.isArray(d.blockouts)) d.blockouts = JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS));
      return d;
    }

    // 4. Fallback blank structure
    return {
      items: [],
      categories: { ...DEFAULT_CATEGORIES },
      blockouts: JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS))
    };
  }

  init() {
    this.updateStatusBadge('synced');
    this.startChangeWatcher();
    this.bindBannerEvents();
  }

  // --- Save Logic (Optimistic UI + Debounced REST API POST) ---
  save() {
    // 1. Instant local cache save
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {}

    // 2. If user doesn't have edit permission
    if (!this.config.canEdit) {
      this.updateStatusBadge('readonly');
      return;
    }

    // 3. Debounce save to WordPress REST API
    clearTimeout(this.saveTimer);
    this.updateStatusBadge('saving');

    this.saveTimer = setTimeout(() => {
      this.syncToWordPress();
    }, 450);
  }

  async syncToWordPress() {
    this.isSaving = true;
    try {
      const response = await fetch(this.config.restUrl + 'data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': this.config.nonce
        },
        body: JSON.stringify(this.data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = await response.json();
      this.lastSavedTimestamp = res.lastSaved;
      this.isSaving = false;
      this.updateStatusBadge('synced');
    } catch (err) {
      console.warn('Could not save to WordPress database:', err);
      this.isSaving = false;
      this.updateStatusBadge('error');
    }
  }

  // --- Multi-User External Change Poller ---
  startChangeWatcher() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Poll status endpoint every 20 seconds
    this.pollInterval = setInterval(() => this.checkExternalChanges(), 20000);

    // Also check when tab regains focus
    window.addEventListener('focus', () => this.checkExternalChanges());
  }

  async checkExternalChanges() {
    if (this.isSaving) return;

    try {
      const response = await fetch(this.config.restUrl + 'status', {
        headers: { 'X-WP-Nonce': this.config.nonce }
      });
      if (!response.ok) return;

      const status = await response.json();
      if (!status || !status.lastSaved) return;

      // If server timestamp is newer than our last saved timestamp
      if (this.lastSavedTimestamp && status.lastSaved !== this.lastSavedTimestamp) {
        // Compare with our local data to see if actually different
        const serverDate = new Date(status.lastSaved).getTime();
        const localDate = new Date(this.lastSavedTimestamp).getTime();

        if (serverDate > localDate) {
          this.pendingServerTimestamp = status.lastSaved;
          this.pendingServerUser = status.lastSavedBy || 'Another team member';
          this.showExternalUpdateBanner(status.lastSavedBy, status.lastSaved);
        }
      }
    } catch (e) {
      // Non-fatal
    }
  }

  showExternalUpdateBanner(user, timeStr) {
    const banner = document.getElementById('externalSyncBanner');
    const msg = document.getElementById('externalSyncMsg');
    if (!banner) return;

    const formattedTime = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    if (msg) {
      msg.innerHTML = `🔔 <strong>WordPress Update:</strong> The roadmap was updated by <strong>${user || 'a team member'}</strong> at ${formattedTime}.`;
    }
    banner.style.display = 'flex';
  }

  hideExternalUpdateBanner() {
    const banner = document.getElementById('externalSyncBanner');
    if (banner) banner.style.display = 'none';
  }

  async applyExternalChanges() {
    try {
      const response = await fetch(this.config.restUrl + 'data', {
        headers: { 'X-WP-Nonce': this.config.nonce }
      });
      if (!response.ok) throw new Error('Fetch failed');

      const latest = await response.json();
      if (latest && Array.isArray(latest.items)) {
        this.data = latest;
        this.lastSavedTimestamp = latest.lastSaved || this.pendingServerTimestamp;
        this.hideExternalUpdateBanner();

        if (window.app && typeof window.app.render === 'function') {
          window.app.selectedCategories = new Set(Object.keys(this.getCategories()));
          window.app.populateCategoryFilters();
          window.app.renderLegendBar();
          window.app.updateBlockoutControls();
          window.app.render();
        }

        this.showToast('Roadmap updated with latest changes from WordPress database!');
        this.updateStatusBadge('synced');
      }
    } catch (e) {
      alert('Could not reload from server: ' + e.message);
    }
  }

  bindBannerEvents() {
    document.getElementById('reloadExternalFileBtn')?.addEventListener('click', () => this.applyExternalChanges());
    document.getElementById('dismissExternalFileBtn')?.addEventListener('click', () => {
      this.hideExternalUpdateBanner();
      if (this.pendingServerTimestamp) {
        this.lastSavedTimestamp = this.pendingServerTimestamp;
      }
    });
  }

  // --- Status UI Badge ---
  updateStatusBadge(state) {
    const dot = document.getElementById('fileSyncDot');
    const label = document.getElementById('fileSyncLabel');
    const btn = document.getElementById('fileSyncBtn');
    if (!dot || !label) return;

    dot.className = 'sync-dot';

    switch (state) {
      case 'synced':
        dot.classList.add('synced');
        label.textContent = '🟢 WordPress Synced';
        if (btn) btn.title = `Saved to WordPress Database. Last save: ${this.lastSavedTimestamp || 'Recent'}`;
        break;

      case 'saving':
        dot.classList.add('saving');
        label.textContent = '🟡 Saving to WordPress...';
        if (btn) btn.title = 'Writing changes to WordPress database...';
        break;

      case 'readonly':
        dot.classList.add('disconnected');
        label.textContent = '🔒 View Only';
        if (btn) btn.title = 'You do not have edit permissions. Changes will not be saved to WordPress.';
        break;

      case 'error':
        dot.classList.add('error');
        label.textContent = '❌ Sync Error (Saved Locally)';
        if (btn) btn.title = 'Failed to sync to WordPress. Changes are cached in your browser. Click to retry.';
        break;
    }
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

  // --- Master Items CRUD ---
  getItems() {
    return this.data.items || [];
  }

  addItem(item) {
    if (!item.id) {
      item.id = 'RM-' + Date.now();
    }
    this.data.items.push(item);

    if (item.category && !this.getCategories()[item.category]) {
      this.addCategory(item.category, '#0284c7');
    }

    this.save();
    return item;
  }

  updateItem(updatedItem) {
    const idx = this.data.items.findIndex(i => i.id === updatedItem.id);
    if (idx !== -1) {
      this.data.items[idx] = updatedItem;
      if (updatedItem.category && !this.getCategories()[updatedItem.category]) {
        this.addCategory(updatedItem.category, '#0284c7');
      }
      this.save();
      return true;
    }
    return false;
  }

  deleteItem(id) {
    const prevLen = this.data.items.length;
    this.data.items = this.data.items.filter(i => i.id !== id);
    if (this.data.items.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Category Management & Colors ---
  getCategories() {
    if (!this.data.categories || typeof this.data.categories !== 'object') {
      this.data.categories = { ...DEFAULT_CATEGORIES };
    }
    (this.data.items || []).forEach(item => {
      if (item.category && !this.data.categories[item.category]) {
        this.data.categories[item.category] = '#64748b';
      }
    });
    return this.data.categories;
  }

  saveCategories(categories) {
    this.data.categories = { ...categories };
    this.save();
  }

  setCategoryColor(name, color) {
    const cats = this.getCategories();
    cats[name] = color;
    this.saveCategories(cats);
  }

  renameCategory(oldName, newName, color) {
    const cats = this.getCategories();
    const finalColor = color || cats[oldName] || '#0284c7';
    delete cats[oldName];
    cats[newName] = finalColor;
    this.saveCategories(cats);

    let count = 0;
    (this.data.items || []).forEach(item => {
      if (item.category === oldName) {
        item.category = newName;
        count++;
      }
    });
    if (count > 0) {
      this.save();
    }
    return count;
  }

  addCategory(name, color = '#0284c7') {
    const cats = this.getCategories();
    cats[name] = color;
    this.saveCategories(cats);
  }

  deleteCategory(name, fallback = 'Reference') {
    const cats = this.getCategories();
    delete cats[name];
    if (!cats[fallback]) {
      cats[fallback] = '#64748b';
    }
    this.saveCategories(cats);

    (this.data.items || []).forEach(item => {
      if (item.category === name) {
        item.category = fallback;
      }
    });
    this.save();
  }

  resetCategoriesToDefault() {
    this.data.categories = { ...DEFAULT_CATEGORIES };
    this.save();
    return this.data.categories;
  }

  // --- Column Width Preferences ---
  getColumnWidths() {
    try {
      const stored = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(stored) };
      }
    } catch (e) {}
    return { ...DEFAULT_COLUMN_WIDTHS };
  }

  saveColumnWidths(widths) {
    try {
      localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {}
  }

  resetColumnWidths() {
    try {
      localStorage.removeItem(COL_WIDTHS_STORAGE_KEY);
    } catch (e) {}
    return { ...DEFAULT_COLUMN_WIDTHS };
  }

  // --- Blockout / Lockout Periods CRUD ---
  getBlockouts() {
    if (!this.data.blockouts || !Array.isArray(this.data.blockouts)) {
      this.data.blockouts = JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS));
    }
    return this.data.blockouts;
  }

  saveBlockouts(blockouts) {
    this.data.blockouts = Array.isArray(blockouts) ? blockouts : [];
    this.save();
    return this.data.blockouts;
  }

  addBlockout(blockout) {
    if (!this.data.blockouts) this.data.blockouts = [];
    if (!blockout.id) {
      blockout.id = 'bo-' + Date.now();
    }
    this.data.blockouts.push(blockout);
    this.save();
    return blockout;
  }

  updateBlockout(id, updated) {
    if (!this.data.blockouts) return null;
    const idx = this.data.blockouts.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.data.blockouts[idx] = { ...this.data.blockouts[idx], ...updated, id };
      this.save();
      return this.data.blockouts[idx];
    }
    return null;
  }

  deleteBlockout(id) {
    if (!this.data.blockouts) return;
    this.data.blockouts = this.data.blockouts.filter(b => b.id !== id);
    this.save();
  }

  isBlockoutsVisible() {
    try {
      const val = localStorage.getItem(BLOCKOUTS_VISIBILITY_KEY);
      return val === null ? true : val === 'true';
    } catch (_) {
      return true;
    }
  }

  setBlockoutsVisible(visible) {
    try {
      localStorage.setItem(BLOCKOUTS_VISIBILITY_KEY, String(visible));
    } catch (_) {}
  }

  // --- JSON Backup & Restore ---
  exportJSON() {
    const payload = {
      version: '2.1',
      exportDate: new Date().toISOString(),
      items: this.getItems(),
      categories: this.getCategories(),
      blockouts: this.getBlockouts()
    };
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scouts_QLD_YPT_Roadmap_Master_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      let items = [];
      if (parsed.items && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else if (parsed.roadmap && Array.isArray(parsed.roadmap)) {
        items = [...parsed.roadmap, ...(parsed.planner || [])];
      } else {
        return { success: false, error: 'Unrecognized JSON schema: missing items array' };
      }

      const categories = (parsed.categories && typeof parsed.categories === 'object')
        ? parsed.categories
        : { ...DEFAULT_CATEGORIES };

      const blockouts = (parsed.blockouts && Array.isArray(parsed.blockouts))
        ? parsed.blockouts
        : JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS));

      this.data = { items, categories, blockouts };
      this.save();
      return { success: true, count: items.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // --- CSV Export & Import ---
  exportCSV() {
    const items = this.getItems();
    const headers = ['ID', 'Title', 'StartDate', 'EndDate', 'Months', 'Owner', 'Category', 'Tags'];
    const rows = [headers.join(',')];

    items.forEach(item => {
      const row = [
        item.id || '',
        `"${(item.title || '').replace(/"/g, '""')}"`,
        item.startDate || '',
        item.endDate || '',
        item.months || 1,
        `"${(item.owner || '').replace(/"/g, '""')}"`,
        `"${(item.category || '').replace(/"/g, '""')}"`,
        `"${(item.tags || '').replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scouts_QLD_YPT_Roadmap_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importCSV(csvText, replaceAll = false) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, error: 'CSV file is empty or missing data rows.' };
      }

      const parseCSVLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headerRow = parseCSVLine(lines[0]);
      const headerMap = {};
      headerRow.forEach((h, idx) => {
        const norm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        headerMap[norm] = idx;
      });

      const titleIdx = headerMap['title'] ?? headerMap['action'] ?? headerMap['project'] ?? 1;
      const startIdx = headerMap['startdate'] ?? headerMap['start'] ?? 2;
      const endIdx = headerMap['enddate'] ?? headerMap['end'] ?? -1;
      const monthsIdx = headerMap['months'] ?? headerMap['duration'] ?? -1;
      const ownerIdx = headerMap['owner'] ?? headerMap['lead'] ?? -1;
      const catIdx = headerMap['category'] ?? headerMap['type'] ?? -1;
      const tagsIdx = headerMap['tags'] ?? headerMap['tag'] ?? -1;

      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const title = (cols[titleIdx] || '').trim();
        const startDate = (cols[startIdx] || '').trim();
        if (!title || !startDate) continue;

        let endDate = (endIdx !== -1 && cols[endIdx]) ? cols[endIdx].trim() : startDate;
        let months = (monthsIdx !== -1 && parseInt(cols[monthsIdx], 10)) ? parseInt(cols[monthsIdx], 10) : 1;
        let owner = (ownerIdx !== -1 && cols[ownerIdx]) ? cols[ownerIdx].trim() : '';
        let category = (catIdx !== -1 && cols[catIdx]) ? cols[catIdx].trim() : 'Event';
        let tags = (tagsIdx !== -1 && cols[tagsIdx]) ? cols[tagsIdx].trim() : '';

        imported.push({
          id: 'RM-' + Date.now() + '-' + i,
          title,
          startDate,
          endDate,
          months,
          owner,
          category,
          tags
        });
      }

      if (imported.length === 0) {
        return { success: false, error: 'No valid event rows found in CSV file.' };
      }

      if (replaceAll) {
        this.data.items = imported;
      } else {
        this.data.items = [...this.data.items, ...imported];
      }

      this.save();
      return { success: true, count: imported.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  resetToDefaults() {
    if (this.config.canEdit) {
      fetch(this.config.restUrl + 'reset', {
        method: 'POST',
        headers: { 'X-WP-Nonce': this.config.nonce }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          this.data = data.data;
          this.lastSavedTimestamp = data.data.lastSaved;
          if (window.app) window.app.render();
          this.showToast('Reset database to default master entries!');
        }
      })
      .catch(e => console.error('Reset error:', e));
    }
  }
}

// Global instance
window.storageManager = new StorageManager();
document.addEventListener('DOMContentLoaded', () => {
  window.storageManager.init();
});
