import subprocess
import sys
from pathlib import Path

# Runs in the subprocess — isolated from the parent's asyncio loop.
_WORKER = """
import sys
from playwright.sync_api import sync_playwright

html = sys.stdin.buffer.read().decode("utf-8")
out  = sys.argv[1]

with sync_playwright() as pw:
    for channel in ("msedge", "chrome", None):
        try:
            browser = pw.chromium.launch(**({} if channel is None else {"channel": channel}))
            break
        except Exception:
            if channel is None:
                raise
    try:
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle", timeout=60_000)
        page.pdf(
            path=out,
            format="A4",
            print_background=True,
            margin={"top":"15mm","right":"15mm","bottom":"15mm","left":"15mm"},
        )
    finally:
        browser.close()
"""


def html_to_pdf(html_str: str, output_path: str) -> None:
    """Convert HTML to PDF via Playwright running in a subprocess.

    Spawning a fresh process avoids the 'sync API inside asyncio loop' error
    regardless of whether the caller is sync, async, or a background job runner.
    Edge 149+ is used automatically via channel='msedge' (no browser download needed).
    """
    result = subprocess.run(
        [sys.executable, "-c", _WORKER, output_path],
        input=html_str.encode("utf-8"),
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0 or not Path(output_path).exists():
        err = result.stderr.decode("utf-8", errors="replace")[:600]
        raise RuntimeError(f"PDF conversion failed: {err or 'no output'}")
