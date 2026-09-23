import glob
import sys

def check_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    in_str = None
    in_line_comment = False
    in_block_comment = False
    escaped = False

    lines = content.split('\n')
    for lno, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            ch = line[i]
            if in_line_comment:
                break
            if in_block_comment:
                if ch == '*' and i + 1 < len(line) and line[i+1] == '/':
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if in_str:
                if escaped:
                    escaped = False
                elif ch == '\\':
                    escaped = True
                elif ch == in_str:
                    in_str = None
                i += 1
                continue

            if ch == '/' and i + 1 < len(line) and line[i+1] == '/':
                in_line_comment = True
                break
            if ch == '/' and i + 1 < len(line) and line[i+1] == '*':
                in_block_comment = True
                i += 2
                continue
            if ch in ('"', "'", '`'):
                in_str = ch
                i += 1
                continue

            if ch in ('(', '[', '{'):
                stack.append((ch, lno))
            elif ch in (')', ']', '}'):
                if not stack:
                    print(f"ERROR in {path}:{lno}: unexpected closing '{ch}'")
                    return False
                top, top_lno = stack.pop()
                if top != pairs[ch]:
                    print(f"ERROR in {path}:{lno}: expected matching '{pairs[ch]}' for '{ch}', but found '{top}' from line {top_lno}")
                    return False
            i += 1
        in_line_comment = False

    if stack:
        top, top_lno = stack[-1]
        print(f"ERROR in {path}: unclosed '{top}' from line {top_lno}")
        return False

    print(f"OK: {path}")
    return True

all_ok = True
for f in sorted(glob.glob('src/**/*.js', recursive=True)):
    if not check_file(f):
        all_ok = False

if all_ok:
    print("\nSUCCESS: All JS files passed syntax & bracket balance check!")
else:
    sys.exit(1)
