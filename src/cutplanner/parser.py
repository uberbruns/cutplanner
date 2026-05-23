"""Parser for OpenSCAD ECHO output."""

import json
import re
from typing import List

from .models import Panel


def parse_panels(output: str) -> List[Panel]:
    """Parse ECHO output to extract panel information."""
    panels = []
    pattern = re.compile(r'\{[^}]*\}')
    id_counter = {}  # Track how many times we've seen each base ID

    for line in output.splitlines():
        if "ECHO:" in line:
            match = pattern.search(line)
            if match:
                json_str = match.group(0)
                try:
                    data = json.loads(json_str)
                    name = data["name"]
                    length = data["length"]
                    width = data["width"]
                    thickness = data["thickness"]

                    # Generate base ID and track occurrence
                    base_id = Panel.generate_id(name, length, width, thickness)

                    # Append position to make ID unique (zero-based)
                    unique_id = f"{base_id}_{id_counter.get(base_id, 0)}"
                    id_counter[base_id] = id_counter.get(base_id, 0) + 1

                    panel = Panel(
                        name=name,
                        length=length,
                        width=width,
                        thickness=thickness,
                        id=unique_id,
                        path=data.get("path")
                    )
                    panels.append(panel)
                except (json.JSONDecodeError, KeyError):
                    pass

    return panels
