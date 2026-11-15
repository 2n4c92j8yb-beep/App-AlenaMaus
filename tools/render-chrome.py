"""Bake the Glass look's chrome objects into src/render/chrome/*.webp.

Runs tools/render-chrome.html in headless Chrome (software WebGL) and saves each picture.
Usage: python3 tools/render-chrome.py [path-to-chrome]
"""
import base64, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'render', 'chrome')
os.makedirs(OUT, exist_ok=True)
server = subprocess.Popen([sys.executable, '-m', 'http.server', '8097'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
try:
    with sync_playwright() as p:
        kw = {'executable_path': sys.argv[1]} if len(sys.argv) > 1 else {}
        browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], **kw)
        page = browser.new_page()
        page.on('pageerror', lambda e: print('page error:', e))
        page.goto('http://localhost:8097/tools/render-chrome.html')
        page.wait_for_function('window.RESULT', timeout=600000)
        for name, url in page.evaluate('window.RESULT').items():
            with open(os.path.join(OUT, f'{name}.webp'), 'wb') as f:
                f.write(base64.b64decode(url.split(',', 1)[1]))
            print('saved', name)
        browser.close()
finally:
    server.kill()
