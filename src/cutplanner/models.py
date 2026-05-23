"""Data models for BOM generation."""

from dataclasses import dataclass
from typing import List, Optional
from collections import Counter


@dataclass
class Panel:
    name: str
    length: float
    width: float
    thickness: float
    id: str = ""  # Stable identifier, generated at creation
    path: Optional[List[str]] = None
    ready: bool = False

    def size_key(self) -> tuple:
        return (self.length, self.width, self.thickness)

    def area_m2(self) -> float:
        return (self.length * self.width) / 1_000_000

    @staticmethod
    def generate_id(name: str, length: float, width: float, thickness: float) -> str:
        """
        Generate a stable identifier for a panel.

        Format: name_length_width_thickness (lowercase, alphanumeric + underscores)
        Example: "cabinet_back_1200_800_16"
        """
        import re
        # Normalize name: lowercase, replace spaces and special chars with underscores
        normalized_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
        # Create stable ID with dimensions
        return f"{normalized_name}_{int(length)}_{int(width)}_{int(thickness)}"


@dataclass
class BOMItem:
    length: float
    width: float
    thickness: float
    panels: List[Panel]

    def count(self) -> int:
        return len(self.panels)

    def area_m2(self) -> float:
        return (self.length * self.width) / 1_000_000

    def consolidated_names(self) -> str:
        name_counts = Counter(p.name for p in self.panels)
        names = []
        for name in sorted(name_counts.keys()):
            count = name_counts[name]
            if count > 1:
                names.append(f"{name} ({count}x)")
            else:
                names.append(name)
        return ", ".join(names)
