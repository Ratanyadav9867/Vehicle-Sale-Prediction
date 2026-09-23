"""
backend/utils/dotenv_loader.py
================================
Zero-dependency .env file loader using only Python stdlib.
Reads KEY=VALUE lines (strips quotes, ignores comments and blanks).
Call load_dotenv() once at application startup before any os.getenv() calls.
"""

import os
from pathlib import Path


def load_dotenv(dotenv_path: str | None = None) -> int:
    """
    Load environment variables from a .env file into os.environ.

    Args:
        dotenv_path: Explicit path to the .env file.  If None (default),
                     searches for .env in the current working directory and
                     each parent up to the filesystem root.

    Returns:
        Number of variables loaded (0 if no file found).
    """
    path = _find_dotenv(dotenv_path)
    if path is None:
        return 0

    loaded = 0
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            # Skip blanks and comments
            if not line or line.startswith("#"):
                continue
            # Skip lines without an '='
            if "=" not in line:
                continue
            key, _, raw_value = line.partition("=")
            key = key.strip()
            value = raw_value.strip()

            # Strip optional surrounding quotes (" or ')
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]

            # Never overwrite an already-set environment variable
            if key and key not in os.environ:
                os.environ[key] = value
                loaded += 1

    return loaded


def _find_dotenv(explicit: str | None) -> Path | None:
    """Return the Path to the .env file, or None if not found."""
    if explicit is not None:
        p = Path(explicit)
        return p if p.is_file() else None

    # Walk up from cwd until we find .env or hit the root
    current = Path.cwd()
    while True:
        candidate = current / ".env"
        if candidate.is_file():
            return candidate
        parent = current.parent
        if parent == current:
            break
        current = parent
    return None
