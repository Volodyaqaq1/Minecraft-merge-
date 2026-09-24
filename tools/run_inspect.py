import subprocess
import re

res = subprocess.run([
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--window-size=1920,1080',
    '--virtual-time-budget=2000',
    '--dump-dom',
    'file:///C:/Users/volod/Downloads/Game2/tools/inspect_mob_container.html'
], capture_output=True, text=True)

parts = res.stdout.split('</script>')
if len(parts) > 1:
    m = re.search(r'<div id="res">(.*?)</div>', parts[-1])
    if m:
        print("OUTPUT:", m.group(1))
    else:
        print("NO_MATCH_AFTER_SCRIPT:", parts[-1][:300])
else:
    print("NO_SCRIPT_TAG_FOUND")
