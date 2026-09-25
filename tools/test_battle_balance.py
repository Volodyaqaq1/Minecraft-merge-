import subprocess
import os
import re
import json
import sys

def run():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    html_path = os.path.abspath("tools/test_battle_balance.html").replace("\\", "/")
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

    print("Running Battle Balance + Mobile UX Verification in Headless Chrome...")
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)

    m = re.search(r"<title>(.*?)</title>", res.stdout)
    if not m:
        print("FAIL: No title found in DOM output")
        print("STDOUT snippet:", res.stdout[:500])
        sys.exit(1)

    title = m.group(1)
    if "TEST_RESULT:" not in title:
        print("FAIL: Unexpected title:", title)
        print("STDOUT snippet:", res.stdout[:1000])
        sys.exit(1)

    result_json_str = title.split("TEST_RESULT:")[1]
    result = json.loads(result_json_str)

    print("========================================")
    print("BATTLE BALANCE & MOBILE UX TEST RESULTS")
    print("========================================")
    print(f"Overall Status: {'PASS' if result.get('pass') else 'FAIL'}")
    results_list = result.get('results', [])
    print(f"Total assertions: {len(results_list)}")
    for r in results_list:
        status = "PASS" if r['pass'] else "FAIL"
        print(f"  [{status}] {r['message']}")

    if not result.get('pass'):
        print(f"\nTEST FAILED WITH ERROR: {result.get('error')}")
        if result.get('stack'):
            print(result['stack'])
        sys.exit(1)

    print(f"\nALL {len(results_list)} CHECKS (A..F) PASSED PERFECTLY!")

if __name__ == "__main__":
    run()
