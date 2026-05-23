/**
 * Main application logic for the cutting layout viewer
 */

import { fetchConfig, fetchInventory, fetchBOM, generateLayout } from './api-client.js';
import { renderAllSheets } from './sheet-renderer.js';
import {
    savePanelState,
    clearAllStates,
    isPanelDone,
    savePanelIgnoreState,
    isPanelIgnored,
    toggleAllPanels,
    saveInventoryIgnoreState,
    isInventoryIgnored,
    toggleAllInventory
} from './panel-state.js';

const dim = mm => Math.round(mm / 10 * 1000) / 1000;

// Track currently selected panel
let selectedPanel = null;

// Track currently selected panel ID
let selectedPanelId = null;

// Current configuration
let currentConfig = null;

// Store all panels data
let allPanelsData = [];

// Store inventory data
let inventoryData = [];

// Store sheets data
let sheetsData = [];

// Store unpacked panels
let unpackedPanels = [];

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

/**
 * Display configuration in the header
 * @param {Object} config - Configuration object
 */
function displayConfig(config) {
    document.getElementById('config-scad-file').textContent = config.scad_file;
    document.getElementById('config-inventory-file').textContent = config.inventory_file;
    document.getElementById('config-kerf').textContent = `${config.kerf} mm`;
}

/**
 * Load and render the cutting layout
 */
async function loadAndRenderLayout() {
    try {
        // Fetch inventory and BOM
        const [invData, bomData] = await Promise.all([
            fetchInventory(),
            fetchBOM()
        ]);

        // Store data globally
        inventoryData = invData.inventory;
        allPanelsData = bomData.panels;

        // Filter out ignored panels and inventory
        const activePanels = bomData.panels.filter(panel => !isPanelIgnored(panel.id));
        const activeInventory = inventoryData.filter(item => !isInventoryIgnored(item.id));

        // Generate cutting layout
        const layoutData = await generateLayout(
            activePanels,
            activeInventory,
            currentConfig.kerf
        );

        // Store sheets and unpacked panels data
        sheetsData = layoutData.sheets;
        unpackedPanels = layoutData.unpacked_panels;

        // Render sheets sorted by inventory order
        const sheetsHtml = renderAllSheets(layoutData.sheets, inventoryData);
        document.getElementById('sheets-container').innerHTML = sheetsHtml;

        // Set up panel click handlers
        setupPanelHandlers();

        // Populate inspector tables
        populatePanelsTable();
        populateSheetsAndInventoryTable();

    } catch (error) {
        console.error('Failed to load layout:', error);
        showError(`Failed to generate layout: ${error.message}`);
    }
}

/**
 * Save section collapsed state to localStorage
 */
function saveSectionState(sectionName, isCollapsed) {
    try {
        const states = JSON.parse(localStorage.getItem('sectionStates') || '{}');
        states[sectionName] = isCollapsed;
        localStorage.setItem('sectionStates', JSON.stringify(states));
    } catch (e) {
        console.error('Failed to save section state:', e);
    }
}

/**
 * Load section collapsed state from localStorage
 */
function loadSectionState(sectionName) {
    try {
        const states = JSON.parse(localStorage.getItem('sectionStates') || '{}');
        return states[sectionName] || false;
    } catch (e) {
        console.error('Failed to load section state:', e);
        return false;
    }
}

/**
 * Setup collapsible inspector sections
 */
function setupInspectorSections() {
    const headers = document.querySelectorAll('.inspector-section-header');

    headers.forEach(header => {
        const section = header.parentElement;
        const sectionName = header.dataset.section;

        // Load saved state
        const isCollapsed = loadSectionState(sectionName);
        if (isCollapsed) {
            section.classList.add('collapsed');
        }

        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
            const newState = section.classList.contains('collapsed');
            saveSectionState(sectionName, newState);
        });
    });
}

/**
 * Populate unified sheets and inventory table
 */
