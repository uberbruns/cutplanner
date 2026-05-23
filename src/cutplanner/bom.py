import sys
import os
import argparse
from typing import List
import yaml

from .models import Panel
from .openscad import render_openscad
from .parser import parse_panels


def serialize_bom_to_yaml(panels: List[Panel]) -> str:
    data = {
        'panels': [
            {
                'name': panel.name,
                'length': panel.length,
                'width': panel.width,
                'thickness': panel.thickness,
            }
            for panel in panels
        ]
    }
    return yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)


def deserialize_bom_from_yaml(yaml_str: str) -> List[Panel]:
    data = yaml.safe_load(yaml_str)
    id_counter = {}
    panels = []

    for entry in data.get('panels', []):
        name = entry['name']
        length = entry['length']
        width = entry['width']
        thickness = entry['thickness']

        base_id = Panel.generate_id(name, length, width, thickness)
        unique_id = f"{base_id}_{id_counter.get(base_id, 0)}"
        id_counter[base_id] = id_counter.get(base_id, 0) + 1

        panels.append(Panel(
            name=name,
            length=length,
            width=width,
            thickness=thickness,
            id=unique_id,
            ready=entry.get('ready', False),
        ))

    return panels


def load_bom_from_yaml(filepath: str) -> List[Panel]:
    with open(filepath, 'r', encoding='utf-8') as f:
        return deserialize_bom_from_yaml(f.read())


def save_bom_to_yaml(panels: List[Panel], filepath: str) -> None:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(serialize_bom_to_yaml(panels))


def main():
    parser = argparse.ArgumentParser(
        description="Export panel BOM from an OpenSCAD file to YAML",
        epilog="""
Examples:
  %(prog)s design.scad bom.yaml
        """
    )
    parser.add_argument("scad_file", help="Path to the OpenSCAD file")
    parser.add_argument("output_file", help="Output YAML file path")
    args = parser.parse_args()

    if not os.path.exists(args.scad_file):
        print(f"Error: '{args.scad_file}' not found.")
        sys.exit(1)

    print(f"Rendering {args.scad_file}...")
    try:
        output = render_openscad(args.scad_file)
    except Exception as e:
        print(f"Error: Failed to render OpenSCAD file.\nDetails: {e}")
        print("Make sure OpenSCAD is installed and available in your PATH.")
        sys.exit(1)

    panels = parse_panels(output)
    if not panels:
        print("Error: No panels found in the OpenSCAD file.")
        sys.exit(1)

    print(f"Found {len(panels)} panels")

    save_bom_to_yaml(panels, args.output_file)
    print(f"BOM saved to: {args.output_file}")
