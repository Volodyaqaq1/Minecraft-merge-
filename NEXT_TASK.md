# NEXT TASK — Stage 3 Step 2: Combat Juice & Battle Feel

**Status:** Stage 3 Step 1 completed and approved. Ready to start Stage 3 Step 2.  
**Branch:** `main`  
**Prerequisite:** Read `AGENT_HANDOFF.md` in full before starting any work.

---

## Context

Stage 3 Step 1 (tactile merge-field interactions, drag lift, invalid drop shake, combo shockwaves, and atomic incubator rewards) is completed, fully verified, and merged.

Stage 3 Step 2 is dedicated exclusively to **Battle Juice and Combat Impact Feedback** in `BattleScene.js`.

### Architectural Invariants:
- All game logic lives strictly in **960×540** logical space.
- WebGL backing buffer remains **1920×1080** (`CONFIG.RENDER_SCALE = 2.0`).
- Text rendering must continue using `createHDText()` from `helpers.js`.
- All pointer events must use `pointer.worldX / pointer.worldY` or `helpers.getLogicalPointer()`.
- **Preserve existing battle logic, battle system simulation, and economy numbers exactly.** Combat juice is visual and tactile presentation only.

---

## Stage 3 Step 2 — Implementation Priority

Work through these items in order. Do NOT batch unverified systems:

### 1. Attacker Lunge / Recoil
- Attacking mob performs a sharp forward lunge toward its target (translate ~12–16px, Quad.Out, ~70ms).
- Brief recoil / recovery step back to baseline position with soft Quad.InOut settle (~90ms).
- Slight squash on launch, stretch in motion.

### 2. Defender Hit Flash + Squash
- Target mob flashes bright white (tint or brief overlay flash, ~50–70ms).
- Quick impact squash (`scaleX: 1.15, scaleY: 0.85` in ~60ms) settling back to `1.0`.
- Small horizontal knockback/twitch in direction away from attacker (~4–6px) returning to original position.

### 3. Wall Punch Feedback & Wood Chip Particles
- Wall hit receives an impactful punch response: subtle horizontal shove (2–3px), quick recovery.
- Health bar on the wall flashes red/white accent.
- Burst of 4–6 small wood chip / debris particles emitting from the point of impact with randomized angles, short gravity/arc, and auto-destroy.

### 4. Compact Floating Damage Numbers
- Floating damage numbers positioned above defender head / wall impact point.
- Crisp, compact styling using `createHDText`:
  - Standard hit: vibrant yellow/orange with dark stroke.
  - Quick upward float arc with subtle horizontal drift (25–35px over ~500ms) with fade out and auto-destroy.

### 5. Stronger Critical-Hit Presentation
- When a hit is critical (or highest damage tier):
  - Larger bold floating text (`CRIT!` or larger bold number with exclamation).
  - Distinct bright red/amber color with star flare or radial spark burst.
  - Brief micro camera twitch (30ms, 0.002) for high-impact critical hits.

### 6. Final Wall Break Burst
- When the wall reaches 0 HP:
  - Dramatic destruction burst: 12–16 large wood splinters and dust puffs exploding outwards.
  - Wall graphics shatter/fade rapidly (~150ms).
  - Brief white screen flash (alpha 0.2 -> 0, ~200ms).

### 7. Victory Team Rush Toward Treasure
- Surviving player mobs cheer/jump (bounce tween, Back.Out) and rush forward across the broken wall line toward the treasure chest location.
- Cheerful victory animation sequence before modal displays.

### 8. Treasure & Confetti Payoff
- Chest pops open with a golden glow burst and radial confetti/coin particles.
- Victory modal triggers cleanly after the payoff sequence completes.

---

## Verification Checklist (Before Commit)

```bash
python tools/validate_syntax.py          # All files: OK
python tools/audit_coordinates.py        # All pointer coords: worldX/worldY
python tools/run_all_verifications.py    # All 4 viewports pass
```
- Capture visual screenshots of combat lunge, wall hit impact, crit presentation, and wall break / victory rush.
