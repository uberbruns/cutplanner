"""2D bin packing algorithm for panel layout."""

from typing import List, Tuple, Optional
from dataclasses import dataclass

from .models import Panel
from .inventory import InventoryItem


@dataclass
class PlacedPanel:
    panel: Panel
    x: float
    y: float
    rotated: bool


@dataclass
class Sheet:
    width: float
    height: float
    thickness: float
    placed_panels: List[PlacedPanel]
    label: str = ""  # Label from inventory item
    inventory_id: str = ""  # Stable ID of the inventory item used

    def area_used(self) -> float:
        total = 0.0
        for pp in self.placed_panels:
            panel_width = pp.panel.width if not pp.rotated else pp.panel.length
            panel_height = pp.panel.length if not pp.rotated else pp.panel.width
            total += panel_width * panel_height
        return total

    def utilization(self) -> float:
        sheet_area = self.width * self.height
        if sheet_area == 0:
            return 0.0
        return (self.area_used() / sheet_area) * 100


class Node:
    """Node in the binary tree for guillotine packing."""

    def __init__(self, x: float, y: float, width: float, height: float):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.used = False
        self.down: Optional[Node] = None
        self.right: Optional[Node] = None

    def insert(self, panel_width: float, panel_height: float) -> Optional[Tuple[float, float]]:
        if self.used:
            # Try inserting in children
            if self.right:
                result = self.right.insert(panel_width, panel_height)
                if result:
                    return result
            if self.down:
                result = self.down.insert(panel_width, panel_height)
                if result:
                    return result
            return None

        # Check if panel fits
        if panel_width > self.width or panel_height > self.height:
            return None

        # Perfect fit
        if panel_width == self.width and panel_height == self.height:
            self.used = True
            return (self.x, self.y)

        # Split the node
        self.used = True

        # Decide how to split
        dw = self.width - panel_width
        dh = self.height - panel_height

        if dw > dh:
            # Split horizontally
            self.right = Node(self.x + panel_width, self.y, dw, panel_height)
            self.down = Node(self.x, self.y + panel_height, self.width, dh)
        else:
            # Split vertically
            self.down = Node(self.x, self.y + panel_height, panel_width, dh)
            self.right = Node(self.x + panel_width, self.y, dw, self.height)

        return (self.x, self.y)


def pack_panels(panels: List[Panel], sheet_width: float, sheet_height: float,
                thickness: float, kerf: float = 0) -> List[Sheet]:
    """Pack panels onto sheets using guillotine algorithm."""

    # Filter panels by thickness
    panels_to_pack = [p for p in panels if p.thickness == thickness]

    # Sort panels by area (largest first)
    panels_to_pack.sort(key=lambda p: p.length * p.width, reverse=True)

    sheets = []
    current_sheet = Sheet(sheet_width, sheet_height, thickness, [])
    root = Node(0, 0, sheet_width, sheet_height)

    for panel in panels_to_pack:
        placed = False

        # Try both orientations
        for rotated in [False, True]:
            if rotated:
                panel_width = panel.length + kerf
                panel_height = panel.width + kerf
            else:
                panel_width = panel.width + kerf
                panel_height = panel.length + kerf

            # Try to place in current sheet
            position = root.insert(panel_width, panel_height)

            if position:
                current_sheet.placed_panels.append(PlacedPanel(
                    panel=panel,
                    x=position[0],
                    y=position[1],
                    rotated=rotated
                ))
                placed = True
                break

        # If not placed, start a new sheet
        if not placed:
            sheets.append(current_sheet)
            current_sheet = Sheet(sheet_width, sheet_height, thickness, [])
            root = Node(0, 0, sheet_width, sheet_height)

            # Try placing in new sheet
            for rotated in [False, True]:
                if rotated:
                    panel_width = panel.length + kerf
                    panel_height = panel.width + kerf
                else:
                    panel_width = panel.width + kerf
                    panel_height = panel.length + kerf

                position = root.insert(panel_width, panel_height)

                if position:
                    current_sheet.placed_panels.append(PlacedPanel(
                        panel=panel,
                        x=position[0],
                        y=position[1],
                        rotated=rotated
                    ))
                    placed = True
                    break

            # If still not placed, panel is too large
            if not placed:
                raise ValueError(f"Panel {panel.name} ({panel.width}×{panel.length}) too large for sheet ({sheet_width}×{sheet_height})")

    # Add the last sheet if it has panels
    if current_sheet.placed_panels:
        sheets.append(current_sheet)

    return sheets


def pack_panels_from_inventory(panels: List[Panel], inventory_items: List[InventoryItem],
                                 thickness: float, kerf: float = 0) -> Tuple[List[Sheet], List[Panel]]:
    """
    Pack panels onto available inventory sheets, preferring smaller sheets first.

    Args:
        panels: List of panels to pack
        inventory_items: List of available inventory sheets
        thickness: Thickness of panels to pack
        kerf: Saw blade width in mm

    Returns:
        Tuple of (sheets with placed panels, list of unpacked panels)
    """
    # Filter panels that are not ready and match thickness
    panels_to_pack = [p for p in panels if not p.ready and p.thickness == thickness]

    if not panels_to_pack:
        return [], []

    # Filter inventory items by thickness
    available_sheets = [item for item in inventory_items if item.thickness == thickness]

    if not available_sheets:
        # No sheets available, all panels remain unpacked
        return [], panels_to_pack

    # Sort panels by area (largest first) for better packing
    panels_to_pack.sort(key=lambda p: p.length * p.width, reverse=True)

    # Sort inventory sheets by area (smallest first) to prefer cutting small sheets
    available_sheets.sort(key=lambda item: item.length * item.width)

    used_sheets = []
    remaining_panels = panels_to_pack[:]

    # Try to pack panels into available sheets
    for inv_item in available_sheets:
        if not remaining_panels:
            break

        sheet = Sheet(inv_item.width, inv_item.length, thickness, [], inv_item.label, inv_item.id)
        root = Node(0, 0, inv_item.width, inv_item.length)

        panels_to_remove = []

        for panel in remaining_panels:
            placed = False

            # Try both orientations
            for rotated in [False, True]:
                if rotated:
                    panel_width = panel.length + kerf
                    panel_height = panel.width + kerf
                else:
                    panel_width = panel.width + kerf
                    panel_height = panel.length + kerf

                position = root.insert(panel_width, panel_height)

                if position:
                    sheet.placed_panels.append(PlacedPanel(
                        panel=panel,
                        x=position[0],
                        y=position[1],
                        rotated=rotated
                    ))
                    panels_to_remove.append(panel)
                    placed = True
                    break

        # Remove placed panels from remaining list
        for panel in panels_to_remove:
            remaining_panels.remove(panel)

        # Only add sheet if it has panels
        if sheet.placed_panels:
            used_sheets.append(sheet)

    return used_sheets, remaining_panels
