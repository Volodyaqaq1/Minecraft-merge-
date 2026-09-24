# AGENT HANDOFF — Minecraft-Merge (Squishy Merge)

**Last updated:** 2026-09-24  
**Branch:** `main`  
**Handoff commit:** `feat(gameplay): complete stage 3 merge feel, drag feedback, and atomic incubator rewards`

---

## 1. Project Overview

Casual mobile-style merge game built on **Phaser v3.80.1** (browser, no Node build step).  
Designed for **mobile landscape** (960×540 logical px), targeting Yandex Games SDK integration in Stage 3+.

- **Main entry:** `src/main.js`
- **Scenes:** `BootScene` → `GameScene` (always active) | `BattleScene` (launched as overlay) | `CollectionScene` (launched as overlay)
- **Local save:** `localStorage` via `SaveManager`
- **No transpile, no bundler** — vanilla JS + CDN Phaser

---

## 2. Architecture — Coordinate System & HiDPI

### Golden Rule: ALL game logic lives in 960×540 logical space.

| Property | Value |
|---|---|
| Logical width × height | 960 × 540 px |
| Backing buffer | 1920 × 1080 px (RENDER_SCALE = 2.0) |
| `CONFIG.RENDER_SCALE` | auto-computed from DPR and window size (min 1.0, max 2.0) |
| Pointer coords | Always use `pointer.worldX / pointer.worldY` or `helpers.getLogicalPointer()` |
| Text rendering | Always use `createHDText()` from `src/utils/helpers.js` |
| `setScrollFactor(0)` | **Forbidden in GameScene** — use container positioning in logical space |

All four viewports verified by `tools/run_all_verifications.py` (Desktop Full HD, Desktop 1366x768, Mobile Landscape DPR 2, Mobile Landscape DPR 3).

---

## 3. Completed Stages

### Stage 1 — HiDPI Architecture ✅
- Enforced 960×540 logical coordinate system across all scenes
- WebGL backing buffer 1920×1080, `RENDER_SCALE = 2.0`, DPR-aware
- All pointer coords use `worldX/worldY` via `helpers.js`
- Verified across 4 viewports

### Stage 2 — Visual UI Polish ✅
- **Combo bar:** Replaced animated slider with 5 discrete pill buttons (x1–x5🔥). Active pill = gradient highlight; inactive = slate-dark. Thin 3px time-to-reset track below.
- **Quest panel:** Sticker-style cards, round portrait saucer, mini progress bar via `drawCasualProgressBar`, 2/4 counter, completed state, green 3D "ЗАБРАТЬ 🎁" button, pulse only when reward ready.
- **Shop cards:** Pastel premium casual redesign.
- **Bottom dock:** Pill-shaped nav, red "В бой!" CTA.
- **Top bar:** Coins + gem display, level badge.
- **Field layout:** Mob nameplates + level/count badges with layout protection.

### Post-Stage-2 Corrections ✅
- **Skeleton (mob_08) & Creeper (mob_10) sprites fixed:**  
  Neutral-bg filter `(r > 235) & (g > 235) & (b > 235) & (max_diff <= 4)` in `tools/generate_all_mobs.py`. Regenerated 16 PNG files.
- **Incubator READY state:** Badge, timer complete display, ВЫЛУПИТЬ button.
- **3-tap egg hatch flow:** Hero egg, 3-tap interactive crack progression, radial glow reveal.
- **Dev telemetry confirmed disabled** in all release paths.

### Stage 3 Step 1 — Merge Feel, Drag Feedback & Atomic Incubator Rewards ✅
- **Drag/Lift Feel:**
  - On pickup: soft squishy lift with squash/stretch (`scaleX: 1.08, scaleY: 0.94` in 60ms) settling to drag scale `1.10`. Shadow expands (`scale: 1.25, alpha: 0.16`), container elevates (`depth: +1000`).
  - Drag velocity tilt: smooth responsive tilt leaning into motion (clamped $\pm 8^\circ$).
  - Landing squash: drops on empty field snap with bounce squash `(1.06, 0.94) -> (1.0, 1.0)` over 150ms + 4–6 dust puff particles.
- **Valid vs Invalid Drop Behavior:**
  - **Valid Drop:** Drops cleanly to field, updates `mobItem.x/y`, emits dust particles, saves state.
  - **Invalid Drop (Out-of-Bounds or Incompatible Mob Collision):** Mob returns to `_prevValidX`/`_prevValidY` with non-destructive horizontal shake (`-4px -> +4px -> -2px -> 0px` over 150ms) + subtle squash `(1.08, 0.94) -> (1.0, 1.0)`. Zero state mutation, no merge fired, no mob loss, no aggressive red effect.
- **Completion-Driven Merge Sequencing:**
  - **Phase A (Attraction, 100ms):** Both dragged and target containers shrink to `0.88` and converge toward target coordinates.
  - **Phase B (Impact, 50ms):** Dragged container destroyed; target flashes to `1.18` then destroys; spawns shockwave ring, radial particles, and combo-scaled camera shake.
  - **Phase C (Reveal):** Newly merged mob container pops in with Back.Out bounce (`1.22 -> 1.0`), floating `+XP ⭐` arc, and fires unlock modal / quest callbacks strictly in `onComplete` (zero magic timers).
- **Graduated Camera Shake:**
  - Combo x1 & x2: **0** camera shake (protects UI readability during casual play).
  - Combo x3: subtle shake (60ms, 0.002).
  - Combo x4: medium shake (80ms, 0.003).
  - Combo x5: high shake (120ms, 0.005) + double golden shockwave rings + 4-point gold star burst.
