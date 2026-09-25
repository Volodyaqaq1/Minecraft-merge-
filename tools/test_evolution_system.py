import os
import re
import sys
import json
import base64
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def test_data_integrity():
    print("=== 1. Checking Data Integrity ===")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    # 1. Check mobs.js
    mobs_file = os.path.join(root_dir, "src", "data", "mobs.js")
    with open(mobs_file, "r", encoding="utf-8") as f:
        mobs_content = f.read()

    for idx in range(1, 31):
        assert f'baseId: {idx}' in mobs_content, f"Base ID {idx} missing in mobs.js"
    print("  [OK] All 30 base IDs verified in mobs.js")

    assert "EVOLUTIONS = {" in mobs_content
    assert "'ordinary'" in mobs_content and "'elemental'" in mobs_content and "'golden'" in mobs_content
    print("  [OK] All 3 evolution eras (ordinary, elemental, golden) verified")

    # 2. Check worlds.js
    worlds_file = os.path.join(root_dir, "src", "data", "worlds.js")
    with open(worlds_file, "r", encoding="utf-8") as f:
        worlds_content = f.read()

    world_ids = ["green_hills", "sunset_valley", "night_meadow", "ice_world", "fire_world", "end_world", "golden_world"]
    for wid in world_ids:
        assert f"id: '{wid}'" in worlds_content, f"World ID '{wid}' missing in worlds.js"
    print("  [OK] All 7 cosmetic world skins verified")

    # 3. Check assets
    sprites_256 = os.path.join(root_dir, "assets", "mobs", "sprites", "256")
    sprites_512 = os.path.join(root_dir, "assets", "mobs", "sprites", "512")
    portraits_256 = os.path.join(root_dir, "assets", "mobs", "portraits", "256")

    for i in range(1, 31):
        pad = f"{i:02d}"
        assert os.path.exists(os.path.join(sprites_256, f"mob_{pad}.png")), f"Missing sprite 256 mob_{pad}.png"
        assert os.path.exists(os.path.join(sprites_512, f"mob_{pad}.png")), f"Missing sprite 512 mob_{pad}.png"
        assert os.path.exists(os.path.join(sprites_256, f"mob_ordinary_{pad}.png")), f"Missing ordinary sprite {pad}"
        assert os.path.exists(os.path.join(sprites_256, f"mob_elemental_{pad}.png")), f"Missing elemental sprite {pad}"
        assert os.path.exists(os.path.join(sprites_256, f"mob_golden_{pad}.png")), f"Missing golden sprite {pad}"

    for i in range(1, 91):
        pad = f"{i:02d}"
        assert os.path.exists(os.path.join(portraits_256, f"mob_{pad}.png")), f"Missing portrait 256 mob_{pad}.png"

    print("  [OK] All 30 base sprites (256 & 512), 30 ordinary, 30 elemental, 30 golden, and 90 portraits exist on disk")


def capture_all_screenshots():
    print("\n=== 2. Capturing 8 Required Screenshots via Chrome Headless ===")
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    out_dir = r"C:\Users\volod\.gemini\antigravity\brain\984a2eb8-6d05-42d2-a48b-e1af6f2e486d"
    os.makedirs(out_dir, exist_ok=True)
    html_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "render_evolution_screenshots.html")).replace("\\", "/")

    scenarios = [
        ("main_gameplay_new_skins", "main_gameplay_new_skins.png"),
        ("bestiary_ordinary_tab", "bestiary_ordinary_tab.png"),
        ("bestiary_elemental_locked", "bestiary_elemental_locked.png"),
        ("bestiary_elemental_unlocked", "bestiary_elemental_unlocked.png"),
        ("bestiary_golden_locked", "bestiary_golden_locked.png"),
        ("world_selector", "world_selector.png"),
        ("feature_notification_dot", "feature_notification_dot.png"),
        ("evolution_unlock_modal", "evolution_unlock_modal.png"),
        ("modal_queue_step1_milestone", "modal_queue_step1_milestone.png"),
        ("modal_queue_step2_new_mob", "modal_queue_step2_new_mob.png"),
    ]

    for scenario_name, out_filename in scenarios:
        url = f"file:///{html_file}?scenario={scenario_name}"
        out_path = os.path.join(out_dir, out_filename)
        cmd = [
            chrome_path,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--allow-file-access-from-files",
            "--window-size=1920,1080",
            "--virtual-time-budget=6000",
            "--dump-dom",
            url
        ]

        print(f"\n--> Rendering scenario '{scenario_name}' -> {out_filename}...")
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        
        title_m = re.search(r"<title>(.*?)</title>", res.stdout)
        if title_m:
            print("    Page Title:", title_m.group(1))

        match = re.search(r'<div id="snapshot">data:image/png;base64,(.*?)</div>', res.stdout, re.DOTALL)
        if match:
            b64_data = match.group(1).strip()
            img_bytes = base64.b64decode(b64_data)
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            print(f"    [OK] Successfully saved: {out_filename} ({len(img_bytes)} bytes)")
        else:
            print(f"    [FAIL] FAILED to extract snapshot for {scenario_name}")
            print("    DOM sample:", res.stdout[:400])

if __name__ == "__main__":
    test_data_integrity()
    capture_all_screenshots()
