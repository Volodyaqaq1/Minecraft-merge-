import subprocess
import re
import json
import sys

cmd = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=12000',
    '--dump-dom',
    'http://localhost:8085/tools/verify_battle_return_regression.html'
]

res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=15)
m = re.search(r'<title>(.*?)</title>', res.stdout)
if not m:
    print('FAIL: No title found in DOM output')
    sys.exit(1)

title = m.group(1)
if 'REGRESSION_TEST_RESULT:' not in title:
    print('FAIL: Unexpected title:', title)
    sys.exit(1)

result = json.loads(title.split('REGRESSION_TEST_RESULT:')[1])
print('========================================')
print('BATTLE RETURN REGRESSION TEST RESULT')
print('========================================')
print(f"Overall Pass: {'PASS' if result['pass'] else 'FAIL'}")
print('\nDetailed Checks:')
for check_name, passed in result['checks'].items():
    print(f"  - {check_name}: {'PASS' if passed else 'FAIL'}")

print('\nBefore Battle Field:')
for m in result['beforeField']:
    print(f"  Mob ID {m['id']}: Level {m['mobLevel']}, pos ({m['x']}, {m['y']})")

print('\nAfter Return Field (Active MergeField):')
for m in result['afterField']:
    print(f"  Mob ID {m['id']}: Level {m['mobLevel']}, pos ({m['x']}, {m['y']})")

print('\nReloaded Field (Simulated Browser Refresh):')
for m in result['reloadedField']:
    print(f"  Mob ID {m['id']}: Level {m['mobLevel']}, pos ({m['x']}, {m['y']})")

if not result['pass']:
    sys.exit(1)
print('\nTargeted battle-return regression verification: SUCCESS')
