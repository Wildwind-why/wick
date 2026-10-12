#!/usr/bin/env python3
"""
Measure the shipped wick files and generate src/ui/budget-data.js.

Section 07 claims its numbers were measured rather than estimated. This script
is what makes that true: the table in the page is written from the bytes that
are actually in this directory, so it cannot drift away from the artefacts it
describes.

    cd wick && python3 tools/build-budget-data.py

No third-party packages. Python 3.8+.
"""

import gzip
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "ui" / "budget-data.js"


def measure(paths):
    raw = 0
    compressed = 0
    for path in paths:
        data = path.read_bytes()
        raw += len(data)
        # File-size comparison only: the smaller of raw and gzip is reported.
        # Actual transfer depends on the server, cache and request headers.
        compressed += min(len(data), len(gzip.compress(data, 9, mtime=0)))
    return raw, compressed


def group(pattern, exclude=()):
    return sorted(
        p for p in ROOT.glob(pattern) if p.is_file() and p.name not in exclude
    )


def main():
    # A missing file here used to surface either as a traceback or — worse —
    # as a table that silently measured a smaller site than the one being
    # shipped. Say what is wrong instead.
    for required in ("src/main.js", "index.html", "sw.js"):
        if not (ROOT / required).is_file():
            raise SystemExit(
                f"cannot measure: {required} is missing from the tree. "
                "The payload table must describe the files that actually ship."
            )

    # budget-data.js is the output of this script, so measuring it would make
    # the table depend on its own previous contents. Exclude it.
    groups = [
        ("index.html", [ROOT / "index.html"]),
        ("stylesheets", group("assets/css/*.css")),
        ("core engine", group("src/core/*.js")),
        ("interface", group("src/ui/*.js", exclude={"budget-data.js"})),
        ("copy", group("src/ui/lang/*.js")),
        ("entry point", [ROOT / "src" / "main.js"]),
        ("workers", group("src/workers/*.js")),
        ("offline shell", [ROOT / "sw.js", ROOT / "manifest.webmanifest"]),
        ("fonts, latin subset", group("assets/fonts/*.woff2")),
    ]

    rows = []
    for name, files in groups:
        if not files:
            continue
        if name == "copy":
            # The worker precaches both languages, so count both files.
            raw, compressed = measure(files)
            label = f"copy ({len(files)} languages, including precache)"
        else:
            raw, compressed = measure(files)
            label = name if len(files) == 1 else f"{name} ({len(files)})"
        rows.append({"name": label, "raw": raw, "gzip": compressed})

    total_raw = sum(r["raw"] for r in rows)
    total_gzip = sum(r["gzip"] for r in rows)
    for row in rows:
        row["share"] = round(row["gzip"] / total_gzip * 100, 1)

    js_rows = [
        r
        for r in rows
        if r["name"].split(" (")[0] in ("core engine", "interface", "copy", "entry point", "workers")
    ]
    js_raw = sum(r["raw"] for r in js_rows)
    js_gzip = sum(r["gzip"] for r in js_rows)
    font_rows = [r for r in rows if r["name"].startswith("fonts")]
    font_gzip = sum(r["gzip"] for r in font_rows)

    lines = [
        "/**",
        " * budget-data.js — GENERATED, do not edit by hand.",
        " *",
        " * Produced by tools/build-budget-data.py, which measures the files this",
        " * repository actually ships and gzips them at level 9. Regenerate it",
        " * whenever an asset changes:  python3 tools/build-budget-data.py",
        " */",
        "",
        "export const BUDGET = [",
    ]
    for row in rows:
        lines.append(
            "  { name: %s, raw: %d, gzip: %d, share: %s },"
            % (json.dumps(row["name"]), row["raw"], row["gzip"], row["share"])
        )
    lines += [
        "];",
        "",
        "export const MEASURED = {",
        f"  totalRaw: {total_raw},",
        f"  totalGzip: {total_gzip},",
        f"  jsRaw: {js_raw},",
        f"  jsGzip: {js_gzip},",
        f"  fontGzip: {font_gzip},",
        f"  withoutFontsGzip: {total_gzip - font_gzip},",
        "};",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"  total raw        {total_raw:>8,} B")
    print(f"  total gzip files {total_gzip:>8,} B")
    print(f"  javascript       {js_gzip:>8,} B")
    print(f"  fonts            {font_gzip:>8,} B  (1% mode skips these entirely)")
    print(f"  without fonts    {total_gzip - font_gzip:>8,} B")
    for row in rows:
        print(
            "  - %-26s %8d raw / %7d gzip       %5s%%"
            % (row["name"], row["raw"], row["gzip"], row["share"])
        )


if __name__ == "__main__":
    main()
