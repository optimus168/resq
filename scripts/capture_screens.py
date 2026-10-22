"""
Capture screenshots and performance metrics of web pages using Chrome Headless Shell.
"""

import sys
import os
import time
import socket
import subprocess
import http.server
import socketserver
import threading

CHROME = "/home/aero/.cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell"

from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="/home/aero/RESQ/apps/web/dist", **kwargs)

    def do_GET(self):
        clean_path = self.path.split('?')[0]
        if clean_path.startswith("/api/v1/twins/"):
            parts = clean_path.split("/api/v1/twins/")[1].split("/")
            if len(parts) >= 3 and parts[1] == "files":
                aoi_id, filename = parts[0], parts[2]
                file_path = Path("/home/aero/RESQ/data/twins") / aoi_id / filename
                if file_path.exists():
                    self.send_response(200)
                    media_type = "image/jpeg" if filename.endswith((".jpg", ".jpeg")) else "image/png" if filename.endswith(".png") else "application/octet-stream"
                    self.send_header("Content-Type", media_type)
                    self.send_header("Content-Length", str(file_path.stat().st_size))
                    self.end_headers()
                    with open(file_path, "rb") as f:
                        self.wfile.write(f.read())
                    return
        elif clean_path.startswith("/tiles/terrain/"):
            file_path = Path("/home/aero/RESQ/apps/web/dist") / clean_path.lstrip("/")
            if not file_path.exists():
                file_path = Path("/home/aero/RESQ/apps/web/public/tiles/terrain/fallback.png")
            if file_path.exists():
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(file_path.stat().st_size))
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return
        elif clean_path.startswith("/tiles/satellite/"):
            file_path = Path("/home/aero/RESQ/apps/web/dist") / clean_path.lstrip("/")
            if not file_path.exists():
                file_path = Path("/home/aero/RESQ/apps/web/public/tiles/satellite/fallback.jpg")
            if file_path.exists():
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(file_path.stat().st_size))
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return
        super().do_GET()

    def log_message(self, format, *args):
        pass

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def capture(url_path, output_png, width=1600, height=1000, delay_sec=2):
    port = get_free_port()
    server = socketserver.TCPServer(("127.0.0.1", port), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.3)
    
    url = f"http://127.0.0.1:{port}/{url_path}"
    os.makedirs(os.path.dirname(output_png), exist_ok=True)
    
    cmd = [
        CHROME,
        "--no-sandbox",
        "--no-proxy-server",
        "--enable-unsafe-swiftshader",
        "--ignore-certificate-errors",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
        f"--virtual-time-budget={int(delay_sec * 1000)}",
        "--run-all-compositor-stages-before-draw",
        f"--screenshot={output_png}",
        url
    ]
    
    t0 = time.time()
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        res = None
    elapsed = time.time() - t0
    server.shutdown()
    server.server_close()
    
    if os.path.exists(output_png) and os.path.getsize(output_png) > 1000:
        size_kb = round(os.path.getsize(output_png) / 1024, 1)
        print(f"✓ Screenshot saved: {output_png} ({width}x{height}, {size_kb} KB, {elapsed:.2f}s)")
        return True
    else:
        print(f"✗ Failed to capture {output_png}: {res.stderr[:200]}")
        return False

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else ""
    out = sys.argv[2] if len(sys.argv) > 2 else "docs/screens/capture.png"
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
    d = float(sys.argv[5]) if len(sys.argv) > 5 else 2.0
    capture(path, out, w, h, d)
