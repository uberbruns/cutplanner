import argparse
import sys

from cutplanner.server.app import main as serve_main
from cutplanner.bom import main as write_bom_main


def main():
    parser = argparse.ArgumentParser(prog="cutplanner")
    subparsers = parser.add_subparsers(dest="command", metavar="command")
    subparsers.required = True

    subparsers.add_parser("serve", help="Start the cutting layout web server",
                          add_help=False)
    subparsers.add_parser("write-bom", help="Export panel BOM from an OpenSCAD file to YAML",
                          add_help=False)

    # Parse only the subcommand name, pass the rest through to the sub-main
    args, remaining = parser.parse_known_args()

    if args.command == "serve":
        sys.argv = ["cutplanner serve"] + remaining
        serve_main()
    elif args.command == "write-bom":
        sys.argv = ["cutplanner write-bom"] + remaining
        write_bom_main()
