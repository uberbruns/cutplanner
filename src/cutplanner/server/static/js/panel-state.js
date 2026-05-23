/**
 * Panel state management using localStorage
 * Stores panel states as objects with done and ignored status
 */

// LocalStorage keys
const STORAGE_KEY = 'cutting_layout_panel_states';
const INVENTORY_STORAGE_KEY = 'cutting_layout_inventory_states';

/**
 * Load all panel states from localStorage
 * @returns {Object} Panel states object {panelId: {done, ignored}, ...}
 */
export function loadPanelStates() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Failed to load panel states from localStorage:', e);
        return {};
    }
}

/**
 * Save or update panel state
 * @param {string} panelId - Unique panel ID
 * @param {boolean} isDone - Whether panel is marked as done
 */
export function savePanelState(panelId, isDone) {
    try {
        const states = loadPanelStates();
        if (!states[panelId]) {
            states[panelId] = {};
        }
        states[panelId].done = isDone;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to save panel state to localStorage:', e);
    }
}

/**
 * Get state for a specific panel
 * @param {string} panelId - Unique panel ID
 * @returns {Object|null} Panel state object or null if not found
 */
export function getPanelState(panelId) {
    const states = loadPanelStates();
    return states[panelId] || null;
}

/**
 * Check if panel is marked as done
 * @param {string} panelId - Unique panel ID
 * @returns {boolean} True if panel is done, false otherwise
 */
export function isPanelDone(panelId) {
    const state = getPanelState(panelId);
    return state ? state.done === true : false;
}

/**
 * Clear all panel and inventory states from localStorage
 * @returns {boolean} True if cleared, false if cancelled
 */
export function clearAllStates() {
    if (confirm('Clear all local storage (done states and ignored items)? This cannot be undone.')) {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(INVENTORY_STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Failed to clear states from localStorage:', e);
            return false;
        }
    }
    return false;
}

/**
 * Delete a specific panel state
 * @param {string} panelId - Unique panel ID
 */
export function deletePanelState(panelId) {
    try {
        const states = loadPanelStates();
        delete states[panelId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to delete panel state from localStorage:', e);
    }
}

// === Panel Ignore State ===

/**
 * Save panel ignore state
 * @param {string} panelId - Unique panel ID
 * @param {boolean} isIgnored - Whether panel is ignored
 */
export function savePanelIgnoreState(panelId, isIgnored) {
    try {
        const states = loadPanelStates();
        if (!states[panelId]) {
            states[panelId] = {};
        }
        states[panelId].ignored = isIgnored;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to save panel ignore state to localStorage:', e);
    }
}

/**
 * Check if panel is ignored
 * @param {string} panelId - Unique panel ID
 * @returns {boolean} True if panel is ignored
 */
export function isPanelIgnored(panelId) {
    const state = getPanelState(panelId);
    return state ? state.ignored === true : false;
}

/**
 * Toggle all panels ignore state
 * @param {boolean} isIgnored - Whether to ignore all panels
 * @param {Array<string>} panelIds - Array of all panel IDs
 */
export function toggleAllPanels(isIgnored, panelIds) {
    try {
        const states = loadPanelStates();
        panelIds.forEach(id => {
            if (!states[id]) {
                states[id] = {};
            }
            states[id].ignored = isIgnored;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to toggle all panels:', e);
    }
}

// === Inventory State ===

/**
 * Load all inventory states from localStorage
 * @returns {Object} Inventory states {inventoryId: {ignored}, ...}
 */
function loadInventoryStates() {
    try {
        const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Failed to load inventory states from localStorage:', e);
        return {};
    }
}

/**
 * Save inventory ignore state
 * @param {string} inventoryId - Unique inventory ID
 * @param {boolean} isIgnored - Whether inventory item is ignored
 */
export function saveInventoryIgnoreState(inventoryId, isIgnored) {
    try {
        const states = loadInventoryStates();
        if (!states[inventoryId]) {
            states[inventoryId] = {};
        }
        states[inventoryId].ignored = isIgnored;
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to save inventory ignore state to localStorage:', e);
    }
}

/**
 * Check if inventory item is ignored
 * @param {string} inventoryId - Unique inventory ID
 * @returns {boolean} True if inventory item is ignored
 */
export function isInventoryIgnored(inventoryId) {
    const states = loadInventoryStates();
    return states[inventoryId]?.ignored === true;
}

/**
 * Toggle all inventory items ignore state
 * @param {boolean} isIgnored - Whether to ignore all inventory items
 * @param {Array<string>} inventoryIds - Array of all inventory IDs
 */
export function toggleAllInventory(isIgnored, inventoryIds) {
    try {
        const states = loadInventoryStates();
        inventoryIds.forEach(id => {
            if (!states[id]) {
                states[id] = {};
            }
            states[id].ignored = isIgnored;
        });
        localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('Failed to toggle all inventory:', e);
    }
}
