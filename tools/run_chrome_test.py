import subprocess
import os
import re
import sys

def test_viewport(width, height, dpr, html_path):
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    file_url = "file:///" + os.path.abspath(html_path).replace("\\", "/")
    
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=2000",
        "--dump-dom",
        f"--window-size={width},{height}",
        f"--force-device-scale-factor={dpr}",
        file_url
    ]
    
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8)
        import urllib.parse
        match = re.search(r"RESULTS_JSON:(.*?)(?:</title>|</div>|$)", res.stdout, re.DOTALL)
        if match:
            raw = match.group(1).strip()
            try:
                return urllib.parse.unquote(raw)
            except:
                return raw
        err_match = re.search(r"ERROR:(.*)", res.stdout)
        if err_match:
            return f"ERR_IN_PAGE: {err_match.group(1)}"
        return f"NO_MATCH: {res.stdout[:500]}"
    except Exception as e:
        return f"EXCEPTION: {e}"

if __name__ == "__main__":
    w = int(sys.argv[1]) if len(sys.argv) > 1 else 1920
    h = int(sys.argv[2]) if len(sys.argv) > 2 else 1080
    dpr = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    html = sys.argv[4] if len(sys.argv) > 4 else "tools/test_res.html"
    print(test_viewport(w, h, dpr, html))
