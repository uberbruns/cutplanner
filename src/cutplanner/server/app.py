import sys
import os
import argparse
from pathlib import Path
from collections import defaultdict
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from cutplanner.models import Panel
from cutplanner.inventory import InventoryItem, generate_inventory_id, load_inventory_from_yaml
from cutplanner.openscad import render_openscad
from cutplanner.parser import parse_panels
from cutplanner.packer import pack_panels_from_inventory, Sheet, PlacedPanel

STATIC_FOLDER = Path(__file__).parent / 'static'

app = Flask(__name__, static_folder=str(STATIC_FOLDER), static_url_path='/static')
CORS(app)

config = {
    'scad_file': None,
    'inventory_file': None,
    'kerf': 0.0
}



def inventory_item_to_dict(item: InventoryItem) -> dict:
    return {
        "id": item.id,
        "type": item.type,
        "label": item.label,
        "length": item.length,
        "width": item.width,
        "thickness": item.thickness
    }


def panel_to_dict(panel: Panel) -> dict:
    return {
        "name": panel.name,
        "id": panel.id,
        "length": panel.length,
        "width": panel.width,
        "thickness": panel.thickness,
        "ready": panel.ready
    }


def dict_to_panel(data: dict) -> Panel:
    return Panel(
        name=data["name"],
        length=data["length"],
        width=data["width"],
        thickness=data["thickness"],
        id=data["id"],
        path=None,
        ready=data.get("ready", False)
    )


def dict_to_inventory_item(data: dict) -> InventoryItem:
    item_type = data.get("type", "Unknown")
    length = data["length"]
    width = data["width"]
    thickness = data["thickness"]

    item_id = data.get("id") or generate_inventory_id(item_type, length, width, thickness)

    return InventoryItem(
        type=item_type,
        length=length,
        width=width,
        thickness=thickness,
        id=item_id
    )


def placed_panel_to_dict(pp: PlacedPanel) -> dict:
    return {
        "panel": panel_to_dict(pp.panel),
        "x": pp.x,
        "y": pp.y,
        "rotated": pp.rotated
    }


def sheet_to_dict(sheet: Sheet) -> dict:
    return {
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "label": sheet.label,
        "inventory_id": sheet.inventory_id,
        "placed_panels": [placed_panel_to_dict(pp) for pp in sheet.placed_panels],
        "utilization_percent": round(sheet.utilization(), 1)
    }


@app.route('/')
def index():
    return send_from_directory(STATIC_FOLDER, 'index.html')


@app.route('/api/config')
def get_config():
    return jsonify({
        "scad_file": config['scad_file'],
        "inventory_file": config['inventory_file'],
        "kerf": config['kerf']
    })


@app.route('/api/inventory')
def get_inventory():
    try:
        inventory_items = load_inventory_from_yaml(config['inventory_file'])
        return jsonify({
            "inventory": [inventory_item_to_dict(item) for item in inventory_items]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/bom')
def get_bom():
    try:
        output = render_openscad(config['scad_file'])
        panels = parse_panels(output)
        return jsonify({
            "panels": [panel_to_dict(panel) for panel in panels]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/cutting-layout', methods=['POST'])
def generate_cutting_layout():
    try:
        data = request.get_json()

        panels = [dict_to_panel(p) for p in data.get('panels', [])]
        inventory_items = [dict_to_inventory_item(i) for i in data.get('inventory', [])]
        kerf = data.get('kerf', config['kerf'])

        panels_by_thickness = defaultdict(list)
        for panel in panels:
            panels_by_thickness[panel.thickness].append(panel)

        all_sheets = []
        all_unpacked = []

        for thickness in sorted(panels_by_thickness.keys()):
            sheets, unpacked = pack_panels_from_inventory(
                panels_by_thickness[thickness],
                inventory_items,
                thickness,
                kerf
            )
            all_sheets.extend(sheets)
            all_unpacked.extend(unpacked)

        return jsonify({
            "sheets": [sheet_to_dict(sheet) for sheet in all_sheets],
            "unpacked_panels": [panel_to_dict(panel) for panel in all_unpacked],
            "summary": {
                "total_sheets": len(all_sheets),
                "total_panels_placed": sum(len(sheet.placed_panels) for sheet in all_sheets),
                "total_panels_unpacked": len(all_unpacked)
            }
        })
    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


def main():
    parser = argparse.ArgumentParser(
        description="Flask server for cutting layout visualization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s design.scad inventory.yaml
  %(prog)s design.scad inventory.yaml --kerf 3
  %(prog)s design.scad inventory.yaml --port 8080
        """
    )
    parser.add_argument("scad_file", help="Path to the OpenSCAD file")
    parser.add_argument("inventory_file", help="Path to the inventory YAML file")
    parser.add_argument(
        "--kerf",
        type=float,
        default=0.0,
        metavar="MM",
        help="Saw blade width in mm (default: 0)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=16080,
        metavar="PORT",
        help="Server port (default: 16080)"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable Flask debug mode"
    )

    args = parser.parse_args()

    if not os.path.exists(args.scad_file):
        print(f"Error: OpenSCAD file '{args.scad_file}' not found.")
        sys.exit(1)

    if not os.path.exists(args.inventory_file):
        print(f"Error: Inventory file '{args.inventory_file}' not found.")
        sys.exit(1)

    config['scad_file'] = args.scad_file
    config['inventory_file'] = args.inventory_file
    config['kerf'] = args.kerf

    print(f"\nCutting Layout Server")
    print(f"=" * 50)
    print(f"SCAD file:     {args.scad_file}")
    print(f"Inventory:     {args.inventory_file}")
    print(f"Kerf:          {args.kerf}mm")
    print(f"Port:          {args.port}")
    print(f"\nServer running at http://localhost:{args.port}")
    print(f"Press Ctrl+C to stop\n")

    app.run(host='0.0.0.0', port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
