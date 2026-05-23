# cutplanner

A web-based tool for generating cutting layouts for sheet material from OpenSCAD designs. It reads panel data from an OpenSCAD file and an inventory of available sheets, then provides an interactive cutting layout in the browser.

> [!NOTE]
> This tool was built with AI assistance for **personal use**. It does what it needs to do, but is not meant to be production-grade quality (whatever this may mean).

## Requirements

- Python 3.13+
- [OpenSCAD](https://openscad.org/) installed and available in `PATH`

## Installation

**Run directly** without installation using [uvx](https://docs.astral.sh/uv/):

```sh
uvx --from git+https://github.com/uberbruns/cutplanner cutplanner design.scad inventory.yaml
```

**After cloning:**

```sh
git clone https://github.com/uberbruns/cutplanner
cd cutplanner
uv sync
uv run cutplanner design.scad inventory.yaml
```

**Install globally via [mise](https://mise.jdx.dev/):**

```sh
mise use -g pipx:uberbruns/cutplanner
```

## Usage

```
cutplanner <scad_file> <inventory_file> [options]

Arguments:
  scad_file       Path to the OpenSCAD file
  inventory_file  Path to the inventory YAML file

Options:
  --kerf MM       Saw blade width in mm (default: 0)
  --port PORT     Port to listen on (default: 5000)
```

**Examples:**

```sh
cutplanner design.scad inventory.yaml
cutplanner design.scad inventory.yaml --kerf 3
cutplanner design.scad inventory.yaml --port 8080
```

Open `http://localhost:5000` in your browser after starting the server.

Individual panels can be marked as done. Done state is persisted in the browser's `localStorage`.

## OpenSCAD integration

Your OpenSCAD file must emit panel data via `echo()` statements during rendering. cutplanner parses the OpenSCAD stderr output and extracts all lines containing a JSON object. Because OpenSCAD requires escaping in string literals, the typical pattern looks like this:

```openscad
echo(str("{\"name\":\"", name, "\",\"length\":", length, ",\"width\":", width, ",\"thickness\":", thickness, "}"));
```

Which produces a line in the OpenSCAD console like:

```
ECHO: "{"name":"Aside/Front","material":"Default","depth":7,"length":954,"width":312,"thickness":16}"
```

| Field       | Type    | Required | Description          |
|-------------|---------|----------|----------------------|
| `name`      | string  | yes      | Panel identifier     |
| `length`    | number  | yes      | Length in mm         |
| `width`     | number  | yes      | Width in mm          |
| `thickness` | number  | yes      | Thickness in mm      |

Any other fields in the object are ignored.

[uberbruns/headspace](https://github.com/uberbruns/headspace) is an OpenSCAD library that emits panel data in this format.

## Inventory format

The inventory YAML file lists the available sheets of material. The packer assigns panels to the smallest sheet that fits, working through the list until all panels are placed.

```yaml
inventory:
  - type: MDF
    dimensions:
      length: 2800
      width: 2070
      thickness: 16
  - type: Plywood
    dimensions:
      length: 1200
      width: 600
      thickness: 18
```

See [`examples/inventory.yaml`](examples/inventory.yaml) for a complete example.
