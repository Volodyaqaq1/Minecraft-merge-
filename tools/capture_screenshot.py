import subprocess
import os
import re
import base64
import sys

def capture():
    target_html = sys.argv[1] if len(sys.argv) > 1 else "screenshot_test.html"
    target_out_name = sys.argv[2] if len(sys.argv) > 2 else "hidpi_1080p_gameplay.png"
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    query = ""
    if "?" in target_html:
        target_html, query = target_html.split("?", 1)
        query = "&" + query
    html_path = os.path.abspath(target_html).replace("\\", "/")
    out_dir = r"C:\Users\volod\.gemini\antigravity\brain\984a2eb8-6d05-42d2-a48b-e1af6f2e486d"
    out_path = os.path.join(out_dir, target_out_name)
    file_url = f"file:///{html_path}?debug=1{query}"

    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--window-size=1920,1080",
        "--virtual-time-budget=4000",
        "--dump-dom",
        file_url
    ]

    print("Running Chrome to capture snapshot from screenshot_test.html...")
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=25)
    print("Returncode:", res.returncode)
    
    title_m = re.search(r"<title>(.*?)</title>", res.stdout)
    if title_m:
        print("Page Title was:", title_m.group(1))

    match = re.search(r'<div id="snapshot">data:image/png;base64,(.*?)</div>', res.stdout, re.DOTALL)
    if match:
        b64_data = match.group(1).strip()
        img_bytes = base64.b64decode(b64_data)
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"SUCCESS: Screenshot saved to {out_path} ({len(img_bytes)} bytes)")
    else:
        print("SNAPSHOT_NOT_FOUND in DOM output.")
        title_m = re.search(r"<title>(.*?)</title>", res.stdout)
        if title_m:
            print("Title was:", title_m.group(1))
        print("DOM snippet:", res.stdout[:500])

if __name__ == "__main__":
    capture()
