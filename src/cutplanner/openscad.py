"""OpenSCAD rendering support."""

import subprocess
import tempfile
import os


def render_openscad(file_path: str) -> str:
    """Render an OpenSCAD file and return stderr output containing ECHO statements."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.stl', delete=False) as tmp_file:
        tmp_path = tmp_file.name

    try:
        result = subprocess.run(
            ["openscad", "--render", "-o", tmp_path, file_path],
            capture_output=True,
            text=True
        )
        return result.stderr
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
