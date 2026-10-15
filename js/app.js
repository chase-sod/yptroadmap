/**
 * app.js
 * Scouts Queensland Youth Program Team Interactive Roadmap & Planner
 * Dual View Controller, Dynamic Category & Colour Management, Resizable Columns
 */

document.addEventListener('DOMContentLoaded', () => {
  const SCOUTS_BRAND_SWATCHES = [
    { name: 'Scouts QLD Maroon', hex: '#681d34' },
    { name: 'Scouts Australia Navy', hex: '#28265c' },
    { name: 'Scouts Ruby', hex: '#8d1f2c' },
    { name: 'Scouts Burgundy', hex: '#571e21' },
    { name: 'Scouts Salmon', hex: '#ea6952' },
    { name: 'Scouts Teal', hex: '#008f88' },
    { name: 'Scouts Green', hex: '#0cae4b' },
    { name: 'Cubs Yellow', hex: '#ffc62e' },
    { name: 'Rovers Red', hex: '#de2a26' },
    { name: 'Venturers Red', hex: '#a22237' },
    { name: 'Joeys Brown', hex: '#ba6228' },
    { name: 'Sky Blue', hex: '#0284c7' },
    { name: 'Indigo', hex: '#4f46e5' },
    { name: 'Amber Gold', hex: '#d97706' },
    { name: 'Slate Grey', hex: '#64748b' }
  ];

  const app = {
    currentView: (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view')) ||
      ((typeof window !== 'undefined' && window.innerWidth <= 768) ? 'agenda' : 'monthly'),
    yearFilter: 'all',      // 'all' | '2026' | '2027' | '2028'
    pastFilter: 'all',     // 'all' | 'hide' | 'only'
    selectedCategories: null, // Set of active categories
    blockoutsVisible: true,   // Show/hide lockout period highlights
    searchQuery: '',
    sortBy: 'startDate',    // 'startDate' | 'title' | 'category'
    sortAsc: true,
    editingItemId: null,
    previousMonthlyYear: null,
    _lastIsMobile: false,

    // Temporary working state for Category Management Modal
    tempCategories: {},

    isMobile() {
      return typeof window !== 'undefined' && window.innerWidth <= 768;
    },

    init() {
      this._lastIsMobile = this.isMobile();

      // Initialize blockouts visibility from storage preference
      if (typeof window !== 'undefined' && window.storageManager) {
        this.blockoutsVisible = window.storageManager.isBlockoutsVisible();
      }

      // Check URL parameters for shareable deep-linking
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCats = urlParams.get('categories');
        if (urlCats) {
          const catList = urlCats.split(',').map(s => decodeURIComponent(s.trim()));
          this.selectedCategories = new Set(catList);
        }
        const urlPast = urlParams.get('past') || urlParams.get('pastFilter');
        if (urlPast && ['all', 'hide', 'only'].includes(urlPast)) {
          this.pastFilter = urlPast;
        }
        const urlYear = urlParams.get('year');
        if (urlYear && ['2026', '2027', '2028', 'all'].includes(urlYear)) {
          this.yearFilter = urlYear;
        }
        const urlView = urlParams.get('view');
        if (urlView && ['monthly', 'weekly', 'agenda'].includes(urlView)) {
          this.currentView = urlView;
        }
        const urlLockouts = urlParams.get('lockouts');
        if (urlLockouts === 'hide' || urlLockouts === 'false') {
          this.blockoutsVisible = false;
        } else if (urlLockouts === 'show' || urlLockouts === 'true') {
          this.blockoutsVisible = true;
        }
        const urlScroll = urlParams.get('scroll');
        if (urlScroll) {
          setTimeout(() => {
            const container = document.getElementById('tableContainer');
            if (container) container.scrollLeft = parseInt(urlScroll, 10);
          }, 80);
        }
      }

      this.ensureSelectedCategories();
      this.applySavedColumnWidths();
      this.bindEvents();
      this.populateCategoryFilters();
      this.renderLegendBar();
      this.updateBlockoutControls();
      this.setView(this.currentView);

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openMenu') === 'category') {
          const catMenu = document.getElementById('categoryDropdownMenu');
          const catBtn = document.getElementById('categoryDropdownBtn');
          if (catMenu && catBtn) {
            catMenu.removeAttribute('hidden');
            catBtn.setAttribute('aria-expanded', 'true');
            catBtn.classList.add('menu-open');
          }
        }
        if (urlParams.get('openModal') === 'blockouts') {
          setTimeout(() => {
            this.openBlockoutsModal();
            if (urlParams.get('openForm') === 'add') {
              this.openBlockoutForm(null);
            }
          }, 120);
        }
      }
    },

    bindEvents() {
      // View Switcher (Monthly View vs Weekly View)
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const view = e.currentTarget.dataset.view;
          this.setView(view);
        });
      });

      // Year Filter
      const yearSelect = document.getElementById('yearFilter');
      if (yearSelect) {
        yearSelect.value = this.yearFilter;
        yearSelect.addEventListener('change', (e) => {
          this.yearFilter = e.target.value;
          this.previousMonthlyYear = null;
          this.render();
        });
      }

      // Category Multi-Select Dropdown Controls
      const catBtn = document.getElementById('categoryDropdownBtn');
      const catMenu = document.getElementById('categoryDropdownMenu');
      if (catBtn && catMenu) {
        catBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = catMenu.hasAttribute('hidden');
          if (isHidden) {
            catMenu.removeAttribute('hidden');
            catBtn.setAttribute('aria-expanded', 'true');
            catBtn.classList.add('menu-open');
          } else {
            catMenu.setAttribute('hidden', '');
            catBtn.setAttribute('aria-expanded', 'false');
            catBtn.classList.remove('menu-open');
          }
        });

        // Don't close when clicking inside the dropdown menu
        catMenu.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        // Close on outside click
        document.addEventListener('click', () => {
          if (!catMenu.hasAttribute('hidden')) {
            catMenu.setAttribute('hidden', '');
            catBtn.setAttribute('aria-expanded', 'false');
            catBtn.classList.remove('menu-open');
          }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !catMenu.hasAttribute('hidden')) {
            catMenu.setAttribute('hidden', '');
            catBtn.setAttribute('aria-expanded', 'false');
            catBtn.classList.remove('menu-open');
            catBtn.focus();
          }
        });
      }

      // Quick Actions: Select All / Clear All
      const selectAllBtn = document.getElementById('catSelectAllBtn');
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          this.selectAllCategories();
        });
      }

      const clearAllBtn = document.getElementById('catClearAllBtn');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
          this.clearAllCategories();
        });
      }

      // Search Query
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.render();
        });
      }

      // Past Entries Filter
      const pastSelect = document.getElementById('pastFilter');
      if (pastSelect) {
        pastSelect.value = this.pastFilter;
        pastSelect.addEventListener('change', (e) => {
          this.pastFilter = e.target.value;
          this.render();
          this.updateCategoryUI();
        });
      }

      // Sort Select
      const sortSelect = document.getElementById('sortSelect');
      if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
          this.sortBy = e.target.value;
          this.render();
        });
      }

      // Action Buttons
      document.getElementById('addEntryBtn')?.addEventListener('click', () => this.openAddModal());
      document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => this.openCategoryModal());
      document.getElementById('exportPdfBtn')?.addEventListener('click', () => this.handleExportPdf());
      document.getElementById('exportCsvBtn')?.addEventListener('click', () => window.storageManager.exportCSV());
      document.getElementById('exportJsonBtn')?.addEventListener('click', () => window.storageManager.exportJSON());
      document.getElementById('importCsvBtn')?.addEventListener('click', () => this.openCsvModal());
      document.getElementById('resetDataBtn')?.addEventListener('click', () => this.handleResetData());

      // Mobile More Actions Dropdown Menu
      const moreBtn = document.getElementById('mobileMoreBtn');
      const moreMenu = document.getElementById('mobileMoreMenu');
      if (moreBtn && moreMenu) {
        moreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = moreMenu.hasAttribute('hidden');
          if (isHidden) {
            moreMenu.removeAttribute('hidden');
            moreBtn.setAttribute('aria-expanded', 'true');
          } else {
            moreMenu.setAttribute('hidden', '');
            moreBtn.setAttribute('aria-expanded', 'false');
          }
        });

        // Close when clicking outside
        document.addEventListener('click', () => {
          if (!moreMenu.hasAttribute('hidden')) {
            moreMenu.setAttribute('hidden', '');
            moreBtn.setAttribute('aria-expanded', 'false');
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !moreMenu.hasAttribute('hidden')) {
            moreMenu.setAttribute('hidden', '');
            moreBtn.setAttribute('aria-expanded', 'false');
            moreBtn.focus();
          }
        });

        // Delegate mobile more clicks to existing actions
        document.getElementById('mFileSyncBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('fileSyncBtn')?.click();
        });
        document.getElementById('mExportPdfBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('exportPdfBtn')?.click();
        });
        document.getElementById('mExportCsvBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('exportCsvBtn')?.click();
        });
        document.getElementById('mImportCsvBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('importCsvBtn')?.click();
        });
        document.getElementById('mImportJsonBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('importJsonBtn')?.click();
        });
        document.getElementById('mExportJsonBtn')?.addEventListener('click', () => {
          moreMenu.setAttribute('hidden', '');
          document.getElementById('exportJsonBtn')?.click();
        });
      }

      // Mobile Filters Drawer Toggle
      const filterToggleBtn = document.getElementById('mobileFilterToggleBtn');
      const toolbarFilters = document.getElementById('toolbarFilters');
      const closeMobileFiltersBtn = document.getElementById('closeMobileFiltersBtn');
      if (filterToggleBtn && toolbarFilters) {
        filterToggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = toolbarFilters.classList.toggle('open');
          filterToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          filterToggleBtn.classList.toggle('active', isOpen);
        });

        closeMobileFiltersBtn?.addEventListener('click', () => {
          toolbarFilters.classList.remove('open');
          filterToggleBtn.setAttribute('aria-expanded', 'false');
          filterToggleBtn.classList.remove('active');
        });
      }

      // Responsive Resize Listener to adapt table without unnecessary overhead
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const isMob = this.isMobile();
          if (this._lastIsMobile !== isMob) {
            this._lastIsMobile = isMob;
            this.render();
          }
        }, 150);
      });

      // Modal Dialog Events
      this.bindModalEvents();
      this.bindCategoryModalEvents();
      this.bindBlockoutModalEvents();
    },

    bindModalEvents() {
      const entryDialog = document.getElementById('entryDialog');
      const closeEntryBtn = document.getElementById('closeEntryDialogBtn');
      const cancelEntryBtn = document.getElementById('cancelEntryBtn');
      const entryForm = document.getElementById('entryForm');

      closeEntryBtn?.addEventListener('click', () => entryDialog.close());
      cancelEntryBtn?.addEventListener('click', () => entryDialog.close());

      entryForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveEntryForm();
      });

      // Duration Auto-Calculation Listeners
      const startInput = document.getElementById('entryStartDate');
      const endInput = document.getElementById('entryEndDate');
      startInput?.addEventListener('input', () => this.updateModalDuration());
      startInput?.addEventListener('change', () => this.updateModalDuration());
      endInput?.addEventListener('input', () => this.updateModalDuration());
      endInput?.addEventListener('change', () => this.updateModalDuration());

      // Section Multi-Select Listeners
      const selectAllSectionsBtn = document.getElementById('selectAllSectionsBtn');
      const clearAllSectionsBtn = document.getElementById('clearAllSectionsBtn');

      selectAllSectionsBtn?.addEventListener('click', () => {
        document.querySelectorAll('input[name="entrySection"]').forEach(cb => {
          cb.checked = true;
          cb.closest('.section-chip')?.classList.add('is-checked');
        });
      });

      clearAllSectionsBtn?.addEventListener('click', () => {
        document.querySelectorAll('input[name="entrySection"]').forEach(cb => {
          cb.checked = false;
          cb.closest('.section-chip')?.classList.remove('is-checked');
        });
      });

      document.querySelectorAll('input[name="entrySection"]').forEach(cb => {
        cb.addEventListener('change', () => {
          cb.closest('.section-chip')?.classList.toggle('is-checked', cb.checked);
        });
      });

      // CSV Import Dialog
      const csvDialog = document.getElementById('csvDialog');
      const closeCsvBtn = document.getElementById('closeCsvDialogBtn');
      const cancelCsvBtn = document.getElementById('cancelCsvBtn');
      const csvForm = document.getElementById('csvForm');

      closeCsvBtn?.addEventListener('click', () => csvDialog.close());
      cancelCsvBtn?.addEventListener('click', () => csvDialog.close());

      csvForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.processCsvUpload();
      });
    },

    bindCategoryModalEvents() {
      const catDialog = document.getElementById('categoryDialog');
      const closeCatBtn = document.getElementById('closeCatDialogBtn');
      const cancelCatBtn = document.getElementById('cancelCatBtn');
      const saveCatBtn = document.getElementById('saveCatBtn');
      const resetCatBtn = document.getElementById('resetCategoriesBtn');
      const addCatBtn = document.getElementById('addNewCategoryBtn');

      closeCatBtn?.addEventListener('click', () => catDialog.close());
      cancelCatBtn?.addEventListener('click', () => catDialog.close());

      addCatBtn?.addEventListener('click', () => {
        const nameInput = document.getElementById('newCategoryName');
        const colorInput = document.getElementById('newCategoryColor');
        const name = nameInput.value.trim();
        const color = colorInput.value;
        if (!name) {
          alert('Please enter a category name.');
          return;
        }
        this.tempCategories[name] = color;
        nameInput.value = '';
        this.renderCategoryModalList();
      });

      resetCatBtn?.addEventListener('click', () => {
        if (confirm('Reset all categories and colours back to brand defaults?')) {
          this.tempCategories = { ...window.storageManager.resetCategoriesToDefault() };
          this.renderCategoryModalList();
        }
      });

      saveCatBtn?.addEventListener('click', () => {
        this.saveCategoryModalChanges();
      });
    },

    setView(view) {
      this.currentView = view;
      document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });

      // In Weekly view, if yearFilter is 'all', default to 2027 (weekly planner represents a single year)
      const yearSelect = document.getElementById('yearFilter');
      if (view === 'weekly' && this.yearFilter === 'all') {
        this.yearFilter = '2027';
        this.previousMonthlyYear = 'all';
        if (yearSelect) yearSelect.value = '2027';
      } else if ((view === 'monthly' || view === 'agenda') && this.previousMonthlyYear === 'all' && this.yearFilter === '2027') {
        this.yearFilter = 'all';
        this.previousMonthlyYear = null;
        if (yearSelect) yearSelect.value = 'all';
      }

      this.populateCategoryFilters();
      this.render();
    },

    // --- Dynamic Category & Color Helpers ---
    getCategoryColor(category) {
      const cats = window.storageManager.getCategories();
      return cats[category] || '#64748b';
    },

    getContrastColor(hexColor) {
      if (!hexColor || hexColor.length < 6) return '#ffffff';
      let hex = hexColor.replace('#', '');
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 150 ? '#1e293b' : '#ffffff';
    },

    hexToRgba(hexColor, alpha = 0.1) {
      if (!hexColor) return `rgba(239, 68, 68, ${alpha})`;
      let hex = hexColor.replace('#', '');
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      const r = parseInt(hex.substring(0, 2), 16) || 239;
      const g = parseInt(hex.substring(2, 4), 16) || 68;
      const b = parseInt(hex.substring(4, 6), 16) || 68;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    getActiveBlockoutsForPeriod(startDate, endDate) {
      if (!this.blockoutsVisible || !startDate || !endDate) return [];
      const blockouts = window.storageManager.getBlockouts();
      return blockouts.filter(bo => {
        if (!bo.startDate || !bo.endDate) return false;
        return !(bo.endDate < startDate || bo.startDate > endDate);
      });
    },

    ensureSelectedCategories() {
      const allCats = Object.keys(window.storageManager.getCategories());
      if (!this.selectedCategories) {
        this.selectedCategories = new Set(allCats);
      } else {
        const valid = new Set();
        this.selectedCategories.forEach(c => {
          if (allCats.includes(c)) valid.add(c);
        });
        this.selectedCategories = valid;
      }
    },

    selectAllCategories() {
      const allCats = Object.keys(window.storageManager.getCategories());
      this.selectedCategories = new Set(allCats);
      this.updateCategoryUI();
      this.render();
    },

    clearAllCategories() {
      this.selectedCategories = new Set();
      this.updateCategoryUI();
      this.render();
    },

    toggleCategory(catName) {
      this.ensureSelectedCategories();
      if (this.selectedCategories.has(catName)) {
        this.selectedCategories.delete(catName);
      } else {
        this.selectedCategories.add(catName);
      }
      this.updateCategoryUI();
      this.render();
    },

    isolateCategory(catName) {
      this.selectedCategories = new Set([catName]);
      this.updateCategoryUI();
      this.render();
    },

    updateCategoryUI() {
      this.populateCategoryFilters();
      this.renderLegendBar();
      this.updateFilterBadge();
    },

    getTodayIsoString() {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    isItemInPast(item, todayStr) {
      if (!todayStr) todayStr = this.getTodayIsoString();
      const effectiveEnd = item.endDate || item.startDate;
      if (!effectiveEnd) return false;
      return effectiveEnd < todayStr;
    },

    getActiveYearItemsForCounts() {
      const activeYear = this.currentView === 'weekly' && this.yearFilter === 'all' ? '2027' : this.yearFilter;
      let items = window.storageManager.getItems();
      if (activeYear !== 'all') {
        items = items.filter(i => {
          const sy = i.startDate ? i.startDate.substring(0, 4) : '';
          const ey = i.endDate ? i.endDate.substring(0, 4) : sy;
          return (sy <= activeYear && ey >= activeYear);
        });
      }
      const todayStr = this.getTodayIsoString();
      if (this.pastFilter === 'hide') {
        items = items.filter(i => !this.isItemInPast(i, todayStr));
      } else if (this.pastFilter === 'only') {
        items = items.filter(i => this.isItemInPast(i, todayStr));
      }
      return items;
    },

    populateCategoryFilters() {
      this.ensureSelectedCategories();
      const listContainer = document.getElementById('categoryCheckboxList');
      const labelSpan = document.getElementById('categoryDropdownLabel');
      const allCats = window.storageManager.getCategories();
      const catKeys = Object.keys(allCats).sort();
      const yearItems = this.getActiveYearItemsForCounts();

      // Calculate count of items per category matching active year
      const counts = {};
      catKeys.forEach(k => counts[k] = 0);
      yearItems.forEach(item => {
        if (item.category && counts[item.category] !== undefined) {
          counts[item.category]++;
        }
      });

      // Update button label dynamically
      if (labelSpan) {
        const selectedCount = this.selectedCategories.size;
        const totalCount = catKeys.length;
        if (selectedCount === totalCount) {
          labelSpan.textContent = `🏷️ All Categories (${totalCount})`;
        } else if (selectedCount === 0) {
          labelSpan.textContent = `⚠️ None Selected (0)`;
        } else if (selectedCount === 1) {
          const singleName = Array.from(this.selectedCategories)[0];
          labelSpan.textContent = `🏷️ ${singleName}`;
        } else {
          labelSpan.textContent = `🏷️ ${selectedCount} of ${totalCount} Categories`;
        }
      }

      if (!listContainer) return;

      listContainer.innerHTML = '';
      catKeys.forEach((cat, idx) => {
        const color = allCats[cat] || '#64748b';
        const isChecked = this.selectedCategories.has(cat);
        const count = counts[cat] || 0;

        const label = document.createElement('label');
        label.className = 'multi-select-item';
        label.setAttribute('for', `cat-cb-${idx}`);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `cat-cb-${idx}`;
        cb.value = cat;
        cb.checked = isChecked;

        cb.addEventListener('change', () => {
          this.toggleCategory(cat);
        });

        const dot = document.createElement('span');
        dot.className = 'cat-pill-dot';
        dot.style.backgroundColor = color;

        const textSpan = document.createElement('span');
        textSpan.className = 'cat-cb-label';
        textSpan.textContent = cat;

        const countSpan = document.createElement('span');
        countSpan.className = 'cat-cb-count';
        countSpan.textContent = count;

        label.appendChild(cb);
        label.appendChild(dot);
        label.appendChild(textSpan);
        label.appendChild(countSpan);
        listContainer.appendChild(label);
      });
    },

    renderLegendBar() {
      const legendBar = document.getElementById('legendBarContainer');
      if (!legendBar) return;

      this.ensureSelectedCategories();
      const allCats = window.storageManager.getCategories();
      const catKeys = Object.keys(allCats);
      const yearItems = this.getActiveYearItemsForCounts();

      const counts = {};
      catKeys.forEach(k => counts[k] = 0);
      yearItems.forEach(item => {
        if (item.category && counts[item.category] !== undefined) {
          counts[item.category]++;
        }
      });

      const hasInactive = catKeys.some(c => !this.selectedCategories.has(c));

      let chipsHtml = '';
      for (const [name, color] of Object.entries(allCats)) {
        const isActive = this.selectedCategories.has(name);
        const count = counts[name] || 0;
        chipsHtml += `
          <button type="button" 
                  class="legend-chip ${isActive ? 'active' : 'inactive'}" 
                  data-category="${name.replace(/"/g, '&quot;')}" 
                  title="Click to toggle '${name}'. Alt-click to isolate.">
            <span class="legend-dot" style="background-color: ${color};"></span>
            <span class="legend-text">${name}</span>
            <span class="legend-count">(${count})</span>
          </button>
        `;
      }

      legendBar.innerHTML = `
        <div class="legend-bar-left">
          <span class="legend-label">Filter:</span>
          <div class="legend-chips-wrapper">
            ${chipsHtml}
          </div>
        </div>
        ${hasInactive ? `<button type="button" class="legend-show-all-btn" id="legendShowAllBtn" title="Reset all category filters">Reset (Show All)</button>` : ''}
      `;

      // Bind click and Alt-click events on legend chips
      legendBar.querySelectorAll('.legend-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const cat = btn.getAttribute('data-category');
          if (e.altKey || e.metaKey || e.ctrlKey) {
            // Isolate single category on Alt-click or Meta-click
            this.isolateCategory(cat);
          } else {
            this.toggleCategory(cat);
          }
        });
      });

      const showAllBtn = document.getElementById('legendShowAllBtn');
      if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
          this.selectAllCategories();
        });
      }
    },

    // --- Category Management Modal ---
    openCategoryModal() {
      const dialog = document.getElementById('categoryDialog');
      this.tempCategories = JSON.parse(JSON.stringify(window.storageManager.getCategories()));
      this.renderCategoryModalList();
      this.renderBrandSwatches();
      dialog.showModal();
    },

    renderCategoryModalList() {
      const container = document.getElementById('categoryListContainer');
      if (!container) return;

      const items = window.storageManager.getItems();
      // Count items per category
      const counts = {};
      items.forEach(i => {
        if (i.category) counts[i.category] = (counts[i.category] || 0) + 1;
      });

      let html = '';
      const catNames = Object.keys(this.tempCategories).sort();

      catNames.forEach((name, idx) => {
        const color = this.tempCategories[name];
        const count = counts[name] || 0;
        const textColor = this.getContrastColor(color);

        html += `
        <div class="category-item-row" data-cat-idx="${idx}">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
            <input type="color" class="cat-color-input" data-cat-name="${name}" value="${color}" title="Click to change color">
            <input type="text" class="cat-name-input" data-original-name="${name}" value="${name}" style="padding: 0.4rem 0.6rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); font-family: inherit; font-size: 0.85rem; flex: 1;">
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="badge" style="background-color: ${color}; color: ${textColor}; min-width: 60px; text-align: center;">${count} items</span>
            <button type="button" class="action-icon-btn delete-cat-btn" data-cat-name="${name}" title="Delete Category" style="color: var(--scouts-qld-ruby); padding: 4px 8px;">🗑️</button>
          </div>
        </div>`;
      });

      container.innerHTML = html;

      // Bind color changes in modal
      container.querySelectorAll('.cat-color-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const catName = e.target.dataset.catName;
          this.tempCategories[catName] = e.target.value;
          // Update preview badge
          const row = e.target.closest('.category-item-row');
          const badge = row.querySelector('.badge');
          if (badge) {
            badge.style.backgroundColor = e.target.value;
            badge.style.color = this.getContrastColor(e.target.value);
          }
        });
      });

      // Bind delete category button
      container.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const catName = e.currentTarget.dataset.catName;
          if (confirm(`Delete category "${catName}"? Existing items will be moved to "Reference".`)) {
            delete this.tempCategories[catName];
            this.renderCategoryModalList();
          }
        });
      });
    },

    renderBrandSwatches() {
      const container = document.getElementById('brandSwatchesContainer');
      if (!container) return;

      let html = '';
      SCOUTS_BRAND_SWATCHES.forEach(s => {
        html += `<button type="button" class="brand-swatch-btn" data-hex="${s.hex}" title="${s.name} (${s.hex})" style="background-color: ${s.hex};"></button>`;
      });
      container.innerHTML = html;

      container.querySelectorAll('.brand-swatch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const hex = e.currentTarget.dataset.hex;
          document.getElementById('newCategoryColor').value = hex;
        });
      });
    },

    saveCategoryModalChanges() {
      const container = document.getElementById('categoryListContainer');
      const rows = container.querySelectorAll('.category-item-row');
      const finalCats = {};
      const nextSelected = new Set();

      rows.forEach(row => {
        const nameInput = row.querySelector('.cat-name-input');
        const colorInput = row.querySelector('.cat-color-input');
        const originalName = nameInput.dataset.originalName;
        const newName = nameInput.value.trim() || originalName;
        const color = colorInput.value;

        finalCats[newName] = color;

        // If category was previously selected, keep it selected under new name
        if (this.selectedCategories && this.selectedCategories.has(originalName)) {
          nextSelected.add(newName);
        }

        // If category was renamed, update in storage
        if (originalName !== newName) {
          window.storageManager.renameCategory(originalName, newName, color);
        }
      });

      // Include any newly added categories as selected
      Object.keys(finalCats).forEach(k => {
        if (!this.selectedCategories || this.selectedCategories.size === 0 || !this.selectedCategories.has(k)) {
          nextSelected.add(k);
        }
      });

      // Save updated categories object
      window.storageManager.saveCategories(finalCats);
      this.selectedCategories = nextSelected;

      document.getElementById('categoryDialog').close();
      this.populateCategoryFilters();
      this.renderLegendBar();
      this.render();
    },

    // --- Column Resizing Engine ---
    applySavedColumnWidths() {
      const savedWidths = window.storageManager.getColumnWidths();
      for (const [col, width] of Object.entries(savedWidths)) {
        if (col !== 'category') {
          document.documentElement.style.setProperty(`--col-w-${col}`, `${width}px`);
        }
      }
    },

    initColumnResize() {
      const table = document.querySelector('.timeline-table');
      if (!table) return;

      const savedWidths = window.storageManager.getColumnWidths();

      table.querySelectorAll('.col-resizer').forEach(resizer => {
        const th = resizer.closest('th');
        const colName = th.dataset.col;
        if (!colName) return;

        let startX = 0;
        let startWidth = 0;

        const onPointerMove = (e) => {
          const deltaX = e.clientX - startX;
          const minWidth = colName === 'idx' ? 36 : (colName === 'actions' ? 50 : (colName === 'owner' ? 60 : 80));
          const newWidth = Math.max(minWidth, Math.min(800, startWidth + deltaX));
          
          document.documentElement.style.setProperty(`--col-w-${colName}`, `${newWidth}px`);
          savedWidths[colName] = newWidth;
        };

        const onPointerUp = (e) => {
          try { resizer.releasePointerCapture(e.pointerId); } catch (_) {}
          resizer.classList.remove('is-resizing');
          document.body.classList.remove('is-col-resizing');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.storageManager.saveColumnWidths(savedWidths);
        };

        resizer.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          startX = e.clientX;
          startWidth = th.getBoundingClientRect().width;
          try { resizer.setPointerCapture(e.pointerId); } catch (_) {}
          resizer.classList.add('is-resizing');
          document.body.classList.add('is-col-resizing');
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
        });

        // Double-click resets to default column width
        resizer.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const defaultWidths = { idx: 44, title: 320, dates: 150, owner: 120, actions: 70 };
          const defW = defaultWidths[colName] || 120;
          document.documentElement.style.setProperty(`--col-w-${colName}`, `${defW}px`);
          savedWidths[colName] = defW;
          window.storageManager.saveColumnWidths(savedWidths);
        });
      });
    },

    // --- Date & Time Generators ---
    getMonthsForTimeline() {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let years = [2026, 2027, 2028];

      if (this.yearFilter !== 'all') {
        const yNum = parseInt(this.yearFilter);
        years = [yNum];
      }

      const months = [];
      years.forEach(year => {
        for (let m = 0; m < 12; m++) {
          const mStr = String(m + 1).padStart(2, '0');
          const lastDay = new Date(year, m + 1, 0).getDate();
          months.push({
            year,
            month: m,
            label: monthNames[m],
            key: `${year}-${mStr}`,
            startDate: `${year}-${mStr}-01`,
            endDate: `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`
          });
        }
      });
      return months;
    },

    getWeeksForYear(year) {
      const yNum = parseInt(year) || 2027;
      const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const jan1 = new Date(yNum, 0, 1);
      const day = jan1.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const startMonday = new Date(yNum, 0, 1 + diffToMonday);

      const weeks = [];
      for (let w = 1; w <= 53; w++) {
        const curMonday = new Date(startMonday);
        curMonday.setDate(startMonday.getDate() + (w - 1) * 7);

        if (w === 53 && curMonday.getFullYear() > yNum && curMonday.getDate() > 3) {
          break;
        }

        const curSunday = new Date(curMonday);
        curSunday.setDate(curMonday.getDate() + 6);

        const toIso = d => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        const dayStr = String(curMonday.getDate()).padStart(2, '0');
        const mLabel = mNames[curMonday.getMonth()];

        weeks.push({
          weekNumber: w,
          code: `W${w}`,
          headerDate: `${dayStr} ${mLabel}`,
          startDate: toIso(curMonday),
          endDate: toIso(curSunday)
        });
      }
      return weeks;
    },

    calculateDurationDays(startDate, endDate) {
      if (!startDate) return 0;
      if (!endDate) endDate = startDate;
      const s = new Date(startDate + 'T00:00:00');
      const e = new Date(endDate + 'T00:00:00');
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diff);
    },

    calculateDurationMonths(startDate, endDate) {
      if (!startDate) return 0;
      if (!endDate) endDate = startDate;
      const days = this.calculateDurationDays(startDate, endDate);
      if (days < 28) return 0;
      return Math.max(1, Math.round(days / 30.4375));
    },

    getDurationDetails(startDate, endDate) {
      if (!startDate) return { days: 0, weeks: 0, months: 0, badgeText: '', barLabel: '', modalLabel: '—' };
      if (!endDate) endDate = startDate;
      const days = this.calculateDurationDays(startDate, endDate);
      const months = this.calculateDurationMonths(startDate, endDate);

      let badgeText = '';
      let barLabel = '';
      let modalLabel = '';

      if (days === 1) {
        badgeText = '1 day';
        barLabel = '1d';
        modalLabel = '1 day';
      } else if (days < 7) {
        badgeText = `${days} days`;
        barLabel = `${days}d`;
        modalLabel = `${days} days`;
      } else if (days < 28) {
        if (days % 7 === 0) {
          const w = days / 7;
          badgeText = `${w}w (${days}d)`;
          barLabel = `${w}w`;
          modalLabel = `${w} ${w === 1 ? 'week' : 'weeks'} (${days} days)`;
        } else {
          badgeText = `${days}d`;
          barLabel = `${days}d`;
          modalLabel = `${days} days`;
        }
      } else {
        const m = months || Math.max(1, Math.round(days / 30.4375));
        badgeText = `${m}m (${days}d)`;
        barLabel = `${m}m`;
        modalLabel = `${m} ${m === 1 ? 'month' : 'months'} (${days} days)`;
      }

      return { days, months, badgeText, barLabel, modalLabel };
    },

    formatDateDMY(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return '';
      const cleanStr = dateStr.trim();
      const isoMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
      }
      const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
      }
      return cleanStr;
    },

    updateModalDuration() {
      const startInput = document.getElementById('entryStartDate');
      const endInput = document.getElementById('entryEndDate');
      const monthsInput = document.getElementById('entryMonths');
      if (!startInput || !endInput || !monthsInput) return;

      const sVal = startInput.value;
      let eVal = endInput.value;

      if (sVal && (!eVal || eVal < sVal)) {
        endInput.value = sVal;
        eVal = sVal;
      }

      if (sVal) {
        const duration = this.getDurationDetails(sVal, eVal);
        monthsInput.value = duration.modalLabel;
      } else {
        monthsInput.value = '—';
      }
    },

    // --- Master Data Query & Filtering ---
    getFilteredItems() {
      let items = [...window.storageManager.getItems()];

      // 1. Filter by Multi-Select Category
      this.ensureSelectedCategories();
      if (this.selectedCategories) {
        items = items.filter(i => this.selectedCategories.has(i.category));
      }

      // 2. Filter by Year
      const activeYear = this.currentView === 'weekly' && this.yearFilter === 'all' ? '2027' : this.yearFilter;
      if (activeYear !== 'all') {
        items = items.filter(i => {
          const sy = i.startDate ? i.startDate.substring(0, 4) : '';
          const ey = i.endDate ? i.endDate.substring(0, 4) : sy;
          return (sy <= activeYear && ey >= activeYear);
        });
      }

      // 3. Filter by Past Entries
      const todayStr = this.getTodayIsoString();
      if (this.pastFilter === 'hide') {
        items = items.filter(i => !this.isItemInPast(i, todayStr));
      } else if (this.pastFilter === 'only') {
        items = items.filter(i => this.isItemInPast(i, todayStr));
      }

      // 4. Filter by Search Query
      if (this.searchQuery) {
        items = items.filter(i => {
          const title = (i.title || '').toLowerCase();
          const tags = (i.tags || '').toLowerCase();
          const cat = (i.category || '').toLowerCase();
          const owner = (i.owner || '').toLowerCase();
          const section = (Array.isArray(i.section) ? i.section.join(' ') : (i.section || i.sections || '')).toLowerCase();
          const notes = (i.notes || i.note || '').toLowerCase();
          return title.includes(this.searchQuery) ||
                 tags.includes(this.searchQuery) ||
                 cat.includes(this.searchQuery) ||
                 owner.includes(this.searchQuery) ||
                 section.includes(this.searchQuery) ||
                 notes.includes(this.searchQuery);
        });
      }

      // 5. Sort
      items.sort((a, b) => {
        let valA = a[this.sortBy] || '';
        let valB = b[this.sortBy] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return this.sortAsc ? -1 : 1;
        if (valA > valB) return this.sortAsc ? 1 : -1;
        return 0;
      });

      return items;
    },

    render() {
      const container = document.getElementById('tableContainer');
      const statsBadge = document.getElementById('statsBadge');
      const printDocTitle = document.getElementById('printDocTitle');
      const items = this.getFilteredItems();

      const activeYearLabel = this.yearFilter === 'all' && (this.currentView === 'monthly' || this.currentView === 'agenda') ? '2026–2028' : (this.yearFilter === 'all' ? '2027' : this.yearFilter);
      let filterSuffix = '';
      if (this.pastFilter === 'hide') {
        filterSuffix = ' • Active/Upcoming';
      } else if (this.pastFilter === 'only') {
        filterSuffix = ' • Past Only';
      }

      if (statsBadge) {
        statsBadge.textContent = `${items.length} Items (${activeYearLabel}${filterSuffix})`;
      }

      if (this.currentView === 'monthly') {
        if (printDocTitle) printDocTitle.textContent = `Youth Program Team Roadmap (${activeYearLabel})`;
        container.innerHTML = this.renderMonthlyTable(items);
        this.bindJumpToCurrentPeriod();
      } else if (this.currentView === 'weekly') {
        if (printDocTitle) printDocTitle.textContent = `Youth Program Team Weekly Planner (${activeYearLabel})`;
        container.innerHTML = this.renderWeeklyTable(items, activeYearLabel);
        this.bindJumpToCurrentPeriod();
      } else if (this.currentView === 'agenda') {
        if (printDocTitle) printDocTitle.textContent = `Youth Program Team Agenda (${activeYearLabel})`;
        container.innerHTML = this.renderAgendaView(items, activeYearLabel);
      }

      this.bindTableActionButtons();
      if (!this.isMobile() && this.currentView !== 'agenda') {
        this.initColumnResize();
      }
      this.updateFilterBadge();
    },

    updateFilterBadge() {
      const badge = document.getElementById('mobileFilterBadge');
      if (!badge) return;
      let activeCount = 0;
      if (this.yearFilter !== 'all') activeCount++;
      if (this.pastFilter !== 'all') activeCount++;
      if (this.searchQuery) activeCount++;
      const allCatsCount = Object.keys(window.storageManager.getCategories()).length;
      if (this.selectedCategories && this.selectedCategories.size < allCatsCount) activeCount++;

      if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    },

    bindJumpToCurrentPeriod() {
      const jumpBtn = document.getElementById('jumpToCurrentPeriodBtn');
      const container = document.getElementById('tableContainer');
      if (jumpBtn && container) {
        jumpBtn.addEventListener('click', () => {
          const target = container.querySelector('.current-month-col') || container.querySelector('.current-week-col');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else {
            container.scrollTo({ left: 0, behavior: 'smooth' });
          }
        });
      }
    },

    // --- Agenda / Card List View ---
    renderAgendaView(items, activeYearLabel) {
      if (items.length === 0) {
        return `<div class="agenda-empty-state">
          <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-main);">No items found matching the selected filters</div>
          <div style="font-size: 0.85rem; margin-bottom: 0.85rem; color: var(--text-muted);">Try adjusting your search query, year, category, or past entries selections.</div>
          <div style="display: inline-flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline reset-cat-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🏷️ Select All Categories
            </button>
            ${this.pastFilter !== 'all' ? `
            <button type="button" class="btn btn-outline reset-past-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🕒 Show All (Include Past)
            </button>` : ''}
          </div>
        </div>`;
      }

      // Group items chronologically
      const sorted = [...items].sort((a, b) => {
        const da = a.startDate || '9999-99-99';
        const db = b.startDate || '9999-99-99';
        return da.localeCompare(db);
      });

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const groups = {};

      sorted.forEach(item => {
        let groupKey = 'Undated';
        let groupLabel = 'Undated / Ongoing';
        if (item.startDate) {
          const parts = item.startDate.split('-');
          if (parts.length >= 2) {
            const y = parts[0];
            const m = parseInt(parts[1], 10);
            groupKey = `${y}-${String(m).padStart(2, '0')}`;
            groupLabel = `${monthNames[m - 1]} ${y}`;
          }
        }
        if (!groups[groupKey]) {
          groups[groupKey] = { label: groupLabel, key: groupKey, items: [] };
        }
        groups[groupKey].items.push(item);
      });

      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      let html = `<div class="agenda-container">`;

      for (const [key, group] of Object.entries(groups)) {
        const isCurrent = key === currentMonthKey;
        let lockoutBadge = '';
        if (key !== 'Undated') {
          const [gy, gm] = key.split('-');
          const startOfMonth = `${gy}-${gm}-01`;
          const endOfMonth = `${gy}-${gm}-31`;
          const mLockouts = this.getActiveBlockoutsForPeriod(startOfMonth, endOfMonth);
          if (mLockouts.length > 0) {
            lockoutBadge = `<span class="agenda-lockout-pill" title="Lockout: ${mLockouts.map(b => b.title).join('; ')}">🔒 ${mLockouts[0].title}</span>`;
          }
        }

        html += `<section class="agenda-month-section${isCurrent ? ' is-current-month' : ''}">
          <header class="agenda-month-header">
            <div class="agenda-month-title-wrap">
              <h3 class="agenda-month-title">${group.label}</h3>
              ${isCurrent ? '<span class="agenda-current-badge">Current Month</span>' : ''}
            </div>
            <div class="agenda-month-meta">
              ${lockoutBadge}
              <span class="agenda-month-count">${group.items.length} ${group.items.length === 1 ? 'item' : 'items'}</span>
            </div>
          </header>
          <div class="agenda-cards-grid">`;

        group.items.forEach(item => {
          const catColor = this.getCategoryColor(item.category);
          const textColor = this.getContrastColor(catColor);
          const sDate = item.startDate || '';
          const eDate = item.endDate || sDate;
          const duration = this.getDurationDetails(sDate, eDate);
          const sDateFormatted = this.formatDateDMY(sDate);
          const eDateFormatted = this.formatDateDMY(eDate);
          const dateText = sDateFormatted ? (sDateFormatted === eDateFormatted ? sDateFormatted : `${sDateFormatted} → ${eDateFormatted}`) : 'No Date';

          const itemLockouts = (sDate && eDate) ? this.getActiveBlockoutsForPeriod(sDate, eDate) : [];
          const hasItemBo = itemLockouts.length > 0;

          html += `
          <article class="agenda-card" data-id="${item.id}" style="border-left-color: ${catColor};">
            <div class="agenda-card-top">
              <div class="agenda-card-badges">
                <span class="badge cat-badge" style="background-color: ${catColor}; color: ${textColor};">${item.category || 'General'}</span>
                ${item.tags ? `<span class="tag-badge">${item.tags}</span>` : ''}
                ${hasItemBo ? `<span class="badge badge-lockout-warning" title="${itemLockouts.map(b => b.title).join('; ')}">⚠️ Lockout</span>` : ''}
              </div>
              <div class="agenda-card-actions">
                <button type="button" class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit item" aria-label="Edit ${item.title}">✏️</button>
                <button type="button" class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete item" aria-label="Delete ${item.title}">🗑️</button>
              </div>
            </div>
            <h4 class="agenda-card-title">${item.title}</h4>
            <div class="agenda-card-meta">
              <div class="agenda-meta-row">
                <span class="agenda-meta-icon">📅</span>
                <span class="agenda-meta-date">${dateText}</span>
                ${duration.barLabel ? `<span class="agenda-duration-pill">${duration.barLabel}</span>` : ''}
              </div>
              ${item.owner ? `
              <div class="agenda-meta-row">
                <span class="agenda-meta-icon">👤</span>
                <span class="agenda-meta-owner">${item.owner}</span>
              </div>` : ''}
            </div>
          </article>`;
        });

        html += `</div></section>`;
      }

      html += `</div>`;
      return html;
    },

    // --- Monthly Table View ---
    renderMonthlyTable(items) {
      const isMob = this.isMobile();
      const colMetaSpan = isMob ? 1 : 5;
      const activeMonths = this.getMonthsForTimeline();

      const yearSpans = {};
      activeMonths.forEach(m => {
        yearSpans[m.year] = (yearSpans[m.year] || 0) + 1;
      });

      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Build Colgroup for 100% strict column width synchronization
      let colgroup = `<colgroup>`;
      if (isMob) {
        colgroup += `<col style="width: var(--col-w-mobile-title, 170px);">`;
      } else {
        colgroup += `
        <col style="width: var(--col-w-idx);">
        <col style="width: var(--col-w-title);">
        <col style="width: var(--col-w-dates);">
        <col style="width: var(--col-w-owner);">
        <col style="width: var(--col-w-actions);">`;
      }
      activeMonths.forEach(() => {
        colgroup += `<col style="width: var(--timeline-col-w);">`;
      });
      colgroup += `</colgroup>`;

      // Row 1: Group headers
      let headerRow1 = `<tr class="header-row-1">
        <th class="sticky-meta-hdr${isMob ? ' mobile-sticky-meta-hdr' : ''}" colspan="${colMetaSpan}">Roadmap Items</th>`;
      for (const [year, span] of Object.entries(yearSpans)) {
        headerRow1 += `<th class="timeline-year-group-hdr" colspan="${span}">${year}</th>`;
      }
      headerRow1 += '</tr>';

      // Row 2: Column Headers & Months with Resizers
      let headerRow2 = `<tr class="header-row-2">`;
      if (isMob) {
        headerRow2 += `
        <th class="sticky-col-title mobile-table-title-hdr" data-col="title">
          Project / Action
        </th>`;
      } else {
        headerRow2 += `
        <th class="sticky-col-idx" data-col="idx">
          #
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-title" data-col="title">
          Project / Action / Period
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-dates" data-col="dates">
          Dates
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-owner" data-col="owner">
          Owner
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-actions no-print" data-col="actions">
          Actions
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>`;
      }

      activeMonths.forEach(m => {
        const isCurrent = m.key === currentMonthKey ? ' current-month-col' : '';
        const mLockouts = this.getActiveBlockoutsForPeriod(m.startDate, m.endDate);
        const hasBo = mLockouts.length > 0;
        const boHdrClass = hasBo ? ' is-blockout-hdr' : '';
        const boHdrStyle = hasBo ? ` style="--bo-border-color: ${mLockouts[0].color || '#ef4444'};"` : '';
        const boHdrTitle = hasBo ? ` (🔒 Lockout: ${mLockouts.map(b => b.title).join('; ')})` : '';

        headerRow2 += `<th class="timeline-cell timeline-month-hdr${isCurrent}${boHdrClass}"${boHdrStyle} title="${m.label} ${m.year}${boHdrTitle}">${m.label}</th>`;
      });
      headerRow2 += '</tr>';

      // Build Rows
      let rowsHtml = '';
      if (items.length === 0) {
        rowsHtml = `<tr><td colspan="${colMetaSpan + activeMonths.length}" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); font-size: 0.95rem;">
          <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-main);">No items found matching the selected filters</div>
          <div style="font-size: 0.85rem; margin-bottom: 0.85rem;">Try adjusting your search query, year, category, or past entries selections.</div>
          <div style="display: inline-flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline reset-cat-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🏷️ Select All Categories
            </button>
            ${this.pastFilter !== 'all' ? `
            <button type="button" class="btn btn-outline reset-past-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🕒 Show All (Include Past)
            </button>` : ''}
          </div>
        </td></tr>`;
      } else {
        items.forEach((item, idx) => {
          const catColor = this.getCategoryColor(item.category);
          const textColor = this.getContrastColor(catColor);
          const sDate = item.startDate || '';
          const eDate = item.endDate || sDate;
          const duration = this.getDurationDetails(sDate, eDate);
          const sDateFormatted = this.formatDateDMY(sDate);
          const eDateFormatted = this.formatDateDMY(eDate);
          const dateLabel = sDateFormatted ? (sDateFormatted === eDateFormatted ? sDateFormatted : `${sDateFormatted}<br>to ${eDateFormatted}`) : 'No Date';

          let rowCells = '';
          const itemStartYM = sDate ? sDate.substring(0, 7) : '';
          const itemEndYM = eDate ? eDate.substring(0, 7) : itemStartYM;

          activeMonths.forEach((m, mIdx) => {
            const isCurrent = m.key === currentMonthKey ? ' current-month-col' : '';
            const mLockouts = this.getActiveBlockoutsForPeriod(m.startDate, m.endDate);
            const hasBo = mLockouts.length > 0;
            let boClasses = '';
            let boStyle = '';
            let boCellTooltip = '';

            if (hasBo) {
              boClasses = ' is-blockout-cell';
              const prevBo = mIdx > 0 && this.getActiveBlockoutsForPeriod(activeMonths[mIdx - 1].startDate, activeMonths[mIdx - 1].endDate).length > 0;
              const nextBo = mIdx < activeMonths.length - 1 && this.getActiveBlockoutsForPeriod(activeMonths[mIdx + 1].startDate, activeMonths[mIdx + 1].endDate).length > 0;
              if (!prevBo) boClasses += ' is-blockout-start';
              if (!nextBo) boClasses += ' is-blockout-end';

              const boColor = mLockouts[0].color || '#ef4444';
              boStyle = ` style="--bo-cell-tint: ${this.hexToRgba(boColor, 0.09)}; --bo-border-color: ${boColor};"`;
              boCellTooltip = ` title="🔒 Lockout: ${mLockouts.map(b => b.title).join('; ')}"`;
            }

            let activeInMonth = false;
            if (itemStartYM && itemEndYM) {
              activeInMonth = (itemStartYM <= m.key && itemEndYM >= m.key);
            }

            if (activeInMonth) {
              const prevActive = mIdx > 0 && (itemStartYM <= activeMonths[mIdx - 1].key && itemEndYM >= activeMonths[mIdx - 1].key);
              const nextActive = mIdx < activeMonths.length - 1 && (itemStartYM <= activeMonths[mIdx + 1].key && itemEndYM >= activeMonths[mIdx + 1].key);

              let segClass = 'bar-single';
              if (!prevActive && nextActive) {
                segClass = 'bar-start';
              } else if (prevActive && nextActive) {
                segClass = 'bar-mid';
              } else if (prevActive && !nextActive) {
                segClass = 'bar-end';
              }

              // Show duration label on start of bar or single bar; leave mid/end clean
              let barLabel = '';
              if (!prevActive) {
                barLabel = duration.barLabel;
              }

              const boBarNote = hasBo ? ` [⚠️ Overlaps Lockout: ${mLockouts.map(b => b.title).join('; ')}]` : '';

              rowCells += `<td class="timeline-cell${isCurrent}${boClasses}"${boStyle}>
                <div class="timeline-bar ${segClass}" style="background-color: ${catColor}; color: ${textColor};" title="${item.title} (${item.category} | ${sDateFormatted} to ${eDateFormatted})${boBarNote}">
                  ${barLabel}
                </div>
              </td>`;
            } else {
              rowCells += `<td class="timeline-cell${isCurrent}${boClasses}"${boStyle}${boCellTooltip}></td>`;
            }
          });

          if (isMob) {
            rowsHtml += `<tr>
              <td class="sticky-col-title mobile-table-title-cell" title="${item.title}">
                <div class="item-title-text" style="font-weight: 700;">${item.title}</div>
                <div class="item-sub-meta">
                  <span class="badge cat-badge" style="background-color: ${catColor}; color: ${textColor};">${item.category || 'General'}</span>
                  ${item.tags ? `<span class="tag-badge">${item.tags}</span>` : ''}
                </div>
                <div class="mobile-cell-meta">
                  <div class="mobile-meta-date">📅 ${sDateFormatted}${eDateFormatted !== sDateFormatted ? ` → ${eDateFormatted}` : ''}</div>
                  ${item.owner ? `<div class="mobile-meta-owner">👤 ${item.owner}</div>` : ''}
                  <div class="mobile-cell-actions">
                    <button type="button" class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit">✏️ Edit</button>
                    <button type="button" class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
                  </div>
                </div>
              </td>
              ${rowCells}
            </tr>`;
          } else {
            rowsHtml += `<tr>
              <td class="sticky-col-idx">${idx + 1}</td>
              <td class="sticky-col-title" title="${item.title}">
                <div class="item-title-text" style="font-weight: 700;">${item.title}</div>
                <div class="item-sub-meta">
                  <span class="badge cat-badge" style="background-color: ${catColor}; color: ${textColor};">${item.category || 'General'}</span>
                  ${item.tags ? `<span class="tag-badge">${item.tags}</span>` : ''}
                </div>
              </td>
              <td class="sticky-col-dates">${dateLabel}</td>
              <td class="sticky-col-owner" title="${item.owner || ''}">${item.owner || '<span style="color: var(--text-muted);">—</span>'}</td>
              <td class="sticky-col-actions no-print">
                <div class="row-actions">
                  <button class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit">✏️</button>
                  <button class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
                </div>
              </td>
              ${rowCells}
            </tr>`;
          }
        });
      }

      const swipeHint = isMob ? `
      <div class="mobile-swipe-hint no-print">
        <span>👉 Swipe horizontally for timeline</span>
        <button type="button" class="btn-jump-current" id="jumpToCurrentPeriodBtn">📍 Jump to Now</button>
      </div>` : '';

      return `${swipeHint}<table class="timeline-table">
        ${colgroup}
        <thead>${headerRow1}${headerRow2}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
    },

    // --- Weekly Table View ---
    renderWeeklyTable(items, year) {
      const isMob = this.isMobile();
      const colMetaSpan = isMob ? 1 : 5;
      const activeWeeks = this.getWeeksForYear(year);

      // Build Colgroup for 100% strict column width synchronization
      let colgroup = `<colgroup>`;
      if (isMob) {
        colgroup += `<col style="width: var(--col-w-mobile-title, 170px);">`;
      } else {
        colgroup += `
        <col style="width: var(--col-w-idx);">
        <col style="width: var(--col-w-title);">
        <col style="width: var(--col-w-dates);">
        <col style="width: var(--col-w-owner);">
        <col style="width: var(--col-w-actions);">`;
      }
      activeWeeks.forEach(() => {
        colgroup += `<col style="width: var(--week-col-w);">`;
      });
      colgroup += `</colgroup>`;

      // Row 1: Group headers
      let headerRow1 = `<tr class="header-row-1">
        <th class="sticky-meta-hdr${isMob ? ' mobile-sticky-meta-hdr' : ''}" colspan="${colMetaSpan}">Roadmap Items</th>
        <th class="timeline-year-group-hdr" colspan="${activeWeeks.length}">${year} Weekly Schedule</th>
      </tr>`;

      // Row 2: Column Headers & Weeks with Resizers
      let headerRow2 = `<tr class="header-row-2">`;
      if (isMob) {
        headerRow2 += `
        <th class="sticky-col-title mobile-table-title-hdr" data-col="title">
          Project / Action
        </th>`;
      } else {
        headerRow2 += `
        <th class="sticky-col-idx" data-col="idx">
          #
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-title" data-col="title">
          Project / Action / Period
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-dates" data-col="dates">
          Dates
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-owner" data-col="owner">
          Owner
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>
        <th class="sticky-col-actions no-print" data-col="actions">
          Actions
          <div class="col-resizer" title="Drag to resize column (double-click to reset)"></div>
        </th>`;
      }

      activeWeeks.forEach(w => {
        const wLockouts = this.getActiveBlockoutsForPeriod(w.startDate, w.endDate);
        const hasBo = wLockouts.length > 0;
        const boHdrClass = hasBo ? ' is-blockout-hdr' : '';
        const boHdrStyle = hasBo ? ` style="--bo-border-color: ${wLockouts[0].color || '#ef4444'};"` : '';
        const boHdrTitle = hasBo ? ` (🔒 Lockout: ${wLockouts.map(b => b.title).join('; ')})` : '';

        headerRow2 += `<th class="week-cell timeline-week-hdr${boHdrClass}"${boHdrStyle} title="${w.code}: ${w.fullDate || w.headerDate}${boHdrTitle}">
          <div class="week-hdr-num">${w.code}</div>
          <div class="week-hdr-date">${w.headerDate}</div>
        </th>`;
      });
      headerRow2 += '</tr>';

      let rowsHtml = '';
      if (items.length === 0) {
        rowsHtml = `<tr><td colspan="${colMetaSpan + activeWeeks.length}" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted); font-size: 0.95rem;">
          <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--text-main);">No items found for ${year} matching the selected filters</div>
          <div style="font-size: 0.85rem; margin-bottom: 0.85rem;">Try adjusting your search query, year, category, or past entries selections.</div>
          <div style="display: inline-flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline reset-cat-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🏷️ Select All Categories
            </button>
            ${this.pastFilter !== 'all' ? `
            <button type="button" class="btn btn-outline reset-past-btn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              🕒 Show All (Include Past)
            </button>` : ''}
          </div>
        </td></tr>`;
      } else {
        items.forEach((item, idx) => {
          const catColor = this.getCategoryColor(item.category);
          const textColor = this.getContrastColor(catColor);
          const sDate = item.startDate || '';
          const eDate = item.endDate || sDate;
          const sDateFormatted = this.formatDateDMY(sDate);
          const eDateFormatted = this.formatDateDMY(eDate);
          const dateLabel = sDateFormatted ? (sDateFormatted === eDateFormatted ? sDateFormatted : `${sDateFormatted}<br>to ${eDateFormatted}`) : 'No Date';

          let weekCells = '';
          activeWeeks.forEach((w, wIdx) => {
            const wLockouts = this.getActiveBlockoutsForPeriod(w.startDate, w.endDate);
            const hasBo = wLockouts.length > 0;
            let boClasses = '';
            let boStyle = '';
            let boCellTooltip = '';

            if (hasBo) {
              boClasses = ' is-blockout-cell';
              const prevBo = wIdx > 0 && this.getActiveBlockoutsForPeriod(activeWeeks[wIdx - 1].startDate, activeWeeks[wIdx - 1].endDate).length > 0;
              const nextBo = wIdx < activeWeeks.length - 1 && this.getActiveBlockoutsForPeriod(activeWeeks[wIdx + 1].startDate, activeWeeks[wIdx + 1].endDate).length > 0;
              if (!prevBo) boClasses += ' is-blockout-start';
              if (!nextBo) boClasses += ' is-blockout-end';

              const boColor = wLockouts[0].color || '#ef4444';
              boStyle = ` style="--bo-cell-tint: ${this.hexToRgba(boColor, 0.09)}; --bo-border-color: ${boColor};"`;
              boCellTooltip = ` title="🔒 Lockout: ${wLockouts.map(b => b.title).join('; ')}"`;
            }

            let inWeek = false;
            if (sDate && eDate) {
              inWeek = !(eDate < w.startDate || sDate > w.endDate);
            }

            if (inWeek) {
              const prevInWeek = wIdx > 0 && !(eDate < activeWeeks[wIdx - 1].startDate || sDate > activeWeeks[wIdx - 1].endDate);
              const nextInWeek = wIdx < activeWeeks.length - 1 && !(eDate < activeWeeks[wIdx + 1].startDate || sDate > activeWeeks[wIdx + 1].endDate);

              let segClass = 'bar-single';
              if (!prevInWeek && nextInWeek) {
                segClass = 'bar-start';
              } else if (prevInWeek && nextInWeek) {
                segClass = 'bar-mid';
              } else if (prevInWeek && !nextInWeek) {
                segClass = 'bar-end';
              }

              // On bar-start, compute consecutive weeks to show count e.g. "4w"
              let barLabel = '';
              if (!prevInWeek) {
                let spanWeeks = 1;
                for (let k = wIdx + 1; k < activeWeeks.length; k++) {
                  if (!(eDate < activeWeeks[k].startDate || sDate > activeWeeks[k].endDate)) {
                    spanWeeks++;
                  } else {
                    break;
                  }
                }
                barLabel = spanWeeks > 1 ? `${spanWeeks}w` : '•';
              }

              const boBarNote = hasBo ? ` [⚠️ Overlaps Lockout: ${wLockouts.map(b => b.title).join('; ')}]` : '';

              weekCells += `<td class="week-cell${boClasses}"${boStyle}>
                <div class="timeline-bar ${segClass}" style="background-color: ${catColor}; color: ${textColor};" title="${item.title} (${item.category} | ${sDateFormatted} to ${eDateFormatted})${boBarNote}">
                  ${barLabel}
                </div>
              </td>`;
            } else {
              weekCells += `<td class="week-cell${boClasses}"${boStyle}${boCellTooltip}></td>`;
            }
          });

          if (isMob) {
            rowsHtml += `<tr>
              <td class="sticky-col-title mobile-table-title-cell" title="${item.title}">
                <div class="item-title-text" style="font-weight: 700;">${item.title}</div>
                <div class="item-sub-meta">
                  <span class="badge cat-badge" style="background-color: ${catColor}; color: ${textColor};">${item.category || 'General'}</span>
                  ${item.tags ? `<span class="tag-badge">${item.tags}</span>` : ''}
                </div>
                <div class="mobile-cell-meta">
                  <div class="mobile-meta-date">📅 ${sDateFormatted}${eDateFormatted !== sDateFormatted ? ` → ${eDateFormatted}` : ''}</div>
                  ${item.owner ? `<div class="mobile-meta-owner">👤 ${item.owner}</div>` : ''}
                  <div class="mobile-cell-actions">
                    <button type="button" class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit">✏️ Edit</button>
                    <button type="button" class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
                  </div>
                </div>
              </td>
              ${weekCells}
            </tr>`;
          } else {
            rowsHtml += `<tr>
              <td class="sticky-col-idx">${idx + 1}</td>
              <td class="sticky-col-title" title="${item.title}">
                <div class="item-title-text" style="font-weight: 700;">${item.title}</div>
                <div class="item-sub-meta">
                  <span class="badge cat-badge" style="background-color: ${catColor}; color: ${textColor};">${item.category || 'General'}</span>
                  ${item.tags ? `<span class="tag-badge">${item.tags}</span>` : ''}
                </div>
              </td>
              <td class="sticky-col-dates">${dateLabel}</td>
              <td class="sticky-col-owner" title="${item.owner || ''}">${item.owner || '<span style="color: var(--text-muted);">—</span>'}</td>
              <td class="sticky-col-actions no-print">
                <div class="row-actions">
                  <button class="action-icon-btn edit-btn" data-id="${item.id}" title="Edit">✏️</button>
                  <button class="action-icon-btn delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
                </div>
              </td>
              ${weekCells}
            </tr>`;
          }
        });
      }

      const swipeHint = isMob ? `
      <div class="mobile-swipe-hint no-print">
        <span>👉 Swipe horizontally for timeline</span>
        <button type="button" class="btn-jump-current" id="jumpToCurrentPeriodBtn">📍 Jump to Now</button>
      </div>` : '';

      return `${swipeHint}<table class="timeline-table">
        ${colgroup}
        <thead>${headerRow1}${headerRow2}</thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
    },

    bindTableActionButtons() {
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.id;
          this.openEditModal(id);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.id;
          this.handleDeleteItem(id);
        });
      });

      document.querySelectorAll('.agenda-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.action-icon-btn')) return;
          const id = card.dataset.id;
          if (id) this.openEditModal(id);
        });
      });

      document.querySelectorAll('.reset-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectAllCategories();
        });
      });

      document.querySelectorAll('.reset-past-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.pastFilter = 'all';
          const pastSelect = document.getElementById('pastFilter');
          if (pastSelect) pastSelect.value = 'all';
          this.render();
          this.updateCategoryUI();
        });
      });
    },

    // --- Unified Entry Modal Handlers ---
    openAddModal() {
      this.editingItemId = null;
      const dialog = document.getElementById('entryDialog');
      const title = document.getElementById('dialogTitle');
      const form = document.getElementById('entryForm');

      title.textContent = 'Add Roadmap Entry';
      form.reset();

      const todayIso = new Date().toISOString().slice(0, 10);
      document.getElementById('entryStartDate').value = todayIso;
      document.getElementById('entryEndDate').value = todayIso;
      const ownerInput = document.getElementById('entryOwner');
      if (ownerInput) ownerInput.value = '';

      // Reset Section Checkboxes
      document.querySelectorAll('input[name="entrySection"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.section-chip')?.classList.remove('is-checked');
      });

      // Reset Notes
      const notesInput = document.getElementById('entryNotes');
      if (notesInput) notesInput.value = '';

      this.populateModalCategoryOptions();
      this.updateModalDuration();

      dialog.showModal();
    },

    openEditModal(id) {
      this.editingItemId = id;
      const dialog = document.getElementById('entryDialog');
      const title = document.getElementById('dialogTitle');

      title.textContent = 'Edit Roadmap Entry';

      const item = window.storageManager.getItems().find(i => i.id === id);
      if (!item) return;

      this.populateModalCategoryOptions();

      document.getElementById('entryTitle').value = item.title || '';
      document.getElementById('entryCategory').value = item.category || 'Branch Calendar Event';
      document.getElementById('entryStartDate').value = item.startDate || '';
      document.getElementById('entryEndDate').value = item.endDate || item.startDate || '';
      const ownerInput = document.getElementById('entryOwner');
      if (ownerInput) ownerInput.value = item.owner || '';
      document.getElementById('entryTags').value = item.tags || '';

      // Populate Section Multi-Select
      let activeSections = [];
      if (Array.isArray(item.section)) {
        activeSections = item.section;
      } else if (typeof item.section === 'string' && item.section.trim()) {
        activeSections = item.section.split(',').map(s => s.trim());
      } else if (Array.isArray(item.sections)) {
        activeSections = item.sections;
      } else if (typeof item.sections === 'string' && item.sections.trim()) {
        activeSections = item.sections.split(',').map(s => s.trim());
      }

      document.querySelectorAll('input[name="entrySection"]').forEach(cb => {
        const isChecked = activeSections.includes(cb.value);
        cb.checked = isChecked;
        cb.closest('.section-chip')?.classList.toggle('is-checked', isChecked);
      });

      // Populate Notes
      const notesInput = document.getElementById('entryNotes');
      if (notesInput) notesInput.value = item.notes || item.note || '';

      this.updateModalDuration();

      dialog.showModal();
    },

    populateModalCategoryOptions() {
      const catSelect = document.getElementById('entryCategory');
      if (!catSelect) return;
      catSelect.innerHTML = '';

      const cats = window.storageManager.getCategories();
      Object.keys(cats).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catSelect.appendChild(opt);
      });
    },

    saveEntryForm() {
      const title = document.getElementById('entryTitle').value.trim();
      const category = document.getElementById('entryCategory').value;
      const startDate = document.getElementById('entryStartDate').value;
      const endDate = document.getElementById('entryEndDate').value || startDate;
      const owner = document.getElementById('entryOwner')?.value.trim() || '';
      const tags = document.getElementById('entryTags').value.trim();
      const months = this.calculateDurationMonths(startDate, endDate);

      const checkedSections = Array.from(document.querySelectorAll('input[name="entrySection"]:checked')).map(cb => cb.value);
      const notes = document.getElementById('entryNotes')?.value.trim() || '';

      if (!title || !startDate) {
        alert('Please fill in both Title and Start Date.');
        return;
      }

      if (this.editingItemId) {
        window.storageManager.updateItem({
          id: this.editingItemId,
          title,
          category,
          startDate,
          endDate,
          owner,
          tags,
          months,
          section: checkedSections,
          notes
        });
      } else {
        window.storageManager.addItem({
          title,
          category,
          startDate,
          endDate,
          owner,
          tags,
          months,
          section: checkedSections,
          notes
        });
      }

      document.getElementById('entryDialog').close();
      this.populateCategoryFilters();
      this.renderLegendBar();
      this.render();
    },

    handleDeleteItem(id) {
      if (confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
        window.storageManager.deleteItem(id);
        this.populateCategoryFilters();
        this.renderLegendBar();
        this.render();
      }
    },

    // --- Blockout / Lockout Periods Management ---
    bindBlockoutModalEvents() {
      const dialog = document.getElementById('blockoutsDialog');
      const manageBtn = document.getElementById('manageBlockoutsBtn');
      const closeBtn = document.getElementById('closeBlockoutDialogBtn');
      const doneBtn = document.getElementById('doneBlockoutsBtn');
      const highlightCheckbox = document.getElementById('blockoutHighlightCheckbox');
      const openAddFormBtn = document.getElementById('openAddBlockoutFormBtn');
      const cancelFormBtn = document.getElementById('cancelBlockoutFormBtn');
      const form = document.getElementById('blockoutForm');
      const colorInput = document.getElementById('blockoutColor');
      const colorHex = document.getElementById('blockoutColorHex');
      const resetDefaultBtn = document.getElementById('resetBlockoutsDefaultBtn');

      manageBtn?.addEventListener('click', () => this.openBlockoutsModal());
      closeBtn?.addEventListener('click', () => dialog?.close());
      doneBtn?.addEventListener('click', () => dialog?.close());

      highlightCheckbox?.addEventListener('change', (e) => {
        this.blockoutsVisible = e.target.checked;
        window.storageManager.setBlockoutsVisible(this.blockoutsVisible);
        this.updateBlockoutControls();
        this.render();
      });

      colorInput?.addEventListener('input', (e) => {
        if (colorHex) colorHex.textContent = e.target.value;
      });

      openAddFormBtn?.addEventListener('click', () => {
        this.openBlockoutForm(null);
      });

      cancelFormBtn?.addEventListener('click', () => {
        const formContainer = document.getElementById('blockoutFormContainer');
        if (formContainer) formContainer.style.display = 'none';
      });

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveBlockoutForm();
      });

      resetDefaultBtn?.addEventListener('click', () => {
        if (confirm('Restore default sample lockout periods? Any custom lockouts will be replaced.')) {
          const defaults = window.DEFAULT_BLOCKOUTS || [];
          window.storageManager.saveBlockouts(JSON.parse(JSON.stringify(defaults)));
          this.renderBlockoutsList();
          this.updateBlockoutControls();
          this.render();
        }
      });
    },

    updateBlockoutControls() {
      const count = window.storageManager.getBlockouts().length;
      const countBadge = document.getElementById('lockoutCountBadge');
      if (countBadge) countBadge.textContent = count;

      const checkbox = document.getElementById('blockoutHighlightCheckbox');
      const statusText = document.getElementById('blockoutHighlightStatusText');

      if (checkbox) {
        checkbox.checked = this.blockoutsVisible;
      }
      if (statusText) {
        statusText.textContent = this.blockoutsVisible ? 'Enabled' : 'Disabled';
      }
    },

    openBlockoutsModal() {
      const dialog = document.getElementById('blockoutsDialog');
      if (!dialog) return;
      this.renderBlockoutsList();
      const formContainer = document.getElementById('blockoutFormContainer');
      if (formContainer) formContainer.style.display = 'none';
      this.updateBlockoutControls();
      dialog.showModal();
    },

    renderBlockoutsList() {
      const container = document.getElementById('blockoutListContainer');
      if (!container) return;
      const blockouts = window.storageManager.getBlockouts();

      if (blockouts.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          No lockout periods configured yet. Click "Add Lockout Period" above to create one.
        </div>`;
        return;
      }

      let html = '';
      blockouts.forEach(bo => {
        const sDate = bo.startDate || '';
        const eDate = bo.endDate || sDate;
        const sDateFormatted = this.formatDateDMY(sDate);
        const eDateFormatted = this.formatDateDMY(eDate);
        const boDateLabel = sDateFormatted ? (sDateFormatted === eDateFormatted ? sDateFormatted : `${sDateFormatted} to ${eDateFormatted}`) : 'No Date';
        const color = bo.color || '#ef4444';
        const notes = bo.notes ? `<div class="blockout-card-notes">${bo.notes}</div>` : '';

        html += `<div class="blockout-card" data-id="${bo.id}">
          <div class="blockout-card-meta">
            <div class="blockout-card-title">
              <span class="blockout-color-pill" style="background-color: ${color};"></span>
              <span>${bo.title}</span>
            </div>
            <div class="blockout-card-dates">
              <span>📅 ${boDateLabel}</span>
            </div>
            ${notes}
          </div>
          <div class="blockout-card-actions">
            <button type="button" class="action-icon-btn edit-bo-btn" data-id="${bo.id}" title="Edit Lockout Period">✏️</button>
            <button type="button" class="action-icon-btn delete-bo-btn" data-id="${bo.id}" title="Delete Lockout Period">🗑️</button>
          </div>
        </div>`;
      });

      container.innerHTML = html;

      // Event listeners for Edit / Delete
      container.querySelectorAll('.edit-bo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          this.openBlockoutForm(id);
        });
      });

      container.querySelectorAll('.delete-bo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          if (confirm('Delete this lockout period?')) {
            window.storageManager.deleteBlockout(id);
            this.renderBlockoutsList();
            this.updateBlockoutControls();
            this.render();
          }
        });
      });
    },

    openBlockoutForm(id = null) {
      const container = document.getElementById('blockoutFormContainer');
      const titleElem = document.getElementById('blockoutFormTitle');
      const idInput = document.getElementById('blockoutEditId');
      const titleInput = document.getElementById('blockoutTitle');
      const startInput = document.getElementById('blockoutStartDate');
      const endInput = document.getElementById('blockoutEndDate');
      const colorInput = document.getElementById('blockoutColor');
      const colorHex = document.getElementById('blockoutColorHex');
      const notesInput = document.getElementById('blockoutNotes');

      if (!container) return;
      container.style.display = 'block';

      if (id) {
        const bo = window.storageManager.getBlockouts().find(b => b.id === id);
        if (!bo) return;
        if (titleElem) titleElem.textContent = 'Edit Lockout Period';
        if (idInput) idInput.value = bo.id;
        if (titleInput) titleInput.value = bo.title || '';
        if (startInput) startInput.value = bo.startDate || '';
        if (endInput) endInput.value = bo.endDate || '';
        if (colorInput) colorInput.value = bo.color || '#ef4444';
        if (colorHex) colorHex.textContent = bo.color || '#ef4444';
        if (notesInput) notesInput.value = bo.notes || '';
      } else {
        if (titleElem) titleElem.textContent = 'Add Lockout Period';
        if (idInput) idInput.value = '';
        if (titleInput) titleInput.value = '';
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        if (colorInput) colorInput.value = '#ef4444';
        if (colorHex) colorHex.textContent = '#ef4444';
        if (notesInput) notesInput.value = '';
      }

      titleInput?.focus();
      setTimeout(() => container.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    },

    saveBlockoutForm() {
      const id = document.getElementById('blockoutEditId')?.value;
      const title = document.getElementById('blockoutTitle')?.value.trim();
      const startDate = document.getElementById('blockoutStartDate')?.value;
      const endDate = document.getElementById('blockoutEndDate')?.value;
      const color = document.getElementById('blockoutColor')?.value || '#ef4444';
      const notes = document.getElementById('blockoutNotes')?.value.trim() || '';

      if (!title || !startDate || !endDate) {
        alert('Please fill in Title, Start Date, and End Date.');
        return;
      }

      if (endDate < startDate) {
        alert('End date cannot be earlier than start date.');
        return;
      }

      if (id) {
        window.storageManager.updateBlockout(id, { title, startDate, endDate, color, notes });
      } else {
        window.storageManager.addBlockout({ title, startDate, endDate, color, notes });
      }

      document.getElementById('blockoutFormContainer').style.display = 'none';
      this.renderBlockoutsList();
      this.updateBlockoutControls();
      this.render();
    },

    handleResetData() {
      if (confirm('Reset all roadmap data back to original default master entries? Any unsaved local edits will be replaced.')) {
        window.storageManager.resetToDefaults();
        window.storageManager.resetColumnWidths();
        this.applySavedColumnWidths();
        this.selectedCategories = new Set(Object.keys(window.storageManager.getCategories()));
        this.pastFilter = 'all';
        const pastSelect = document.getElementById('pastFilter');
        if (pastSelect) pastSelect.value = 'all';
        this.yearFilter = 'all';
        this.previousMonthlyYear = null;
        const yearSelect = document.getElementById('yearFilter');
        if (yearSelect) yearSelect.value = 'all';
        this.populateCategoryFilters();
        this.renderLegendBar();
        this.updateBlockoutControls();
        this.render();
      }
    },

    openCsvModal() {
      document.getElementById('csvFileInput').value = '';
      document.getElementById('csvDialog').showModal();
    },

    processCsvUpload() {
      const fileInput = document.getElementById('csvFileInput');
      const replaceAll = document.getElementById('csvReplaceAll').checked;
      const dialog = document.getElementById('csvDialog');

      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a CSV file to upload.');
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const res = window.storageManager.importCSV(text, replaceAll);
        if (res.success) {
          alert(`Successfully imported ${res.count} items!`);
          dialog.close();
          this.selectedCategories = new Set(Object.keys(window.storageManager.getCategories()));
          this.populateCategoryFilters();
          this.renderLegendBar();
          this.render();
        } else {
          alert(`CSV Import Failed: ${res.error}`);
        }
      };
      reader.readAsText(file);
    },

    handleExportPdf() {
      window.print();
    }
  };

  window.app = app;
  app.init();
});
