/**
 * API client for communicating with the Flask backend
 */

const API_BASE = '/api';

/**
 * Fetch server configuration
 * @returns {Promise<{scad_file: string, inventory_file: string, kerf: number}>}
 */
export async function fetchConfig() {
    const response = await fetch(`${API_BASE}/config`);
    if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Fetch inventory from configured file
 * @returns {Promise<{inventory: Array}>}
 */
export async function fetchInventory() {
    const response = await fetch(`${API_BASE}/inventory`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to fetch inventory: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Fetch BOM (bill of materials) by rendering OpenSCAD
 * @returns {Promise<{panels: Array}>}
 */
export async function fetchBOM() {
    const response = await fetch(`${API_BASE}/bom`);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to fetch BOM: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Generate cutting layout from panels and inventory
 * @param {Array} panels - Array of panel objects
 * @param {Array} inventory - Array of inventory item objects
 * @param {number} kerf - Saw blade kerf in mm
 * @returns {Promise<{sheets: Array, unpacked_panels: Array, summary: Object}>}
 */
export async function generateLayout(panels, inventory, kerf) {
    const response = await fetch(`${API_BASE}/cutting-layout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            panels,
            inventory,
            kerf
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to generate layout: ${response.statusText}`);
    }

    return await response.json();
}
