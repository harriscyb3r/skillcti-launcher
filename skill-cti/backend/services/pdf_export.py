import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

_BROWSER_PATH: str | None = None


def find_browser() -> str | None:
    global _BROWSER_PATH
    if _BROWSER_PATH:
        return _BROWSER_PATH
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for name in ("msedge", "chrome", "google-chrome", "chromium", "chromium-browser"):
        p = shutil.which(name)
        if p:
            candidates.append(p)
    for c in candidates:
        if c and Path(c).exists():
            _BROWSER_PATH = c
            return c
    return None


def html_to_pdf(html_str: str, output_path: str) -> None:
    browser = find_browser()
    if not browser:
        raise RuntimeError(
            "No Chromium-based browser found for PDF conversion. "
            "Install Microsoft Edge (recommended on Windows) or Google Chrome."
        )
    with tempfile.NamedTemporaryFile(
        suffix=".html", delete=False, mode="w", encoding="utf-8"
    ) as f:
        f.write(html_str)
        html_path = Path(f.name)

    try:
        file_url = "file:///" + str(html_path).replace("\\", "/")
        cmd = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=10000",
            f"--print-to-pdf={output_path}",
            file_url,
        ]
        # --no-sandbox is only needed on Linux where kernel namespaces may be
        # unavailable (e.g. unprivileged Docker containers). On Windows and macOS
        # the browser sandbox works without it.
        if platform.system() == "Linux":
            cmd.insert(2, "--no-sandbox")
        result = subprocess.run(cmd, capture_output=True, timeout=90)
        if result.returncode != 0 or not Path(output_path).exists():
            err = result.stderr.decode("utf-8", errors="replace")[-500:]
            raise RuntimeError(
                f"PDF conversion failed (exit {result.returncode}): {err.strip() or 'no stderr'}"
            )
    finally:
        try:
            html_path.unlink()
        except Exception:
            pass
