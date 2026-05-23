/**
 * Sheet rendering module for generating SVG visualizations
 */

import { isPanelDone } from './panel-state.js';

/**
 * Render unpacked panels warning section
 * @param {Array} unpackedPanels - Array of panel objects that couldn't be placed
 * @returns {string} HTML string
 */
export function renderUnpackedPanels(unpackedPanels) {
    if (!unpackedPanels || unpackedPanels.length === 0) {
        return '';
    }

    const rows = unpackedPanels.map(panel => `
        <tr>
            <td>${panel.name}</td>
            <td>${(panel.width / 10)} cm × ${(panel.length / 10)} cm</td>
            <td>${panel.thickness} mm</td>
            <td class="panel-id-cell">${panel.id}</td>
        </tr>
    `).join('');

    return `
        <div class="unpacked-section">
            <h2>⚠️ Unpacked Panels</h2>
            <p class="unpacked-warning">
                ${unpackedPanels.length} panel(s) could not be placed due to insufficient inventory.
                Please add more sheets to your inventory or mark some panels as ready.
            </p>
            <table class="unpacked-table">
                <thead>
                    <tr>
                        <th>Panel Name</th>
                        <th>Dimensions</th>
                        <th>Thickness</th>
                        <th>ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Render summary statistics
 * @param {Object} summary - Summary object from API
 * @param {Array} sheets - Array of sheet objects for calculating utilization
 * @returns {string} HTML string
 */
export function renderSummary(summary, sheets) {
    const avgUtilization = sheets.length > 0
        ? sheets.reduce((sum, sheet) => sum + sheet.utilization_percent, 0) / sheets.length
        : 0;

    const thickness = sheets.length > 0 ? sheets[0].thickness : 0;

    return `
        <div class="summary">
            <div><strong>Total Sheets:</strong> ${summary.total_sheets}</div>
            <div><strong>Total Panels:</strong> ${summary.total_panels_placed}</div>
            <div><strong>Thickness:</strong> ${thickness} mm</div>
            <div><strong>Average Utilization:</strong> ${avgUtilization}%</div>
        </div>
    `;
}

/**
 * Create SVG definition and clip path for a placed panel
 * @param {Object} placedPanel - Placed panel object from API
 * @param {number} panelId - Sequential panel ID for the page
 * @returns {string} SVG defs content as string
 */
function createPanelDef(placedPanel, panelId) {
    const { x, y, rotated, panel } = placedPanel;
    const panelWidth = rotated ? panel.length : panel.width;
    const panelHeight = rotated ? panel.width : panel.length;

    return `
        <rect id="panel-shape-${panelId}" x="${x}" y="${y}" width="${panelWidth}" height="${panelHeight}"/>
        <clipPath id="panel-clip-${panelId}">
            <use xlink:href="#panel-shape-${panelId}"/>
        </clipPath>
    `;
}

/**
 * Create an SVG use element for a placed panel with clipped stroke
 * @param {Object} placedPanel - Placed panel object from API
 * @param {number} panelId - Sequential panel ID for the page
 * @returns {string} SVG use element as string
 */
function createPanelRect(placedPanel, panelId) {
    const { panel, rotated } = placedPanel;

    // Calculate display dimensions based on rotation
    const panelWidth = rotated ? panel.length : panel.width;
    const panelHeight = rotated ? panel.width : panel.length;

    // Check if panel is marked as done
    const isDone = isPanelDone(panel.id);
    const doneClass = isDone ? ' done' : '';

    return `
        <use xlink:href="#panel-shape-${panelId}"
             class="panel${doneClass}"
             id="panel-${panelId}"
             data-stable-id="${panel.id}"
             clip-path="url(#panel-clip-${panelId})">
            <title>${panel.name}
${(panelWidth / 10)} cm × ${(panelHeight / 10)} cm</title>
        </use>
    `;
}

/**
 * Create SVG text elements for a placed panel
 * @param {Object} placedPanel - Placed panel object from API
 * @returns {string} SVG text elements as string
 */
function createPanelText(placedPanel) {
    const { panel, x, y, rotated } = placedPanel;

    const panelWidth = rotated ? panel.length : panel.width;
    const panelHeight = rotated ? panel.width : panel.length;

    const textX = x + panelWidth / 2;
    const textY = y + panelHeight / 2;
    const rotation = rotated ? "90" : "0";

    // Truncate long panel names
    const displayName = panel.name.length > 20 ? panel.name.substring(0, 20) : panel.name;

    return `
        <text class="panel-text"
              x="${textX}"
              y="${textY}"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(${rotation} ${textX} ${textY})">
            ${displayName}
        </text>
        <text class="dimension-text"
              x="${textX}"
              y="${textY + 45}"
              text-anchor="middle"
              transform="rotate(${rotation} ${textX} ${textY})">
            ${(panelWidth / 10)} × ${(panelHeight / 10)} cm
        </text>
    `;
}

/**
 * Render a single sheet with its panels
 * @param {Object} sheet - Sheet object from API
 * @param {number} startPanelId - Starting panel ID counter
 * @returns {{html: string, panelCount: number}} HTML string and number of panels rendered
 */
export function renderSheet(sheet, startPanelId) {
    // Calculate SVG scale for visualization
    const maxWidth = sheet.width;
    const maxHeight = sheet.height;
    const scale = Math.min(800 / maxWidth, 600 / maxHeight) * 3;

    const svgWidth = sheet.width * scale;
    const svgHeight = sheet.height * scale;

    // Calculate area used
    const areaUsed = sheet.placed_panels.reduce((sum, pp) => {
        const panelWidth = pp.rotated ? pp.panel.length : pp.panel.width;
        const panelHeight = pp.rotated ? pp.panel.width : pp.panel.length;
        return sum + (panelWidth * panelHeight);
    }, 0) / 1_000_000; // Convert mm² to m²

    // Generate panel elements
    let panelId = startPanelId;
    const panelDefs = [];
    const panelRects = [];
    const panelTexts = [];

    for (const placedPanel of sheet.placed_panels) {
        panelDefs.push(createPanelDef(placedPanel, panelId));
        panelRects.push(createPanelRect(placedPanel, panelId));
        panelTexts.push(createPanelText(placedPanel));
        panelId++;
    }

    const html = `
        <div class="sheet-container">
            <div class="sheet-header">
                <div class="sheet-title">${sheet.label}</div>
                <div class="sheet-info">
                    Size: ${(sheet.width / 10)} cm × ${(sheet.height / 10)} cm |
                    Panels: ${sheet.placed_panels.length} |
                    Utilization: ${sheet.utilization_percent}% |
                    Area used: ${areaUsed} m²
                </div>
            </div>
            <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${sheet.width} ${sheet.height}">
                <defs>
                    ${panelDefs.join('\n')}
                </defs>
                ${panelRects.join('\n')}
                ${panelTexts.join('\n')}
            </svg>
        </div>
    `;

    return {
        html,
        panelCount: sheet.placed_panels.length
    };
}

/**
 * Render all sheets sorted by inventory order
 * @param {Array} sheets - Array of sheet objects from API
 * @param {Array} inventoryData - Inventory items in YAML order
 * @returns {string} HTML string
 */
export function renderAllSheets(sheets, inventoryData) {
    // Create a map of inventory IDs to their order
    const inventoryOrder = new Map();
    inventoryData.forEach((item, index) => {
        inventoryOrder.set(item.id, index);
    });

    // Sort sheets by inventory order
    const sortedSheets = [...sheets].sort((a, b) => {
        const orderA = inventoryOrder.get(a.inventory_id) ?? Infinity;
        const orderB = inventoryOrder.get(b.inventory_id) ?? Infinity;
        return orderA - orderB;
    });

    let panelId = 1;
    const sheetHtmls = [];

    sortedSheets.forEach((sheet) => {
        const result = renderSheet(sheet, panelId);
        sheetHtmls.push(result.html);
        panelId += result.panelCount;
    });

    return sheetHtmls.join('\n');
}
