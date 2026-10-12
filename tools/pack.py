#!/usr/bin/env python3
"""
Package the submission into a single zip.

    python tools/pack.py                      # writes ../wick-2.1-final.zip
    python tools/pack.py 2.1-final

The archive is built from an explicit allow-list, so nothing that should not be
submitted (editor backups, .DS_Store, __pycache__, the zip itself) can leak in.
"""

import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = sys.argv[1] if len(sys.argv) > 1 else "2.1-final"
OUT = ROOT.parent / f"wick-{VERSION}.zip"
ARC_ROOT = f"wick-{VERSION}"

DIRS = [
    "assets",  # rglob covers css/ and fonts/ — do not list the children twice
    "src",     # rglob covers core/, ui/, ui/lang/ and workers/ *and* src/main.js.
               # Listing only src/core, src/ui, src/workers is how `src/main.js`
               # (the boot module) was dropped from a shipped archive while
               # index.html and sw.js still referenced it. Never enumerate the
               # children of a directory that has files at its own level.
    "tests",
    "tools",
    "screenshots",
    "ai-logs",
]
ROOT_FILES = [
    "index.html",
    "sw.js",
    "manifest.webmanifest",
    "LICENSE",
    "start-mac.command",
    "启动-wick.cmd",
    "启动-局域网演示.cmd",
]
DOC_FILES = [
    "README.md",
    "提交说明.md",
    "CONTRIBUTING.md",
    "AI_USAGE.md",
    "CREDITS.md",
    "DEMO.md",
    "HANDOFF.md",
    "CHANGELOG.md",
    "Mac打开方法.md",
]

SKIP_NAMES = {".DS_Store", "Thumbs.db"}
SKIP_SUFFIX = (".pyc", ".bak", ".orig", ".swp")


def collect():
    files = []
    for name in ROOT_FILES + DOC_FILES:
        path = ROOT / name
        if path.is_file():
            files.append(path)
        else:
            print(f"  ! missing expected file: {name}")
    for folder in DIRS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file():
                files.append(path)
    keep = []
    for path in files:
        if path.relative_to(ROOT).as_posix().startswith("screenshots/extra/"):
            continue  # Only eight selected screenshots belong in the submission.
        if any(part.startswith(".") for part in path.relative_to(ROOT).parts):
            continue
        if path.name in SKIP_NAMES or path.name.endswith(SKIP_SUFFIX):
            continue
        keep.append(path)
    return keep


def verify(files):
    """Refuse to ship an archive that references files it does not contain.

    Both directions are checked, because both have failed here before: a
    missing boot module (the page never starts) and a stale shell entry
    (the Service Worker never caches anything, because `cache.addAll` is
    atomic). A packer that only checks one direction is a packer that ships
    a broken page with a green light on.
    """
    problems = []
    names = {p.relative_to(ROOT).as_posix() for p in files}

    # 1. every path the Service Worker precaches must be in the archive.
    #    Read the SHELL array itself: the fetch handler also contains
    #    "./index.html", and counting that would overstate the list.
    source = (ROOT / "sw.js").read_text(encoding="utf-8")
    match = re.search(r"SHELL\s*=\s*\[(.*?)\];", source, re.S)
    shell = re.findall(r'"\./([^"]+)"', match.group(1)) if match else []
    for entry in shell:
        if entry.endswith("/"):
            continue
        if entry not in names:
            problems.append(f"sw.js SHELL lists '{entry}' but it is not in the archive")

    # 2. every local reference in index.html must be in the archive
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    refs = [
        r
        for r in re.findall(r'(?:src|href)="([^"#:?]+\.(?:js|css|webmanifest|svg))"', html)
        if not r.startswith("data:")
    ]
    for ref in refs:
        if ref not in names:
            problems.append(f"index.html references '{ref}' but it is not in the archive")

    # 3. the boot module is mandatory
    if "src/main.js" not in names:
        problems.append("src/main.js is missing — the page will not boot")

    verify.counts = (len(shell), len(refs))
    return problems


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    files = collect()
    problems = verify(files)
    if problems:
        print("refusing to package an inconsistent tree:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    if OUT.exists():
        OUT.unlink()
    total = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            rel = path.relative_to(ROOT)
            archive_name = f"{ARC_ROOT}/{rel.as_posix()}"
            if path.suffix == ".command":
                # Windows filesystem permissions do not include a POSIX execute
                # bit. Preserve it explicitly for macOS Archive Utility.
                info = zipfile.ZipInfo.from_file(path, archive_name)
                info.create_system = 3
                info.external_attr = 0o100755 << 16
                archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            else:
                archive.write(path, archive_name)
            total += path.stat().st_size
    print(f"wrote {OUT}")
    print(f"  {len(files)} files · {total / 1024:.0f} KB uncompressed · {OUT.stat().st_size / 1024:.0f} KB zipped")
    problems = verify(files)
    if problems:
        print("  ! archive is inconsistent:")
        for line in problems:
            print(f"    - {line}")
        return 1
    shell_count, ref_count = getattr(verify, "counts", (0, 0))
    print(f"  verified: {shell_count} shell entries, {ref_count} index.html references")
    print("            and the boot module are all present in the archive")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
