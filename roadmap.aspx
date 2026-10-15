<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1c4270">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>Scouts Queensland - Youth Program Team Roadmap & Planner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,400..900;1,6..12,400..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="css/print.css" media="print">
  <link rel="icon" type="image/png" href="assets/Scouts QLD sideway small.png">
</head>
<body>

  <!-- Print-Only Header for PDF Export -->
  <header class="print-only-header" style="display: none;">
    <img src="assets/Scouts_QLD_Master_Vert_FullCol_RGB.png" alt="Scouts Queensland" class="print-logo" style="max-height: 40px; width: auto;">
    <div class="print-title">
      <h2 id="printDocTitle">Youth Program Team Roadmap</h2>
      <p>Scouts Australia - Queensland Branch | Generated for Planning</p>
    </div>
  </header>

  <!-- External Sync Notification Banner (OneDrive changes from other computers) -->
  <aside id="externalSyncBanner" class="sync-alert-banner no-print" style="display: none;">
    <div class="sync-alert-content">
      <span>🔔 <strong>OneDrive Update:</strong> The data file was updated on another computer <span id="externalSyncTime"></span>.</span>
      <div class="sync-alert-actions">
        <button type="button" class="btn btn-sm btn-primary" id="reloadExternalFileBtn">Reload Latest Changes</button>
        <button type="button" class="btn btn-sm btn-outline" id="dismissExternalFileBtn">Dismiss</button>
      </div>
    </div>
  </aside>

  <!-- Interactive Screen Header -->
  <header class="app-header no-print">
    <div class="header-container">
      <div class="brand-section">
        <img src="assets/Scouts_QLD_Master_Horz_White_RGB.png" alt="Scouts Queensland Logo" class="brand-logo" height="28" style="height: 28px; max-height: 28px; width: auto;">
        <div class="brand-titles">
          <h1>Youth Program Team</h1>
          <p>Interactive Roadmap & Planner</p>
        </div>
      </div>

      <!-- Center: View Switcher -->
      <nav class="view-tabs" aria-label="Planner Views">
        <button class="view-btn active" data-view="monthly" id="viewMonthlyBtn">
          <span>📅</span> Monthly
        </button>
        <button class="view-btn" data-view="weekly" id="viewWeeklyBtn">
          <span>📆</span> Weekly
        </button>
        <button class="view-btn" data-view="agenda" id="viewAgendaBtn">
          <span>📋</span> Agenda
        </button>
      </nav>

      <!-- Right: Action Buttons -->
      <div class="header-controls">
        <!-- Direct File Sync Button (Desktop) -->
        <button class="btn btn-sync desktop-only" id="fileSyncBtn" title="Sync directly with a shared OneDrive JSON file">
          <span id="fileSyncDot" class="sync-dot disconnected"></span>
          <span id="fileSyncLabel">📁 Connect OneDrive File</span>
        </button>

        <button class="btn btn-primary" id="addEntryBtn">
          <span>➕</span> <span class="btn-text">Add Entry</span>
        </button>

        <!-- Desktop Action Buttons -->
        <div class="desktop-action-buttons">
          <button class="btn btn-secondary" id="exportPdfBtn" title="Export clean landscape printable PDF">
            <span>🖨️</span> Export PDF
          </button>
          <button class="btn btn-secondary" id="exportCsvBtn" title="Download current roadmap as CSV">
            <span>⬇️</span> Export CSV
          </button>
          <button class="btn btn-secondary" id="importCsvBtn" title="Bulk upload items from CSV file">
            <span>⬆️</span> Bulk Upload CSV
          </button>
          <button class="btn btn-secondary" id="importJsonBtn" title="Load roadmap data from a JSON file">
            <span>📂</span> Import JSON
          </button>
          <input type="file" id="jsonFileInput" accept=".json" style="display: none;">
          <button class="btn btn-secondary" id="exportJsonBtn" title="Download full JSON snapshot backup">
            <span>💾</span> Backup JSON
          </button>
        </div>

        <!-- Mobile More Actions Menu -->
        <div class="mobile-more-container" id="mobileMoreContainer">
          <button type="button" class="btn btn-secondary mobile-more-btn" id="mobileMoreBtn" aria-haspopup="true" aria-expanded="false" title="More options and exports">
            <span>⋯</span> More
          </button>
          <div class="mobile-more-menu" id="mobileMoreMenu" hidden>
            <button type="button" class="more-menu-item" id="mFileSyncBtn">
              <span class="more-menu-icon">📁</span>
              <span id="mobileSyncLabel">OneDrive Sync Settings</span>
            </button>
            <button type="button" class="more-menu-item" id="mExportPdfBtn">
              <span class="more-menu-icon">🖨️</span> Export PDF
            </button>
            <button type="button" class="more-menu-item" id="mExportCsvBtn">
              <span class="more-menu-icon">⬇️</span> Export CSV
            </button>
            <button type="button" class="more-menu-item" id="mImportCsvBtn">
              <span class="more-menu-icon">⬆️</span> Bulk Upload CSV
            </button>
            <button type="button" class="more-menu-item" id="mImportJsonBtn">
              <span class="more-menu-icon">📂</span> Import JSON
            </button>
            <button type="button" class="more-menu-item" id="mExportJsonBtn">
              <span class="more-menu-icon">💾</span> Backup JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Toolbar: Search, Filters, Sorting, Stats -->
  <section class="toolbar-container no-print">
    <div class="toolbar">
      <!-- Search & Mobile Filter Toggle -->
      <div class="toolbar-primary-row">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="Search tasks, tags...">
        </div>
        <button type="button" class="btn btn-outline mobile-filter-btn" id="mobileFilterToggleBtn" aria-expanded="false" aria-controls="toolbarFilters" title="Filter roadmap items">
          <span>⚡</span> Filters <span class="filter-count-badge" id="mobileFilterBadge" style="display: none;">0</span>
        </button>
      </div>

      <!-- Filters Wrapper (Desktop inline, Mobile collapsible drawer) -->
      <div class="toolbar-filters" id="toolbarFilters">
        <!-- Year Filter -->
        <div class="filter-group" id="yearFilterGroup">
          <label for="yearFilter">Year:</label>
          <select id="yearFilter" class="filter-select">
            <option value="all" selected>All Years (2026–2028)</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
          </select>
        </div>

        <!-- Category Filter & Manage -->
        <div class="filter-group category-filter-group">
          <label>Category:</label>
          <div class="multi-select-container" id="categoryMultiSelect">
            <button type="button" class="multi-select-btn" id="categoryDropdownBtn" aria-haspopup="true" aria-expanded="false" title="Filter by one or more categories">
              <span id="categoryDropdownLabel">🏷️ All Categories</span>
              <span class="dropdown-chevron">▾</span>
            </button>
            <div class="multi-select-menu" id="categoryDropdownMenu" hidden>
              <div class="multi-select-menu-header">
                <span class="multi-select-title">Filter by Category</span>
                <div class="multi-select-actions">
                  <button type="button" class="btn-link-action" id="catSelectAllBtn" title="Select all categories">Select All</button>
                  <span class="action-divider">•</span>
                  <button type="button" class="btn-link-action" id="catClearAllBtn" title="Deselect all categories">Clear All</button>
                </div>
              </div>
              <div class="multi-select-list" id="categoryCheckboxList">
                <!-- Checkbox list items populated dynamically by app.js -->
              </div>
            </div>
          </div>
          <button class="btn btn-outline" id="manageCategoriesBtn" title="Customize category names and colours">
            <span>🎨</span> Categories
          </button>
        </div>

        <!-- Lockout Periods Group -->
        <div class="filter-group" id="lockoutGroup">
          <button class="btn btn-outline" id="manageBlockoutsBtn" title="Manage Lockout & Blockout Periods (blackout dates, moratoriums, shutdowns)">
            <span>🔒</span><span>Lockouts (<span id="lockoutCountBadge">0</span>)</span>
          </button>
        </div>

        <!-- Past Entries Filter -->
        <div class="filter-group" id="pastFilterGroup">
          <label for="pastFilter">Past:</label>
          <select id="pastFilter" class="filter-select">
            <option value="all">Show All</option>
            <option value="hide">Hide Past</option>
            <option value="only">Past Only</option>
          </select>
        </div>

        <!-- Sort Select -->
        <div class="filter-group">
          <label for="sortSelect">Sort:</label>
          <select id="sortSelect" class="filter-select">
            <option value="startDate">Start Date</option>
            <option value="title">Task / Event Name</option>
            <option value="owner">Owner</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div class="mobile-filter-drawer-footer mobile-only">
          <button type="button" class="btn btn-primary" id="closeMobileFiltersBtn" style="width: 100%; justify-content: center;">
            ✓ Apply & Close Filters
          </button>
        </div>
      </div>

      <!-- Stats Badge & Reset -->
      <div class="toolbar-actions">
        <span class="stats-badge" id="statsBadge">Loading items...</span>
        <button class="btn btn-outline" id="resetDataBtn" title="Reset back to initial dataset from Excel">
          🔄 Reset
        </button>
      </div>
    </div>
  </section>

  <!-- Main View Container -->
  <main class="main-content">
    <div class="planner-card">
      <div class="table-scroll-wrapper" id="tableContainer">
        <!-- Rendered dynamically by app.js -->
      </div>
    </div>
  </main>

  <!-- Print-Only Footer -->
  <footer class="print-footer">
    Scouts Australia - Queensland Branch • Youth Program Team Roadmap & Weekly Planner • Confidential & Internal Use Only
  </footer>

  <!-- Modal: Add / Edit Entry -->
  <dialog id="entryDialog" aria-labelledby="dialogTitle">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 id="dialogTitle">Add New Entry</h3>
        <button type="button" class="dialog-close-btn" id="closeEntryDialogBtn" aria-label="Close">&times;</button>
      </div>
      <form id="entryForm">
        <div class="dialog-body">
          <div class="form-group">
            <label for="entryTitle">Project / Action Title *</label>
            <input type="text" id="entryTitle" required placeholder="e.g. Scouting Essentials (Brisbane)" autofocus>
          </div>

          <div class="form-group">
            <label for="entryCategory">Category *</label>
            <select id="entryCategory" required>
              <!-- Populated dynamically -->
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="entryStartDate">Start Date *</label>
              <input type="date" id="entryStartDate" required>
            </div>
            <div class="form-group">
              <label for="entryEndDate">End Date</label>
              <input type="date" id="entryEndDate">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="entryOwner">Owner / Lead</label>
              <input type="text" id="entryOwner" placeholder="e.g. BC Scouts, Jane Doe, YPT Lead">
            </div>
            <div class="form-group">
              <label for="entryTags">Tags (e.g. Training - AA, Rover Scouts)</label>
              <input type="text" id="entryTags" placeholder="e.g. Training - AA">
            </div>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label style="margin-bottom: 0; font-weight: 700;">Section</label>
              <div style="font-size: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
                <button type="button" class="btn-text-action" id="selectAllSectionsBtn">Select All</button>
                <span style="color: var(--text-muted);">|</span>
                <button type="button" class="btn-text-action" id="clearAllSectionsBtn">Clear</button>
              </div>
            </div>
            <div class="section-checkbox-group" id="entrySectionGroup">
              <label class="section-chip" data-section="Joey Scouts">
                <input type="checkbox" name="entrySection" value="Joey Scouts">
                <span class="section-dot" style="background-color: #854d0e;"></span>
                <span class="chip-label">Joey Scouts</span>
              </label>
              <label class="section-chip" data-section="Cub Scouts">
                <input type="checkbox" name="entrySection" value="Cub Scouts">
                <span class="section-dot" style="background-color: #d97706;"></span>
                <span class="chip-label">Cub Scouts</span>
              </label>
              <label class="section-chip" data-section="Scouts">
                <input type="checkbox" name="entrySection" value="Scouts">
                <span class="section-dot" style="background-color: #16a34a;"></span>
                <span class="chip-label">Scouts</span>
              </label>
              <label class="section-chip" data-section="Venturer Scouts">
                <input type="checkbox" name="entrySection" value="Venturer Scouts">
                <span class="section-dot" style="background-color: #dc2626;"></span>
                <span class="chip-label">Venturer Scouts</span>
              </label>
              <label class="section-chip" data-section="Rover Scouts">
                <input type="checkbox" name="entrySection" value="Rover Scouts">
                <span class="section-dot" style="background-color: #991b1b;"></span>
                <span class="chip-label">Rover Scouts</span>
              </label>
              <label class="section-chip" data-section="Adults">
                <input type="checkbox" name="entrySection" value="Adults">
                <span class="section-dot" style="background-color: #1c4270;"></span>
                <span class="chip-label">Adults</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="entryNotes">Notes</label>
            <textarea id="entryNotes" rows="3" placeholder="Additional details, planning notes, location, or reference info..."></textarea>
          </div>

          <div class="form-group">
            <label for="entryMonths">Calculated Duration</label>
            <input type="text" id="entryMonths" readonly style="background-color: #f1f5f9; cursor: not-allowed; font-weight: 700; color: var(--scouts-navy);" value="—">
            <small style="color: var(--text-muted); font-size: 0.75rem;">Calculated automatically from Start & End Date</small>
          </div>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn btn-outline" id="cancelEntryBtn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="saveEntryBtn">Save Entry</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Modal: Bulk CSV Upload -->
  <dialog id="csvDialog" aria-labelledby="csvDialogTitle">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 id="csvDialogTitle">Bulk Upload from CSV</h3>
        <button type="button" class="dialog-close-btn" id="closeCsvDialogBtn" aria-label="Close">&times;</button>
      </div>
      <form id="csvForm">
        <div class="dialog-body">
          <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.4;">
            Upload a CSV file containing event entries. The file should include at least a <strong>Title</strong> (or Project/Action) and <strong>StartDate</strong> column. Optional columns: EndDate, Months, Owner, Category, Tags.
          </p>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label for="csvFileInput">Choose CSV File *</label>
            <input type="file" id="csvFileInput" accept=".csv" required style="padding: 0.4rem;">
          </div>

          <div class="form-group" style="margin-top: 0.5rem; display: flex; flex-direction: row; align-items: center; gap: 0.5rem;">
            <input type="checkbox" id="csvReplaceAll" style="width: auto;">
            <label for="csvReplaceAll" style="font-size: 0.85rem; font-weight: normal; cursor: pointer;">
              Replace all existing roadmap items (instead of appending)
            </label>
          </div>
        </div>

        <div class="dialog-footer">
          <button type="button" class="btn btn-outline" id="cancelCsvBtn">Cancel</button>
          <button type="submit" class="btn btn-primary">Upload & Import</button>
        </div>
      </form>
    </div>
  </dialog>

  <!-- Modal: Manage Categories & Colours -->
  <dialog id="categoryDialog" aria-labelledby="catDialogTitle" style="max-width: 680px; width: 95%;">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 id="catDialogTitle">Manage Categories & Colours</h3>
        <button type="button" class="dialog-close-btn" id="closeCatDialogBtn" aria-label="Close">&times;</button>
      </div>
      <div class="dialog-body" style="max-height: 65vh; overflow-y: auto;">
        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">
          Customize category names, pick custom or Scouts brand colours, or create new categories. Changes will instantly update all views, badges, timeline bars, and PDF exports.
        </p>

        <!-- Category Items List -->
        <div id="categoryListContainer" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
          <!-- Rendered dynamically -->
        </div>

        <!-- Add Category Form -->
        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; align-items: flex-end; gap: 0.75rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <label for="newCategoryName" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">New Category Name</label>
            <input type="text" id="newCategoryName" placeholder="e.g. Leader Training" style="padding: 0.45rem 0.75rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); width: 100%; font-family: inherit; font-size: 0.85rem;">
          </div>
          <div>
            <label for="newCategoryColor" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">Colour</label>
            <input type="color" id="newCategoryColor" value="#0284c7" class="cat-color-input">
          </div>
          <button type="button" class="btn btn-secondary" id="addNewCategoryBtn" style="height: 36px; background-color: var(--scouts-teal); color: white;">
            <span>➕</span> Add Category
          </button>
        </div>

        <!-- Scouts Brand Color Quick Palette Helper -->
        <div style="margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">Scouts Brand Colour Palette (Click to assign to selected colour):</div>
          <div class="brand-swatches" id="brandSwatchesContainer" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <div class="dialog-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="btn btn-outline" id="resetCategoriesBtn" style="color: #b91c1c;" title="Reset categories and colours back to brand defaults">
          🔄 Reset to Brand Defaults
        </button>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-outline" id="cancelCatBtn">Cancel</button>
          <button type="button" class="btn btn-primary" id="saveCatBtn">Save Category Changes</button>
        </div>
      </div>
    </div>
  </dialog>

  <!-- Modal: Manage Lockout / Blockout Periods -->
  <dialog id="blockoutsDialog" aria-labelledby="blockoutDialogTitle" style="max-width: 740px; width: 95%;">
    <div class="dialog-content">
      <div class="dialog-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">🔒</span>
          <div>
            <h3 id="blockoutDialogTitle" style="margin: 0;">Manage Lockout & Blockout Periods</h3>
            <div style="font-size: 0.775rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">
              Advisory blackout dates, moratoriums, and shutdown periods highlighted on the planning timeline
            </div>
          </div>
        </div>
        <button type="button" class="dialog-close-btn" id="closeBlockoutDialogBtn" aria-label="Close">&times;</button>
      </div>
      <div class="dialog-body" style="max-height: 75vh; overflow-y: auto;">
        
        <!-- Master Highlight Toggle inside modal -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 1rem;">
          <div>
            <strong style="font-size: 0.85rem; color: var(--text-main); display: block;">Timeline Visual Highlighting</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Displays shaded warning corridors across monthly & weekly columns</span>
          </div>
          <label class="toggle-switch-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.825rem; font-weight: 700;">
            <input type="checkbox" id="blockoutHighlightCheckbox" checked style="width: 18px; height: 18px; accent-color: var(--scouts-teal); cursor: pointer;">
            <span id="blockoutHighlightStatusText">Enabled</span>
          </label>
        </div>

        <!-- Lockout Periods List -->
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted);">Configured Lockout Periods</span>
            <button type="button" class="btn btn-secondary" id="openAddBlockoutFormBtn" style="font-size: 0.775rem; padding: 0.25rem 0.65rem; background-color: var(--scouts-teal); color: white;">
              <span>➕</span> Add Lockout Period
            </button>
          </div>
          <div id="blockoutListContainer" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <!-- Rendered dynamically by app.js -->
          </div>
        </div>

        <!-- Add / Edit Lockout Form (hidden by default until user clicks Add or Edit) -->
        <div id="blockoutFormContainer" style="display: none; padding: 1rem; background: #ffffff; border: 1.5px solid var(--border-dark); border-radius: var(--radius-md); margin-top: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h4 id="blockoutFormTitle" style="margin: 0 0 0.75rem 0; font-size: 0.95rem; color: var(--scouts-navy);">Add Lockout Period</h4>
          <form id="blockoutForm">
            <input type="hidden" id="blockoutEditId">
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <label for="blockoutTitle" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">Title / Lockout Name *</label>
                <input type="text" id="blockoutTitle" required placeholder="e.g. Branch Conference Lockout, EOY Shutdown" style="width: 100%; padding: 0.45rem 0.65rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); font-family: inherit; font-size: 0.85rem;">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                  <label for="blockoutStartDate" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">Start Date *</label>
                  <input type="date" id="blockoutStartDate" required style="width: 100%; padding: 0.45rem 0.65rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); font-family: inherit; font-size: 0.85rem;">
                </div>
                <div>
                  <label for="blockoutEndDate" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">End Date *</label>
                  <input type="date" id="blockoutEndDate" required style="width: 100%; padding: 0.45rem 0.65rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); font-family: inherit; font-size: 0.85rem;">
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 140px 1fr; gap: 0.75rem; align-items: flex-end;">
                <div>
                  <label for="blockoutColor" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">Highlight Colour</label>
                  <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <input type="color" id="blockoutColor" value="#ef4444" class="cat-color-input">
                    <span id="blockoutColorHex" style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">#ef4444</span>
                  </div>
                </div>
                <div>
                  <label for="blockoutNotes" style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 0.25rem;">Notes / Advisory Guidance (Optional)</label>
                  <input type="text" id="blockoutNotes" placeholder="e.g. No state level camps to be scheduled" style="width: 100%; padding: 0.45rem 0.65rem; border: 1px solid var(--border-dark); border-radius: var(--radius-md); font-family: inherit; font-size: 0.85rem;">
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                <button type="button" class="btn btn-outline" id="cancelBlockoutFormBtn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">Cancel</button>
                <button type="submit" class="btn btn-primary" id="saveBlockoutBtn" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">Save Lockout Period</button>
              </div>
            </div>
          </form>
        </div>

      </div>
      <div class="dialog-footer" style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="btn btn-outline" id="resetBlockoutsDefaultBtn" style="font-size: 0.8rem; color: #b91c1c;" title="Reset to sample lockout periods">
          🔄 Restore Default Samples
        </button>
        <button type="button" class="btn btn-primary" id="doneBlockoutsBtn">Done</button>
      </div>
    </div>
  </dialog>

  <!-- Modal: OneDrive File Sync Manager -->
  <dialog id="fileSyncDialog" aria-labelledby="syncDialogTitle" style="max-width: 600px; width: 95%;">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 id="syncDialogTitle">📁 OneDrive File Sync Settings</h3>
        <button type="button" class="dialog-close-btn" id="closeSyncDialogBtn" aria-label="Close">&times;</button>
      </div>
      <div class="dialog-body">
        <div class="sync-info-card" style="background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <strong>Sync Status:</strong>
            <span id="syncModalStatus">🟢 Connected</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
            <strong>Linked File:</strong>
            <span id="syncModalFileName" style="font-family: monospace; color: var(--scouts-navy); font-weight: 700;">roadmap-data.json</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
            <strong>Last Saved to Disk:</strong>
            <span id="syncModalLastSaved" style="color: var(--text-muted);">N/A</span>
          </div>
        </div>

        <!-- If Connected -->
        <div id="syncConnectedActions" style="display: none;">
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1rem;">
            Your changes auto-save directly to this JSON file on disk. When OneDrive syncs the file, other computers linked to it will receive your updates automatically.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <button type="button" class="btn btn-primary" id="syncSaveNowBtn" style="justify-content: center; width: 100%;">
              💾 Force Save to File Now
            </button>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary" id="syncReloadBtn" style="justify-content: center;">
                🔄 Reload from File
              </button>
              <button type="button" class="btn btn-secondary" id="syncSwitchFileBtn" style="justify-content: center;">
                📂 Switch File
              </button>
            </div>
            <button type="button" class="btn btn-outline" id="syncDisconnectBtn" style="justify-content: center; color: #b91c1c; margin-top: 0.5rem;">
              ❌ Disconnect File (Keep changes in browser only)
            </button>
          </div>
        </div>

        <!-- If Disconnected -->
        <div id="syncDisconnectedActions">
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 1rem;">
            Link this dashboard directly to <strong>data/roadmap-data.json</strong> in your OneDrive folder. 
            Once linked, every change you make auto-saves to that file and syncs across all your computers.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            <button type="button" class="btn btn-primary" id="syncOpenFileBtn" style="justify-content: center; padding: 0.6rem;">
              📂 Choose Existing File (e.g. data/roadmap-data.json)
            </button>
            <button type="button" class="btn btn-secondary" id="syncCreateFileBtn" style="justify-content: center;">
              ➕ Create New JSON File on Disk
            </button>
          </div>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: var(--radius-md); font-size: 0.78rem; color: var(--text-muted); border-left: 3px solid var(--scouts-teal);">
            <strong>💡 Multi-computer tip:</strong> On your second computer, open this same dialog and select the same <code>roadmap-data.json</code> in your synced OneDrive folder!
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button type="button" class="btn btn-outline" id="cancelSyncBtn">Close</button>
      </div>
    </div>
  </dialog>

  <!-- Scripts -->
  <script src="data/initial-data.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/file-sync.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
