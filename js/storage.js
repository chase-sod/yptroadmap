/**
 * storage.js
 * Unified Storage Manager for Scouts Queensland Youth Program Team Roadmap
 * Stores a single, consolidated master dataset of all roadmap & calendar items,
 * custom categories with assigned colors, and column width preferences.
 */

const STORAGE_KEY = 'scouts_ypt_unified_roadmap_v2';
const LEGACY_STORAGE_KEY = 'scouts_ypt_planner_v1';
const COL_WIDTHS_STORAGE_KEY = 'scouts_ypt_col_widths_v1';

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

window.DEFAULT_BLOCKOUTS = DEFAULT_BLOCKOUTS;

const BLOCKOUTS_VISIBILITY_KEY = 'scouts_ypt_blockouts_visible_v1';

class StorageManager {
  constructor() {
    this.data = this.initData();
  }

  initData() {
    try {
      // 1. Check current unified storage key
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.items && Array.isArray(parsed.items)) {
          if (!parsed.categories || typeof parsed.categories !== 'object') {
            parsed.categories = { ...DEFAULT_CATEGORIES };
          } else {
            // Auto-migrate legacy dark red colors to bright brand guidelines palette
            let changed = false;
            if (parsed.categories['Youth Program Event'] === '#681d34') {
              parsed.categories['Youth Program Event'] = '#0284c7';
              changed = true;
            }
            if (parsed.categories['Branch Calendar Event'] === '#8d1f2c') {
              parsed.categories['Branch Calendar Event'] = '#a43c51';
              changed = true;
            }
            if (parsed.categories['School Term'] === '#571e21') {
              parsed.categories['School Term'] = '#28265c';
              changed = true;
            }
            if (changed) {
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
              } catch (e) {}
            }
          }
          if (!parsed.blockouts || !Array.isArray(parsed.blockouts)) {
            parsed.blockouts = JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS));
          }
          return parsed;
        }
      }

      // 2. Check legacy storage key and auto-migrate if present
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        const legacyItems = [
          ...(parsedLegacy.roadmap || []),
          ...(parsedLegacy.planner || [])
        ];
        if (legacyItems.length > 0) {
          const migrated = {
            items: legacyItems,
            categories: { ...DEFAULT_CATEGORIES },
            blockouts: JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS))
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using initial dataset:', e);
    }

    // 3. Fall back to bundled initial dataset
    const initial = window.INITIAL_DATA || { items: [] };
    const cleanData = {
      items: Array.isArray(initial.items) ? JSON.parse(JSON.stringify(initial.items)) : [],
      categories: { ...DEFAULT_CATEGORIES },
      blockouts: JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS))
    };
    return cleanData;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
    if (window.fileSyncManager && typeof window.fileSyncManager.onStorageSaved === 'function') {
      window.fileSyncManager.onStorageSaved();
    }
  }

  resetToDefaults() {
    const initial = window.INITIAL_DATA || { items: [] };
    this.data = {
      items: JSON.parse(JSON.stringify(initial.items || [])),
      categories: { ...DEFAULT_CATEGORIES },
      blockouts: JSON.parse(JSON.stringify(DEFAULT_BLOCKOUTS))
    };
    this.save();
    return this.data.items;
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
    
    // Auto-register category if not existing
    if (item.category && !this.getCategories()[item.category]) {
      this.addCategory(item.category, '#681d34');
    }

    this.save();
    return item;
  }

  updateItem(updatedItem) {
    const idx = this.data.items.findIndex(i => i.id === updatedItem.id);
    if (idx !== -1) {
      this.data.items[idx] = updatedItem;
      if (updatedItem.category && !this.getCategories()[updatedItem.category]) {
        this.addCategory(updatedItem.category, '#681d34');
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
    // Scan items to ensure all active categories are in the map
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
    const finalColor = color || cats[oldName] || '#681d34';
    delete cats[oldName];
    cats[newName] = finalColor;
    this.saveCategories(cats);

    // Update all items that had oldName
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

  addCategory(name, color = '#681d34') {
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

    // Reassign items with deleted category
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
    } catch (e) {
      console.warn('Error reading column widths:', e);
    }
    return { ...DEFAULT_COLUMN_WIDTHS };
  }

  saveColumnWidths(widths) {
    try {
      localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } catch (e) {
      console.error('Error saving column widths:', e);
    }
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

  // --- Aliases for compatibility ---
  getRoadmapItems() { return this.getItems(); }
  getPlannerItems() { return this.getItems(); }
  addRoadmapItem(item) { return this.addItem(item); }
  updateRoadmapItem(item) { return this.updateItem(item); }
  deleteRoadmapItem(id) { return this.deleteItem(id); }
  addPlannerItem(item) { return this.addItem(item); }
  updatePlannerItem(item) { return this.updateItem(item); }
  deletePlannerItem(id) { return this.deleteItem(id); }

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
        return { success: false, error: 'Unrecognized JSON schema: missing items or roadmap array' };
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
    const items = this.data.items || [];
    const headers = ['ID', 'Title', 'StartDate', 'EndDate', 'Months', 'Owner', 'Category', 'Tags', 'Section', 'Notes'];
    const rows = items.map(item => {
      const sectionVal = Array.isArray(item.section)
        ? item.section.join(', ')
        : (item.section || item.sections || '');
      const notesVal = item.notes || item.note || '';
      return [
        item.id || '',
        `"${(item.title || '').replace(/"/g, '""')}"`,
        item.startDate || '',
        item.endDate || '',
        item.months || 1,
        `"${(item.owner || '').replace(/"/g, '""')}"`,
        `"${(item.category || '').replace(/"/g, '""')}"`,
        `"${(item.tags || '').replace(/"/g, '""')}"`,
        `"${sectionVal.replace(/"/g, '""')}"`,
        `"${notesVal.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scouts_QLD_YPT_Roadmap_Master_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportRoadmapCSV() { return this.exportCSV(); }

  importCSV(csvText, replaceAll = false) {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        return { success: false, error: 'CSV file is empty or missing headers' };
      }

      const parseCSVLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === '“' || char === '”') {
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

      const headerLine = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_-]/g, ''));
      const titleIdx = headerLine.findIndex(h => h.includes('title') || h.includes('project') || h.includes('action') || h.includes('name'));
      const startIdx = headerLine.findIndex(h => h.includes('start'));
      const endIdx = headerLine.findIndex(h => h.includes('end') || h.includes('due'));
      const catIdx = headerLine.findIndex(h => h.includes('cat'));
      const tagIdx = headerLine.findIndex(h => h.includes('tag'));
      const ownerIdx = headerLine.findIndex(h => h.includes('owner') || h.includes('lead') || h.includes('assign'));
      const monthsIdx = headerLine.findIndex(h => h.includes('month') || h.includes('duration'));
      const sectionIdx = headerLine.findIndex(h => h.includes('section'));
      const notesIdx = headerLine.findIndex(h => h.includes('note') || h.includes('desc') || h.includes('detail') || h.includes('comment'));

      if (titleIdx === -1 || startIdx === -1) {
        return { success: false, error: 'CSV must contain at least "Title" and "StartDate" columns' };
      }

      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[titleIdx]) continue;
        const startVal = cols[startIdx] || '';
        const endVal = endIdx !== -1 && cols[endIdx] ? cols[endIdx] : startVal;
        const catVal = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'Branch Calendar Event';
        const sectionRaw = sectionIdx !== -1 && cols[sectionIdx] ? cols[sectionIdx] : '';
        const sectionArr = sectionRaw ? sectionRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const notesVal = notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : '';

        imported.push({
          id: 'RM-' + (Date.now() + i),
          title: cols[titleIdx],
          startDate: startVal,
          endDate: endVal,
          months: monthsIdx !== -1 && parseInt(cols[monthsIdx]) ? parseInt(cols[monthsIdx]) : 1,
          owner: ownerIdx !== -1 && cols[ownerIdx] ? cols[ownerIdx] : '',
          category: catVal,
          tags: tagIdx !== -1 && cols[tagIdx] ? cols[tagIdx] : '',
          section: sectionArr,
          notes: notesVal
        });

        // Ensure category registered
        if (!this.getCategories()[catVal]) {
          this.addCategory(catVal, '#681d34');
        }
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

  importRoadmapCSV(csvText, replaceAll) { return this.importCSV(csvText, replaceAll); }
}

window.storageManager = new StorageManager();