function populateSheetsAndInventoryTable() {
    const tbody = document.getElementById('sheets-table-body');
    const rows = [];

    // Create a map of used inventory items by ID
    const usedInventory = new Map();
    sheetsData.forEach((sheet, index) => {
        const inventoryId = sheet.inventory_id;
        if (!usedInventory.has(inventoryId)) {
            usedInventory.set(inventoryId, []);
        }
        usedInventory.get(inventoryId).push({
            sheetIndex: index,
            sheetNum: index + 1,
            panelCount: sheet.placed_panels.length,
            utilization: sheet.utilization_percent
        });
    });

    // Find which inventory item contains the selected panel
    let selectedInventoryId = null;
    if (selectedPanelId) {
        for (const sheet of sheetsData) {
            const hasPanel = sheet.placed_panels.some(pp => pp.panel.id === selectedPanelId);
            if (hasPanel) {
                selectedInventoryId = sheet.inventory_id;
                break;
            }
        }
    }

    // Iterate through inventory and show usage status
    inventoryData.forEach((item) => {
        const size = `${dim(item.length)} × ${dim(item.width)}`;
        const usage = usedInventory.get(item.id);
        const isIgnored = isInventoryIgnored(item.id);
        const isIncluded = !isIgnored;
        const excludedClass = isIgnored ? 'excluded' : '';
        const isSelected = selectedInventoryId === item.id;
        const selectedClass = isSelected ? 'selected' : '';
        const includeActiveClass = isIncluded ? 'active' : '';

        if (usage && usage.length > 0) {
            // This inventory item is being used as a sheet
            usage.forEach(({sheetIndex, sheetNum, panelCount, utilization}) => {
                const inventoryStatusClass = isIncluded ? 'inventory-used' : '';
                rows.push(`
                    <tr data-sheet-index="${sheetIndex}" data-inventory-id="${item.id}" class="sheet-row ${excludedClass} ${selectedClass}" title="${panelCount} panels, ${utilization}%">
                        <td>${item.label}</td>
                        <td>${size}</td>
                        <td>${item.thickness}</td>
                        <td class="actions-cell">
                            <div class="icon-btn include-btn ${includeActiveClass} ${inventoryStatusClass}" data-inventory-id="${item.id}" data-action="include" title="Include in layout">
                                <span class="material-icons">add_box</span>
                            </div>
                        </td>
                    </tr>
                `);
            });
        } else {
            // This inventory item is available (not used)
            const inventoryStatusClass = isIncluded ? 'inventory-unused' : '';
            rows.push(`
                <tr data-inventory-id="${item.id}" class="inventory-row ${excludedClass} ${selectedClass}">
                    <td>${item.label}</td>
                    <td>${size}</td>
                    <td>${item.thickness}</td>
                    <td class="actions-cell">
                        <div class="icon-btn include-btn ${includeActiveClass} ${inventoryStatusClass}" data-inventory-id="${item.id}" data-action="include" title="Include in layout">
                            <span class="material-icons">add_box</span>
                        </div>
                    </td>
                </tr>
            `);
        }
    });

    tbody.innerHTML = rows.join('');

    // Add icon button click handlers for inventory
    const inventoryIconButtons = tbody.querySelectorAll('.icon-btn');
    inventoryIconButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const inventoryId = button.dataset.inventoryId;
            const action = button.dataset.action;

            if (action === 'include') {
                const isIgnored = isInventoryIgnored(inventoryId);
                // Toggle: if currently ignored, un-ignore it; if included, ignore it
                saveInventoryIgnoreState(inventoryId, !isIgnored);
                // Reload layout to reflect changes
                loadAndRenderLayout();
            }
        });
    });

    // Add click handlers to sheet rows to scroll to that sheet
    const sheetRows = tbody.querySelectorAll('.sheet-row');
    sheetRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking icon buttons
            if (e.target.closest('.icon-btn')) return;

            const sheetIndex = parseInt(row.dataset.sheetIndex);
            const sheetContainers = document.querySelectorAll('.sheet-container');
            if (sheetContainers[sheetIndex]) {
                sheetContainers[sheetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Update sheets summary
    updateSheetsSummary();
}

/**
 * Populate panels list table
 */
function populatePanelsTable() {
    const tbody = document.getElementById('panels-table-body');

    // Create a set of unpacked panel IDs for quick lookup
    const unpackedPanelIds = new Set(unpackedPanels.map(p => p.id));

    const rows = allPanelsData.map(panel => {
        const isDone = isPanelDone(panel.id);
        const isIgnored = isPanelIgnored(panel.id);
        const isIncluded = !isIgnored; // Inverted logic
        const isUnpacked = unpackedPanelIds.has(panel.id);

        const excludedClass = isIgnored ? 'excluded' : '';
        const isSelected = selectedPanelId === panel.id;
        const selectedClass = isSelected ? 'selected' : '';

        const doneActiveClass = isDone ? 'active' : '';
        // Red if unpacked, active (blue) if included and packed, gray if excluded
        let includeActiveClass = '';
        if (isUnpacked && isIncluded) {
            includeActiveClass = 'error'; // Red when can't be placed
        } else if (isIncluded) {
            includeActiveClass = 'active'; // Blue when included and placed
        }

        return `
            <tr data-panel-id="${panel.id}" class="${excludedClass} ${selectedClass}">
                <td>${panel.name}</td>
                <td>${dim(panel.width)} × ${dim(panel.length)}</td>
                <td>${panel.thickness}</td>
                <td class="actions-cell">
                    <div class="icon-btn include-btn ${includeActiveClass}" data-panel-id="${panel.id}" data-action="include" title="${isUnpacked && isIncluded ? 'Cannot be placed - insufficient inventory' : 'Include in layout'}">
                        <span class="material-icons">vertical_align_bottom</span>
                    </div>
                    <div class="icon-btn done-btn ${doneActiveClass}" data-panel-id="${panel.id}" data-action="done" title="Mark as done">
                        <span class="material-icons">check_circle</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;

    // Add icon button click handlers
    const iconButtons = tbody.querySelectorAll('.icon-btn');
    iconButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const panelId = button.dataset.panelId;
            const action = button.dataset.action;

            if (action === 'done') {
                const isDone = isPanelDone(panelId);
                savePanelState(panelId, !isDone);
                populatePanelsTable();
                // Update SVG if panel is visible
                const panelElement = document.querySelector(`[data-stable-id="${panelId}"]`);
                if (panelElement) {
                    if (!isDone) {
                        panelElement.classList.add('done');
                    } else {
                        panelElement.classList.remove('done');
                    }
                }
            } else if (action === 'include') {
                const isIgnored = isPanelIgnored(panelId);
                // Toggle: if currently ignored, un-ignore it; if included, ignore it
                savePanelIgnoreState(panelId, !isIgnored);
                // Reload layout to reflect changes
                loadAndRenderLayout();
            }
        });
    });

    // Add click handlers to panel rows (excluding icon button clicks)
    const panelRows = tbody.querySelectorAll('tr');
    panelRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking icon buttons
            if (e.target.closest('.icon-btn')) return;

            const panelId = row.dataset.panelId;

            // Find the panel data
            const panel = allPanelsData.find(p => p.id === panelId);
            if (panel) {
                // Show panel details in inspector even if not in SVG
                showPanelDetails(panel);

                // Try to find and scroll to the SVG element if it exists
                const panelElement = document.querySelector(`[data-stable-id="${panelId}"]`);
                if (panelElement) {
                    selectPanel(panelElement);
                    panelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    // Clear SVG selection if panel is not in layout
                    if (selectedPanel) {
                        selectedPanel.classList.remove('selected');
                        selectedPanel = null;
                    }
                }
            }
        });
    });

    // Update summary
    updatePanelsSummary();
}

/**
 * Update panels summary
 */
function updatePanelsSummary() {
    const totalPanels = allPanelsData.length;
    const donePanels = allPanelsData.filter(p => isPanelDone(p.id)).length;
    const pendingPanels = totalPanels - donePanels;

    const summaryHtml = `
        <div><strong>Total:</strong> <span>${totalPanels}</span></div>
        <div><strong>Done:</strong> <span>${donePanels}</span></div>
        <div><strong>Pending:</strong> <span>${pendingPanels}</span></div>
    `;

    document.getElementById('panels-summary').innerHTML = summaryHtml;
}


/**
 * Update sheets summary
 */
function updateSheetsSummary() {
    const totalSheets = sheetsData.length;
    const totalPanelsPlaced = sheetsData.reduce((sum, sheet) => sum + sheet.placed_panels.length, 0);
    const avgUtilization = sheetsData.length > 0
        ? (sheetsData.reduce((sum, sheet) => sum + sheet.utilization_percent, 0) / sheetsData.length)
        : 0;

    const summaryHtml = `
        <div><strong>Total Sheets:</strong> <span>${totalSheets}</span></div>
        <div><strong>Panels Placed:</strong> <span>${totalPanelsPlaced}</span></div>
        <div><strong>Avg. Utilization:</strong> <span>${Math.round(avgUtilization * 10) / 10}%</span></div>
    `;

    document.getElementById('sheets-summary').innerHTML = summaryHtml;
}

/**
 * Set up click handlers for all panels
 */
function setupPanelHandlers() {
    const panels = document.querySelectorAll('.panel');

    panels.forEach(panel => {
        panel.addEventListener('click', (event) => {
            event.stopPropagation();
            selectPanel(panel);
        });
    });
}

/**
 * Show panel details in inspector
 * @param {Object} panel - Panel data object
 */
function showPanelDetails(panel) {
    // Update selected panel ID
    selectedPanelId = panel.id;

    // Update inspector display
    document.getElementById('inspector-panel-name').textContent = panel.name;
    document.getElementById('inspector-panel-id').textContent = panel.id;
    document.getElementById('inspector-panel-dimensions').textContent = `${dim(panel.width)} cm × ${dim(panel.length)} cm`;
    document.getElementById('inspector-panel-thickness').textContent = `${panel.thickness} mm`;

    // Update action button states
    updateInspectorActionButtons(panel.id);

    // Show panel details, hide empty state
    document.getElementById('inspector-empty-state').style.display = 'none';
    document.getElementById('inspector-panel-details').style.display = 'block';

    // Refresh tables to update bold styling
    populatePanelsTable();
    populateSheetsAndInventoryTable();
}

/**
 * Update inspector action button states
 * @param {string} panelId - Panel ID
 */
function updateInspectorActionButtons(panelId) {
    const includeBtn = document.getElementById('inspector-include-btn');
    const doneBtn = document.getElementById('inspector-done-btn');

    const isDone = isPanelDone(panelId);
    const isIgnored = isPanelIgnored(panelId);
    const isIncluded = !isIgnored;

    // Check if panel is unpacked
    const unpackedPanelIds = new Set(unpackedPanels.map(p => p.id));
    const isUnpacked = unpackedPanelIds.has(panelId);

    // Update include button
    includeBtn.classList.remove('active', 'error');
    if (isUnpacked && isIncluded) {
        includeBtn.classList.add('error');
    } else if (isIncluded) {
        includeBtn.classList.add('active');
    }

    // Update done button
    doneBtn.classList.remove('active');
    if (isDone) {
        doneBtn.classList.add('active');
    }
}

/**
 * Handle inspector include button click
 */
function handleInspectorIncludeClick() {
    if (!selectedPanelId) return;

    const isIgnored = isPanelIgnored(selectedPanelId);
    savePanelIgnoreState(selectedPanelId, !isIgnored);
    loadAndRenderLayout();
}

/**
 * Handle inspector done button click
 */
function handleInspectorDoneClick() {
    if (!selectedPanelId) return;

    const isDone = isPanelDone(selectedPanelId);
    savePanelState(selectedPanelId, !isDone);

    // Update SVG if panel is visible
    const panelElement = document.querySelector(`[data-stable-id="${selectedPanelId}"]`);
    if (panelElement) {
        if (!isDone) {
            panelElement.classList.add('done');
        } else {
            panelElement.classList.remove('done');
        }
    }

    // Update button states and table
    updateInspectorActionButtons(selectedPanelId);
    populatePanelsTable();
}

/**
 * Select a panel and show its info
 * @param {HTMLElement} panelElement - The panel rect element
 */
function selectPanel(panelElement) {
    // Deselect previous panel
    if (selectedPanel) {
        selectedPanel.classList.remove('selected');
    }

    // Select new panel
    selectedPanel = panelElement;
    panelElement.classList.add('selected');

    // Get panel data from element
    const panelId = panelElement.dataset.stableId;
    const panel = allPanelsData.find(p => p.id === panelId);

    if (panel) {
        showPanelDetails(panel);
    }
}

/**
 * Deselect the current panel
 */
function deselectPanel() {
    if (selectedPanel) {
        selectedPanel.classList.remove('selected');
        selectedPanel = null;
    }

    selectedPanelId = null;

    // Show empty state, hide panel details
    document.getElementById('inspector-empty-state').style.display = 'block';
    document.getElementById('inspector-panel-details').style.display = 'none';

    // Refresh tables to update bold styling
    populatePanelsTable();
    populateSheetsAndInventoryTable();
}

/**
 * Handle panel done state toggle
 * @param {string} panelId - Panel ID
 * @param {boolean} isDone - New done state
 */
function handlePanelDoneToggle(panelId, isDone) {
    // Save to localStorage
    savePanelState(panelId, isDone);

    // Update panel visual state in SVG
    const panelElement = document.querySelector(`[data-stable-id="${panelId}"]`);
    if (panelElement) {
        if (isDone) {
            panelElement.classList.add('done');
        } else {
            panelElement.classList.remove('done');
        }
    }

    // Update panels table to reflect new state
    populatePanelsTable();
}

/**
 * Handle refresh button click
 */
async function handleRefresh() {
    deselectPanel();
    await loadAndRenderLayout();
}

/**
 * Handle clear done state button click
 */
function handleClearDoneState() {
    if (clearAllStates()) {
        // Reload to update visual states
        loadAndRenderLayout();
    }
}

/**
 * Handle select all panels
 */
function handleSelectAllPanels() {
    const panelIds = allPanelsData.map(p => p.id);
    toggleAllPanels(false, panelIds);
    loadAndRenderLayout();
}

/**
 * Handle include open panels (not done)
 */
function handleIncludeOpenPanels() {
    const openPanelIds = allPanelsData
        .filter(p => !isPanelDone(p.id))
        .map(p => p.id);

    // Include all open panels (set ignored to false)
    toggleAllPanels(false, openPanelIds);

    // Exclude all done panels (set ignored to true)
    const donePanelIds = allPanelsData
        .filter(p => isPanelDone(p.id))
        .map(p => p.id);
    toggleAllPanels(true, donePanelIds);

    loadAndRenderLayout();
}

/**
 * Handle deselect all panels
 */
function handleDeselectAllPanels() {
    const panelIds = allPanelsData.map(p => p.id);
    toggleAllPanels(true, panelIds);
    loadAndRenderLayout();
}

/**
 * Handle select all inventory
 */
function handleSelectAllInventory() {
    const inventoryIds = inventoryData.map(i => i.id);
    toggleAllInventory(false, inventoryIds);
    loadAndRenderLayout();
}

/**
 * Handle deselect all inventory
 */
function handleDeselectAllInventory() {
    const inventoryIds = inventoryData.map(i => i.id);
    toggleAllInventory(true, inventoryIds);
    loadAndRenderLayout();
}

/**
 * Handle reload panels - refetch BOM data and regenerate layout
 */
async function handleReloadPanels() {
    await loadAndRenderLayout();
}

/**
 * Handle reload inventory - refetch inventory data and regenerate layout
 */
async function handleReloadInventory() {
    await loadAndRenderLayout();
}

/**
 * Initialize the application
 */
async function init() {
    try {
        // Fetch configuration
        currentConfig = await fetchConfig();
        displayConfig(currentConfig);

        // Set up collapsible inspector sections
        setupInspectorSections();

        // Set up button handlers
        document.getElementById('refresh-button').addEventListener('click', handleRefresh);
        document.getElementById('clear-done-button').addEventListener('click', handleClearDoneState);

        // Set up bulk action handlers
        document.getElementById('select-all-panels-btn').addEventListener('click', handleSelectAllPanels);
        document.getElementById('include-open-panels-btn').addEventListener('click', handleIncludeOpenPanels);
        document.getElementById('deselect-all-panels-btn').addEventListener('click', handleDeselectAllPanels);
        document.getElementById('reload-panels-btn').addEventListener('click', handleReloadPanels);
        document.getElementById('select-all-inventory-btn').addEventListener('click', handleSelectAllInventory);
        document.getElementById('deselect-all-inventory-btn').addEventListener('click', handleDeselectAllInventory);
        document.getElementById('reload-inventory-btn').addEventListener('click', handleReloadInventory);

        // Set up inspector action button handlers
        document.getElementById('inspector-include-btn').addEventListener('click', handleInspectorIncludeClick);
        document.getElementById('inspector-done-btn').addEventListener('click', handleInspectorDoneClick);

        // Load initial layout
        await loadAndRenderLayout();

    } catch (error) {
        console.error('Failed to initialize app:', error);
        showError(`Failed to initialize: ${error.message}`);
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
