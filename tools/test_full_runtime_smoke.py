import subprocess
import os
import re
import json
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    html_path = os.path.abspath("tools/test_full_runtime_smoke.html").replace("\\", "/")
    url = f"file:///{html_path}"

    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--window-size=1920,1080",
        "--virtual-time-budget=5000",
        "--dump-dom",
        url
    ]

    print("Running 12-Step Full Runtime Smoke Test in Headless Chrome...")
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=25)

    m = re.search(r"<title>(.*?)</title>", res.stdout)
    if not m:
        print("FAIL: No title found in DOM output")
        print("STDOUT snippet:", res.stdout[:600])
        sys.exit(1)

    title = m.group(1)
    if "TEST_COMPLETED:" not in title:
        print("FAIL: Unexpected title:", title)
        print("STDOUT snippet:", res.stdout[:1000])
        sys.exit(1)

    data_str = title.split("TEST_COMPLETED:")[1]
    data = json.loads(data_str)

    print("==================================================")
    print("12-STEP RUNTIME SMOKE TEST RESULTS")
    print("==================================================")
    
    for r in data.get("testResults", []):
        status = "PASS" if r["passed"] else "FAIL"
        print(f"[{status}] Step {r['step']}: {r['name']} -> {r['detail']}")

    print("==================================================")
    if data.get("allPassed"):
        print("ALL 12 RUNTIME SMOKE TEST STEPS PASSED WITH 0 ERRORS!")
        sys.exit(0)
    else:
        print("FAILURES DETECTED!")
        if data.get("errors"):
            print("Errors:", data["errors"])
        sys.exit(1)

if __name__ == "__main__":
    run()
