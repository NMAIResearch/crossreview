#!/usr/bin/env python3
"""Static pre-check for a submitted repository. Reads files only; never runs them.

Usage:
  precheck.py DIRECTORY [--json]

Exit codes: 0 pass (warnings allowed), 1 fail, 2 usage error.
"""

import ast
import json
import os
import re
import sys
from pathlib import Path

MAX_FILES = 20000
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_SCAN_BYTES = 2 * 1024 * 1024
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build"}
BIDI_CONTROLS = frozenset("\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
TEXT_SUFFIXES = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".md", ".txt", ".yml", ".yaml", ".toml",
    ".cfg", ".ini", ".sh", ".html", ".css", ".rs", ".go", ".java", ".rb", ".php", ".c", ".h",
    ".cpp", ".cs", ".swift", ".kt", ".sql", ".env",
}
SECRET_PATTERNS = {
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),
    "OpenAI-style key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b"),
    "Anthropic key": re.compile(r"\bsk-ant-[A-Za-z0-9_-]{32,}\b"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"),
    "Slack token": re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    "private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
}


def walk(root):
    """Yield regular files under root, not following symbolic links."""
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            path = Path(dirpath) / name
            if path.is_symlink() or not path.is_file():
                continue
            yield path


def check(root):
    root = Path(root)
    failures, warnings, info = [], [], []
    files = []
    for path in walk(root):
        files.append(path)
        if len(files) > MAX_FILES:
            failures.append(f"more than {MAX_FILES} files; too large to pre-check")
            break
    names = {p.relative_to(root).as_posix().lower() for p in files}

    if not any(n in names for n in ("readme.md", "readme", "readme.txt", "readme.rst")):
        failures.append("no README at the top level")
    if not any(n.startswith(("license", "licence", "copying")) for n in names):
        warnings.append("no licence file at the top level")
    if not any(re.search(r"(^|/)(tests?/|test_[^/]*\.py$|[^/]*_test\.py$|[^/]*\.test\.[jt]sx?$|[^/]*\.spec\.[jt]sx?$)", n) for n in names):
        warnings.append("no tests found")

    total = 0
    for path in files:
        rel = path.relative_to(root).as_posix()
        size = path.stat().st_size
        total += size
        if size > MAX_FILE_BYTES:
            warnings.append(f"large file: {rel} ({size} bytes)")
        if path.name == ".env" or path.name.startswith(".env."):
            failures.append(f"environment file committed: {rel}")
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name != ".env":
            continue
        if size > MAX_SCAN_BYTES:
            info.append(f"not scanned (over {MAX_SCAN_BYTES} bytes): {rel}")
            continue
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="replace")
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                failures.append(f"possible {label} in {rel}")
        if any(ch in BIDI_CONTROLS for ch in text):
            failures.append(f"hidden text-direction characters in {rel}")
        if path.suffix.lower() == ".py":
            try:
                ast.parse(raw, filename=rel)
            except (SyntaxError, ValueError) as exc:
                failures.append(f"Python does not parse: {rel} line {getattr(exc, 'lineno', '?')}")
        elif path.suffix.lower() == ".json":
            try:
                json.loads(text)
            except ValueError as exc:
                failures.append(f"JSON does not parse: {rel} ({exc.msg}, line {exc.lineno})")

    info.append(f"{len(files)} files, {total} bytes")
    return {"status": "fail" if failures else "pass", "failures": failures, "warnings": warnings, "info": info}


def markdown(result):
    lines = [f"**Pre-check: {result['status']}**", ""]
    for key, title in (("failures", "Must fix"), ("warnings", "Worth fixing"), ("info", "Notes")):
        if result[key]:
            lines.append(f"{title}:")
            lines.extend(f"- {item}" for item in result[key])
            lines.append("")
    lines.append("This check reads files only. It never runs submitted code and does not judge whether the work is correct.")
    return "\n".join(lines)


def main(argv):
    if len(argv) < 2 or not Path(argv[1]).is_dir():
        print(__doc__.strip(), file=sys.stderr)
        return 2
    result = check(argv[1])
    print(json.dumps(result, indent=2) if "--json" in argv else markdown(result))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