- **Tween-Driven Merge Rings:**
  - Replaced legacy `delayedCall(16)` frame timers with standard Phaser tweens driving scale (`0.25 -> 1.0`) and alpha (`0.88 -> 0`) with auto-destroy on complete.
- **Atomic Merge State:**
  - In `MergeField._executeMerge()`, `draggedItem` is immediately removed from `this.mobs` and `targetItem.mobLevel = newLevel` is assigned synchronously at the start of the function. If auto-save or reload occurs mid-animation, state is 100% atomic.
- **Atomic Incubator Reward Semantics:**
  - Transactional order in `GameScene.js`:
    1. Re-entrancy guard: `if (rewardClaimed) return; rewardClaimed = true;`
    2. Synchronous field data allocation: `spawnMobsStaggered()` registers all $N$ reward mobs in `this.mobs` and `this.collection` immediately.
    3. Slot consumed: `slot.active = false; delete slot.endTime;`.
    4. Immediate persistence: `this._save()` is called synchronously before stagger animations start.
    5. Visual stagger: Mobs pop onto the field sequentially (`i * 70ms`) without blocking save integrity. Zero reward loss on mid-animation refresh.
- **Stage 3 Verification Test Suite & Regression Harnesses:**
  - `tools/test_stage3_logic.html` (in-memory headless Chrome logic tests A–F)
  - `tools/verify_stage3_step1.py` (integrated validator: syntax, coords, viewports, and logic tests A–F)
  - Visual render harnesses in `tools/`:
    - `render_drag_lift.html`
    - `render_invalid_drop.html`
    - `render_merge_impact_peak.html`
    - `render_merge_reveal.html`
    - `render_merge_x5.html`
    - `render_bulk_spawn.html`

---

## 4. Incubator Hatch Flow Architecture

### Entry point
```
GameScene._openIncubatorHatchModal(slot, slotIdx)
```
Called when player taps "ВЫЛУПИТЬ" on a ready incubator slot.

### Modal structure
- Container depth: `200000` (above all UI, above telemetry `99999/100000`)
- `this._hatchModal` — main modal container (stored on scene, destroyed on close/claim)
- `this._hatchEggContainer` — egg + glow + cracks container (stored for test harness, nulled on close/claim)

### 3-tap sequence
| Tap | Visual | Sound |
|---|---|---|
| 1 | Thin irregular primary crack (3px) + 1 side branch + white highlight | `playPop()` |
| 2 | Full branching network (4 arms from 2 hubs) + highlights | `playPop()` + particles |
| 3 | White breakFlash → egg hidden → mob reveal with radial glow | `playVictory()` + 20 particles |

### Reward grant logic — exact invariants
- `slot.mobCount` and `slot.mobLevel` are stored at incubation start — NEVER mutated at claim time
- `rewardClaimed` flag (boolean, local) prevents double-grant
- Synchronously allocates all mobs to `mergeField.toState()` and marks slot inactive before visual stagger
- Close button `✕` — does NOT consume reward, slot stays active

---

## 5. Asset Directory Structure

### Active runtime paths (loaded by BootScene.js)
```
assets/mobs/sprites/256/mob_XX.png   ← sprite textures (mob_01 … mob_10)
assets/mobs/portraits/256/mob_XX.png ← portrait textures for incubator/quests
assets/icons/gem.png, sword.png, chest.png, egg.png, gear.png
```

### Legacy / unreferenced paths
```
assets/mobs/256/mob_XX.png     ← legacy pipeline output; NOT referenced in src/
assets/mobs/512/mob_XX.png     ← high-res legacy; NOT referenced in src/
```
> **Do NOT delete legacy directories.** Asset restructuring is deferred to a dedicated maintenance task.

---

## 6. Verification Infrastructure

| Script | Purpose | Expected result |
|---|---|---|
| `tools/validate_syntax.py` | JS bracket balance + syntax scan | All 14 files: OK |
| `tools/audit_coordinates.py` | Grep for `worldX/worldY` usage | Shows all call sites (all correct) |
| `tools/run_all_verifications.py` | Headless Chrome: logical coords, hit-test, HiDPI text across 4 viewports | All pass |
| `tools/verify_stage3_step1.py` | Complete Stage 3 Step 1 verification (syntax, coords, viewports, logic A–F) | All 6 logic checks + viewports pass |
| `tools/capture_screenshot.py <html> <out.png>` | Headless Chrome screenshot capture | Used for all regression shots |

---

## 7. Key File Index

| File | Role |
|---|---|
| `src/config.js` | All constants: 960×540, RENDER_SCALE, economy, colors |
| `src/main.js` | Phaser Game config, scene registration |
| `src/scenes/BootScene.js` | Asset preload; creates color textures |
| `src/scenes/GameScene.js` | Main game loop, UI panels, incubator, quests, shop, combo, bulk spawn |
| `src/scenes/BattleScene.js` | Battle arena overlay |
| `src/scenes/CollectionScene.js` | Bestiary overlay |
| `src/components/SaveManager.js` | localStorage load/save |
| `src/components/Economy.js` | Coins, XP, levels |
| `src/components/MergeField.js` | Drag/drop, lift squash/stretch, invalid drop shake, 3-phase merge, combo rings |
| `src/components/BattleSystem.js` | Battle simulation |
| `src/data/mobs.js` | `BASE_MOBS` array, `getMobByLevel()` |
| `src/utils/helpers.js` | `createHDText`, `drawRoundRect`, `drawCasualProgressBar`, `createCasualButton`, `shakeObject`, `spawnFloatingText`, `getLogicalPointer` |
| `tools/verify_stage3_step1.py` | Stage 3 Step 1 verification test runner |
