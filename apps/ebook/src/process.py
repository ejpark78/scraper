"""PDF ebook process entrypoint.

Refactored to delegate each mode to an EbookCommand class.
"""

import argparse
import sys

from .commands import COMMANDS


def main():
    parser = argparse.ArgumentParser(description="Ebook PDF Process Pipeline.")
    parser.add_argument("--raw-pdf", default="data/raw", help="Directory of raw PDF files")
    parser.add_argument("--path", default="data/output", help="Working path for inputs and outputs")

    for cmd in COMMANDS:
        cmd.add_arguments(parser)

    args = parser.parse_args()

    for cmd in COMMANDS:
        if cmd.matches(args):
            cmd.execute(args)
            return

    parser.print_help()


if __name__ == "__main__":
    main()
