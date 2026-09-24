import json
from run_chrome_test import test_viewport

viewports = [
    ("Desktop Full HD", 1920, 1080, 1.0),
    ("Desktop 1366x768", 1366, 768, 1.0),
    ("Mobile Landscape DPR 2", 844, 390, 2.0),
    ("Mobile Landscape DPR 3", 844, 390, 3.0),
]

results = {}
for name, w, h, dpr in viewports:
    raw = test_viewport(w, h, dpr, "tools/verify_stage1_1.html")
    try:
        results[name] = json.loads(raw)
    except Exception as e:
        results[name] = {"error": str(e), "raw": raw}

print("VERIFICATION_SUMMARY:" + json.dumps(results, indent=2))
