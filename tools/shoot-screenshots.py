#!/usr/bin/env python3
"""
Capture every image in screenshots/ from the running site.

    cd wick
    python3 -m http.server 8000 &
    python3 tools/shoot-screenshots.py            # all shots
    python3 tools/shoot-screenshots.py 03 08      # only shots whose name matches
    python3 tools/shoot-screenshots.py --scale 1  # half-weight bundle (~4 MB)

Each image is a real render of the page in headless Chrome, driven through
tools/shots.html so the section and the frame height are exact and repeatable.
Nothing here is a mock-up or a composite.
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHOTS_DIR = ROOT / "screenshots"
PORT = int(sys.argv[1]) if sys.argv[1:2] and sys.argv[1].isdigit() else 8000
URL = f"http://127.0.0.1:{PORT}/tools/shots.html"
SCALE = "1" if "--scale" in sys.argv and "1" in sys.argv else "2"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "google-chrome",
    "chromium",
]

# The brief asks for 3–8 screenshots, so eight are submitted and the rest live
# in screenshots/extra/ as supporting material. Keep it that way: the count in
# `screenshots/` is a submission requirement, not a preference.
#
# name, query, width, height (0 = fit to the section)
SUBMITTED = [
    ("01-hero.png", "section=top&lang=en", 1440, 900),
    ("02-hero-1percent-mode.png", "section=top&lang=en&mode=eco", 1440, 900),
    ("03-cost-of-a-sentence.png", "section=cost&lang=en", 1440, 0),
    ("04-codec-bench.png", "section=codec&lang=en", 1440, 0),
    ("05-budget-engine.png", "section=budget&lang=en", 1440, 0),
    ("06-offline-outbox.png", "section=offline&lang=en", 1440, 0),
    ("07-field-simulation.png", "section=field&lang=en", 1440, 0),
    ("08-craft.png", "section=craft&lang=en", 1440, 0),
]

EXTRA = [
    ("extra/01-impact.png", "section=impact&lang=en", 1440, 0),
    ("extra/02-chinese-codec.png", "section=codec&lang=zh", 1440, 0),
    ("extra/03-sealed-frame.png", "section=codec&lang=en&focus=sealed", 1440, 0),
    ("extra/04-guided-demo.png", "section=top&lang=en&demo=1", 1440, 900),
    ("extra/05-chinese-sealed-frame.png", "section=codec&lang=zh&focus=sealed", 1440, 0),
]

SHOTS = SUBMITTED + EXTRA


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        path = pathlib.Path(candidate)
        if path.exists() or "/" not in candidate:
            return candidate
    raise SystemExit("No Chrome or Chromium found; install one to regenerate shots.")


def chrome_flags(profile, *rest):
    """Every run gets its own throwaway profile.

    Without `--user-data-dir` Chrome uses the *default* profile — the one a real
    person is signed into. That made this script fight with whatever the user
    had open, occasionally fail to start at all, and made captures depend on the
    visitor history of the machine. Screenshots of a submission should not
    depend on who else used the browser.
    """
    return [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-component-update",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-extensions",
        f"--user-data-dir={profile}",
        *rest,
    ]


def probe_height(query):
    """Ask the harness how tall the section is, so the frame is exact."""
    profile = tempfile.mkdtemp(prefix="wick-shot-probe-")
    try:
        result = subprocess.run(
            chrome_flags(
                profile,
                "--window-size=1440,1400",
                "--virtual-time-budget=25000",
                "--dump-dom",
                f"{URL}?{query}",
            ),
            capture_output=True,
            text=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        return 1400
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    match = re.search(r"H=(\d+)", result.stdout)
    return int(match.group(1)) if match else 1400


def shoot(name, query, width, height):
    if height <= 0:
        height = probe_height(query)
    # The height is pinned in the URL as well as the window: `100svh` inside an
    # iframe follows the frame, so a mid-capture resize moves every section.
    url = f"{URL}?{query}&h={height}"
    target = SHOTS_DIR / name
    target.parent.mkdir(parents=True, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="wick-shot-")
    try:
        result = subprocess.run(
            chrome_flags(
                profile,
                "--hide-scrollbars",
                f"--force-device-scale-factor={SCALE}",
                f"--window-size={width},{height}",
                "--virtual-time-budget=25000",
                f"--screenshot={target}",
                url,
            ),
            capture_output=True,
            text=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        result = None
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    ok = target.exists() and target.stat().st_size > 20_000
    size = target.stat().st_size // 1024 if target.exists() else 0
    print(f"  {'ok  ' if ok else 'FAIL'} {name:<32} {width}x{height}  {size} KB")
    if not ok and result.stderr:
        print("       " + result.stderr.strip().splitlines()[-1][:160])
    return ok


chrome_path = None


def main():
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    global chrome_path
    chrome_path = find_chrome()
    # Filters are bare substrings ("offline", "extra"); flags start with "--".
    only = {a for a in sys.argv[1:] if not a.isdigit() and not a.startswith("--")}
    picked = [s for s in SHOTS if not only or any(o in s[0] for o in only)]
    failures = 0
    for name, query, width, height in picked:
        if not shoot(name, query, width, height):
            failures += 1
    submitted = len([p for p in picked if not p[0].startswith("extra/")])
    print(f"\n{len(picked) - failures}/{len(picked)} captured · {submitted} into screenshots/ · the rest into screenshots/extra/")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
