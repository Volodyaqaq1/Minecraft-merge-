import subprocess
import os
import re
import json
import sys

def run():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    html_path = os.path.abspath("tools/test_progression_pass.html").replace("\\", "/")
    url = f"file:///{html_path}"

    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--window-size=1920,1080",
        "--virtual-time-budget=4000",
        "--dump-dom",
        url
    ]

    print("Running Progression Pass Verification in Headless Chrome...")
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=25)

    m = re.search(r"<title>(.*?)</title>", res.stdout)
    if not m:
        print("FAIL: No title found in DOM output")
        sys.exit(1)

    title = m.group(1)
    if "PROGRESSION_TEST_RESULT:" not in title:
        print("FAIL: Unexpected title:", title)
        sys.exit(1)

    result = json.loads(title.split("PROGRESSION_TEST_RESULT:")[1])
    print("========================================")
    print("PROGRESSION PASS TEST RESULTS")
    print("========================================")
    print(f"Overall Status: {'PASS' if result['pass'] else 'FAIL'}")
    print(f"Total assertions: {len(result.get('results', []))}")
    for r in result.get('results', []):
        status = "PASS" if r['pass'] else "FAIL"
        print(f"  [{status}] {r['message']}")

    if not result['pass']:
        print(f"\nTEST FAILED WITH ERROR: {result.get('error')}")
        sys.exit(1)

    print(f"\nALL {len(result.get('results', []))} PROGRESSION PASS CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    run()
