"""
Capture reference screenshots of emergent preview at multiple scroll positions.
"""

import os
import time
import subprocess

CHROME = "/home/aero/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"
URL = "https://resq-agents.preview.emergentagent.com/"

os.makedirs("docs/screens", exist_ok=True)

def capture_hero():
    print("Capturing Emergent Preview Hero...")
    cmd = [
        CHROME,
        "--no-sandbox",
        "--enable-unsafe-swiftshader",
        "--window-size=1600,1000",
        "--virtual-time-budget=6000",
        "--screenshot=docs/screens/ref_emergent_hero.png",
        URL
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists("docs/screens/ref_emergent_hero.png"):
        size_kb = os.path.getsize("docs/screens/ref_emergent_hero.png") / 1024
        print(f"✓ Saved docs/screens/ref_emergent_hero.png ({size_kb:.1f} KB)")
    else:
        print("Failed to capture hero:", res.stderr)

if __name__ == "__main__":
    capture_hero()
