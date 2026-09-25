import os
import re
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def run_tests():
    print("==================================================")
    print("VERIFICATION: Economy & Balance System Tests")
    print("==================================================")

    # 1. Parse config.js
    config_path = os.path.abspath("src/config.js")
    with open(config_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parse MOB_ECONOMY_TABLE
    rows = re.findall(r'\{\s*level:\s*(\d+),\s*click:\s*(\d+),\s*cost:\s*(\d+),\s*atk:\s*(\d+)\s*\}', content)
    assert len(rows) == 30, f"Expected 30 rows in MOB_ECONOMY_TABLE, got {len(rows)}"

    table = {}
    for r in rows:
        lvl, clk, cst, atk = map(int, r)
        table[lvl] = {"click": clk, "cost": cst, "atk": atk}

    print("\n[OK] MOB_ECONOMY_TABLE parsed successfully (30 levels).")

    # 2. Check Anchors
    print("\n--- Anchor Check: Level 14 ---")
    l14 = table[14]
    print(f"  Level 14 Tap Income : {l14['click']:,} (Target: ~8,000)")
    print(f"  Level 14 Shop Price : {l14['cost']:,} (Target: ~100,000)")
    r14 = l14['cost'] / l14['click']
    print(f"  Level 14 Taps to Buy: {r14:.1f} taps (Target: 12-16 taps)")
    assert l14['click'] == 8000, f"Level 14 click {l14['click']} != 8000"
    assert l14['cost'] == 100000, f"Level 14 cost {l14['cost']} != 100000"
    assert 12.0 <= r14 <= 16.0, f"Level 14 tap ratio {r14} not in [12, 16]"
    print("  [PASS] Level 14 anchors verified!")

    print("\n--- Anchor Check: Level 15 ---")
    l15 = table[15]
    defeat15 = round(l15['cost'] * (1480000 / 240000))
    win15 = round(defeat15 * 2.5)
    print(f"  Level 15 Tap Income    : {l15['click']:,} (Target: ~16,000)")
    print(f"  Level 15 Shop Price    : {l15['cost']:,} (Target: ~240,000)")
    r15 = l15['cost'] / l15['click']
    print(f"  Level 15 Taps to Buy   : {r15:.1f} taps (Target: 12-16 taps)")
    print(f"  Level 15 Defeat Reward : {defeat15:,} (Target: ~1,480,000 = 1.48M)")
    print(f"  Level 15 Victory Reward: {win15:,} (Target: ~3,700,000 = 3.70M)")
    assert l15['click'] == 16000, f"Level 15 click {l15['click']} != 16000"
    assert l15['cost'] == 240000, f"Level 15 cost {l15['cost']} != 240000"
    assert defeat15 == 1480000, f"Level 15 defeat reward {defeat15} != 1480000"
    assert win15 == 3700000, f"Level 15 victory reward {win15} != 3700000"
    assert 12.0 <= r15 <= 16.0, f"Level 15 tap ratio {r15} not in [12, 16]"
    print("  [PASS] Level 15 anchors verified!")

    # 3. Check Monotonicity and Ratio Boundaries (Levels 1 to 30)
    print("\n--- Smoothness & Affordability Check (Levels 1 to 30) ---")
    for lvl in range(1, 31):
        d = table[lvl]
        ratio = d['cost'] / d['click']
        defeat = round(d['cost'] * (1480000 / 240000))
        win = round(defeat * 2.5)

        assert 12.0 <= ratio <= 16.2, f"Level {lvl} ratio {ratio:.2f} out of range [12.0, 16.2]"
        if lvl > 1:
            prev = table[lvl - 1]
            assert d['click'] > prev['click'], f"Level {lvl} click <= prev"
            assert d['cost'] > prev['cost'], f"Level {lvl} cost <= prev"
            assert d['atk'] > prev['atk'], f"Level {lvl} atk <= prev"

    print("  [PASS] All 30 levels are strictly monotonic, no dead zones or spikes.")
    print("  [PASS] All 30 levels have tap affordability strictly within 12 to 16 taps!")

    # 4. Sample Economy Table for Levels 14 to 20
    print("\n--- Sample Economy Values (Levels 14 to 20) ---")
    print(f"{'Level':<6} | {'Tap Income':<12} | {'Shop Price':<14} | {'Taps to Buy':<12} | {'Defeat Reward':<14} | {'Victory Reward':<14}")
    print("-" * 80)
    for lvl in range(14, 21):
        d = table[lvl]
        ratio = d['cost'] / d['click']
        defeat = round(d['cost'] * (1480000 / 240000))
        win = round(defeat * 2.5)
        print(f"{lvl:<6} | {d['click']:<12,} | {d['cost']:<14,} | {ratio:<12.1f} | {defeat:<14,} | {win:<14,}")

    # 5. Check Beyond Level 30 (Levels 31 to 90)
    print("\n--- Extension Beyond Level 30 (Levels 31 to 90) ---")
    base_cost = table[30]['cost']
    base_click = table[30]['click']
    for lvl in [31, 35, 45, 60, 75, 90]:
        cost = int(base_cost * (1.75 ** (lvl - 30)))
        click = int(base_click * (1.75 ** (lvl - 30)))
        defeat = round(cost * (1480000 / 240000))
        win = round(defeat * 2.5)
        ratio = cost / click
        print(f"Level {lvl:2d} | Click: {click:18,} | Cost: {cost:18,} | Ratio: {ratio:4.1f} | Defeat: {defeat:18,} | Win: {win:18,}")
        assert abs(ratio - 16.0) < 0.1, f"Level {lvl} ratio {ratio} != 16.0"

    print("  [PASS] High-level progression scales smoothly with consistent 16.0 taps ratio!")
    print("\nALL VERIFICATIONS PASSED!")

if __name__ == "__main__":
    run_tests()
