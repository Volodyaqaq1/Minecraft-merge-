# AGENT HANDOFF — Minecraft-Merge (Squishy Merge)

**Last updated:** 2026-09-24  
**Branch:** `main`  
**Handoff commit:** `feat(gameplay): polish incubator hatch flow, clean mob sprites, and finalize post-stage-2 UX`

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

All four viewports verified by `tools/run_all_verifications.py` (360×640, 768×1024, 1280×720, 1920×1080).

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
  Root cause: top rows had near-white pixels RGB(238–241) — previous alpha threshold `r > 242` missed them.  
  Fix: added `(r > 235) & (g > 235) & (b > 235) & (max_diff <= 4)` in `tools/generate_all_mobs.py`.  
  Regenerated 16 PNG files across all size/directory variants.
- **Incubator READY state:** Badge, timer complete display, ВЫЛУПИТЬ button.
- **3-tap egg hatch flow:** Interactive modal `_openIncubatorHatchModal()` — see Section 4.
- **Dev telemetry confirmed disabled** in all release paths.

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

### Crack implementation (GameScene.js ~line 1822, ~1869)
- Tap 1: 3px dark (`#1e293b`), 5-segment zigzag, 1 tiny branch, 1.5px white highlight
- Tap 2: 4px main spine + 3.5px right/left branches (3 segments each) + 2.5px upper-right mini-branch + 2px taper + highlights on major paths

### Mob reveal (GameScene.js ~line 1955)
- **Pedestal:** ellipse 150×32px (shadow 158×30), white fill, 3px green stroke
- **Radial glow** (`mobGlow`): 5-layer, 125r@4% → 100r@7% → 76r@10% → 52r@12% → 30r@7% — fades naturally
- **Mob avatar:** 188px (portrait texture)
- **Badge:** "+Nx MobName (Lv.X)" green card
- **CTA:** "ЗАБРАТЬ 🎁" 230×50 green button

### Reward grant logic — exact invariants
- `slot.mobCount` and `slot.mobLevel` are stored at incubation start — NEVER mutated at claim time
- `rewardClaimed` flag (boolean, local) prevents double-grant
- Close button `✕` — does NOT consume reward, slot stays active
- Reopening: guard destroys existing modal first
- **No mutation mechanic** — `hasMutant`/`mutantLevel` do NOT exist anywhere in codebase

### Guards
```js
if (isDebouncing || currentTaps >= 3) return;  // tap debounce
if (rewardClaimed) return;                       // double-claim guard
```

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

### Sprite extraction pipeline
- Source skins: `assets/mobs/skins/` (e.g. `Skeleton.jpg`, `crepper.jpg`)
- Pipeline script: `tools/generate_all_mobs.py`
- Key fix (mob_08/10): neutral-bg filter `(r > 235) & (g > 235) & (b > 235) & (max_diff <= 4)`
- Output: all 5 size directories × portraits

---

## 6. Verification Infrastructure

| Script | Purpose | Expected result |
|---|---|---|
| `tools/validate_syntax.py` | JS bracket balance + syntax scan | All 14 files: OK |
| `tools/audit_coordinates.py` | Grep for `worldX/worldY` usage | Shows all call sites (all correct) |
| `tools/run_all_verifications.py` | Headless Chrome: logical coords, hit-test, HiDPI text across 4 viewports | All pass |
| `tools/capture_screenshot.py <html> <out.png>` | Headless Chrome screenshot capture | Used for all regression shots |

### Regression render harnesses (in `tools/`)
- `render_screenshot.html` — main gameplay field
- `render_battle_screenshot.html` — battle scene
- `render_battle_modal_screenshot.html` — pre-battle modal
- `render_battle_flow_modals.html` — victory/defeat modals
- `render_collection_screenshot.html` — bestiary/collection
- `render_incubator_ready.html` — incubator READY state
- `render_incubator_mid.html` — egg hatch mid-flow (tap 2)
- `render_incubator_reveal.html` — egg hatch reward reveal (tap 3)

---

## 7. Dev Telemetry

- Method: `GameScene._buildDevDebugOverlay()` (~line 2899)
- Gate: `location.search.includes('debug=1') || CONFIG.DEBUG === true`
- `CONFIG.DEBUG` is **not defined** in `config.js` — evaluates to `undefined === true` → `false`
- All render HTML test files explicitly set `CONFIG.DEBUG = false` before Phaser init
- `capture_screenshot.py` does NOT append `?debug=1` to URLs
- **Release captures contain zero telemetry**

---

## 8. Key File Index

| File | Role |
|---|---|
| `src/config.js` | All constants: 960×540, RENDER_SCALE, economy, colors |
| `src/main.js` | Phaser Game config, scene registration |
| `src/scenes/BootScene.js` | Asset preload; creates color textures |
| `src/scenes/GameScene.js` | Main game loop, all UI panels, incubator, quests, shop, combo |
| `src/scenes/BattleScene.js` | Battle arena overlay |
| `src/scenes/CollectionScene.js` | Bestiary overlay |
| `src/components/SaveManager.js` | localStorage load/save |
| `src/components/Economy.js` | Coins, XP, levels |
| `src/components/MergeField.js` | Drag/drop merge logic |
| `src/components/BattleSystem.js` | Battle simulation |
| `src/data/mobs.js` | `BASE_MOBS` array, `getMobByLevel()` |
| `src/utils/helpers.js` | `createHDText`, `drawRoundRect`, `drawCasualProgressBar`, `createCasualButton`, `shakeObject`, `spawnFloatingText`, `getLogicalPointer` |
| `tools/generate_all_mobs.py` | Sprite extraction pipeline |

---

## 9. Working Tree State at Handoff

- Branch: `main`
- All changes committed and pushed
- Working tree: **clean**
- No debug flags, no forced states, no test hooks in production code
