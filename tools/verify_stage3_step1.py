import json
import subprocess
import os
import sys
import re

def run_chrome_test(html_path):
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    abs_path = os.path.abspath(html_path).replace("\\", "/")
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--allow-file-access-from-files",
        "--window-size=1920,1080",
        "--virtual-time-budget=4000",
        "--dump-dom",
        f"file:///{abs_path}"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=25)
    return res.stdout

def main():
    print("========================================")
    print("STAGE 3 STEP 1 VERIFICATION TEST SUITE")
    print("========================================")

    # 1. Syntax check
    print("\n--- 1. Syntax Validation ---")
    ret = subprocess.run([sys.executable, "tools/validate_syntax.py"], capture_output=True, text=True)
    print(ret.stdout.strip())
    assert ret.returncode == 0, "Syntax validation failed"

    # 2. Coordinate audit
    print("\n--- 2. Coordinate System Audit ---")
    ret = subprocess.run([sys.executable, "tools/audit_coordinates.py"], capture_output=True, text=True)
    assert ret.returncode == 0, "Coordinate audit failed"
    print("Coordinate audit: PASS (all pointer coords use worldX/worldY)")

    # 3. Viewport verification suite
    print("\n--- 3. Running run_all_verifications.py ---")
    ret = subprocess.run([sys.executable, "tools/run_all_verifications.py"], capture_output=True, text=True)
    assert ret.returncode == 0, "Full verification suite failed"
    for line in ret.stdout.strip().split("\n"):
        if "Desktop" in line or "Mobile" in line or "hitTestPassed" in line:
            print("  " + line.strip())
    print("Viewport verification suite: PASS")

    # 4. Core Logic & Behavioral Exactness Suite
    print("\n--- 4. Core Logic & Behavioral Verification Suite ---")
    dom = run_chrome_test("tools/test_stage3_logic.html")
    match = re.search(r"<title>RESULTS_JSON:(.*?)</title>", dom, re.DOTALL)
    if not match:
        print("ERROR: Could not find <title>RESULTS_JSON:... in test DOM output:")
        print(dom[:600])
        sys.exit(1)

    import urllib.parse
    raw_json = urllib.parse.unquote(match.group(1).strip())
    try:
        data = json.loads(raw_json, strict=False)
        if isinstance(data, str):
            data = json.loads(data, strict=False)
    except Exception as ex:
        print("RAW_JSON_ERROR:", repr(raw_json[:200]))
        raise ex
    all_passed = data.get("allPassed", False)
    tests = data.get("tests", [])

    for t in tests:
        status = "PASS" if t["pass"] else "FAIL"
        print(f"[{status}] {t['name']}")
        print(f"       Details: {t['details']}")

    print("\n========================================")
    if all_passed:
        print("ALL TESTS PASSED SUCCESSFULLY! (6/6 logic checks + syntax + coords + 4 viewports)")
    else:
        print("VERIFICATION FAILED")
        sys.exit(1)
    print("========================================")

if __name__ == "__main__":
    main()
