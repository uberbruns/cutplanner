"""YAML serialization for inventory data."""

from typing import List
import yaml
from dataclasses import dataclass
import hashlib


@dataclass
class InventoryItem:
    """Represents a panel or sheet in inventory available for cutting."""
    type: str      # Material type (e.g., "MDF", "Plywood")
    length: float  # mm
    width: float   # mm
    thickness: float  # mm
    id: str = ""  # Stable ID derived from type and dimensions

    @property
    def label(self) -> str:
        length_cm = self.length / 10
        width_cm = self.width / 10
        return f"{self.type} {length_cm:g}x{width_cm:g}cm - {self.thickness:g}mm"

    def area_m2(self) -> float:
        """Calculate area in square meters."""
        return (self.length * self.width) / 1_000_000


def generate_inventory_id(type: str, length: float, width: float, thickness: float) -> str:
    """
    Generate a stable ID for an inventory item based on its properties.

    Args:
        type: Material type
        length: Length in mm
        width: Width in mm
        thickness: Thickness in mm

    Returns:
        Stable ID string
    """
    # Create a stable string representation
    data = f"{type}_{length}_{width}_{thickness}"
    # Generate a short hash
    hash_obj = hashlib.sha256(data.encode('utf-8'))
    return hash_obj.hexdigest()[:16]


def serialize_inventory_to_yaml(inventory_items: List[InventoryItem]) -> str:
    """
    Serialize a list of InventoryItem objects to YAML format.

    Args:
        inventory_items: List of InventoryItem objects to serialize

    Returns:
        YAML string representation of the inventory
    """
    data = {
        'inventory': []
    }

    for item in inventory_items:
        inventory_entry = {
            'type': item.type,
            'dimensions': {
                'length': item.length,
                'width': item.width,
                'thickness': item.thickness,
            }
        }
        data['inventory'].append(inventory_entry)

    return yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)


def deserialize_inventory_from_yaml(yaml_str: str) -> List[InventoryItem]:
    """
    Deserialize YAML string back to a list of InventoryItem objects.

    Args:
        yaml_str: YAML string representation of inventory

    Returns:
        List of InventoryItem objects
    """
    data = yaml.safe_load(yaml_str)
    inventory_items = []

    # Track indices for duplicate items to ensure unique IDs
    seen_items = {}

    for entry in data.get('inventory', []):
        dims = entry['dimensions']
        item_type = entry['type']
        length = dims['length']
        width = dims['width']
        thickness = dims['thickness']

        # Create a key for tracking duplicates
        base_key = f"{item_type}_{length}_{width}_{thickness}"

        # Increment index for this combination
        if base_key not in seen_items:
            seen_items[base_key] = 0
        else:
            seen_items[base_key] += 1

        index = seen_items[base_key]

        # Generate stable ID with index to ensure uniqueness
        item_id = generate_inventory_id(item_type, length, width, thickness)
        if index > 0:
            item_id = f"{item_id}_{index}"

        item = InventoryItem(
            type=item_type,
            length=length,
            width=width,
            thickness=thickness,
            id=item_id
        )
        inventory_items.append(item)

    return inventory_items


def save_inventory_to_yaml(inventory_items: List[InventoryItem], filepath: str) -> None:
    """
    Save inventory items to a YAML file.

    Args:
        inventory_items: List of InventoryItem objects to save
        filepath: Path to the output YAML file
    """
    yaml_content = serialize_inventory_to_yaml(inventory_items)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(yaml_content)


def load_inventory_from_yaml(filepath: str) -> List[InventoryItem]:
    """
    Load inventory items from a YAML file.

    Args:
        filepath: Path to the YAML file

    Returns:
        List of InventoryItem objects
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        yaml_content = f.read()
    return deserialize_inventory_from_yaml(yaml_content)
