import os
import re

patterns = [
    r'pointer\.[xy]',
    r'ptr\.[xy]',
    r'drag[XY]',
    r'world[XY]',
    r'activePointer',
    r'transform[XY]',
    r'down[XY]',
    r'page[XY]',
    r'clientX',
    r'clientY'
]

combined_regex = re.compile('|'.join(patterns))

results = []
src_dir = 'src'
for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith('.js'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                for line_no, line in enumerate(file, 1):
                    if combined_regex.search(line):
                        results.append(f"{path}:{line_no}: {line.strip()}")

print(f"Total occurrences: {len(results)}")
for r in results:
    # Print safe ascii
    safe = r.encode('ascii', 'replace').decode()
    print(safe)
