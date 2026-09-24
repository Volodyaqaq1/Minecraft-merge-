# NEXT TASK — Stage 3: Gameplay Feel, Juice & Retention

**Status:** Post-Stage-2 finalization committed. Stage 3 NOT yet started.  
**Branch:** `main`  
**Prerequisite:** Read `AGENT_HANDOFF.md` in full before starting any work.

---

## Context

Stage 1 (HiDPI architecture) and Stage 2 (visual UI polish + incubator hatch flow) are complete and approved.  
The game is visually clean, architecturally correct, and all regression tests pass.

Stage 3 is about **game feel, juice, and long-term player retention** — not new major UI panels.  
All changes must remain within the 960×540 logical coordinate system.  
All pointer handling must continue using `pointer.worldX / pointer.worldY`.  
All text must use `createHDText()`.  
No `setScrollFactor(0)` in zoomed scenes.

---

## Stage 3 — Priority List

Work through these in order. Do NOT batch all items at once.  
After each item: validate, screenshot, report, wait for approval before proceeding.

---

### 3.1 — Merge Feel (Highest Priority)

**Goal:** The moment a merge completes should feel satisfying and tactile.

- Add a quick **pop/scale burst** on the merged mob when it spawns (Back.Out ease, ~120ms)
- Add a brief **squash on landing** (scaleX 1.2 / scaleY 0.8, then bounce back)
- Add a **ring pulse** graphic at the merge point (thin circle expanding + fading, ~200ms)
- Optionally: a brief 2–3 particle sparkle at merge center
- No new permanent objects — all merge feedback must auto-destroy

---

### 3.2 — Drag/Drop Squash & Stretch

**Goal:** Dragging a mob should feel physical and alive.

- When mob is **picked up**: slight scale-up (1.08×) + subtle rotation lean in drag direction
- When **dragged fast**: stretch in direction of motion (scaleX/Y based on velocity delta)
- When **dropped (no merge)**: small bounce landing squash (scaleY 0.85 → 1.0)
- When **dropped on merge target**: trigger 3.1 merge burst instead

Implementation note: MergeField.js handles drag — extend it without breaking existing drag delta logic.

---

### 3.3 — Merge Particles / Impact Feedback

**Goal:** Merges should have a brief but clear visual impact cloud.

- Small burst of 6–8 star/sparkle particles at merge position
- Particles must **auto-destroy** — no accumulated permanent objects
- Use same `_spawnHatchBurst` pattern or write a reusable `spawnMergeParticles(scene, x, y)` in `helpers.js`
- Keep particle lifetime short: 300–500ms max

---

### 3.4 — Better Floating Income Numbers

**Goal:** Coin income on mob tap should feel rewarding and readable.

Current: `spawnFloatingText()` in helpers.js.

Improvements:
- Larger initial size (~22px) then shrinks as it rises
- Brief horizontal wobble ±4px as it floats up
- Color graduation: gold → lighter gold → fade out
- Combo multiplier (x2–x5) should show a **larger, bolder** text with a different color accent
- Ensure no floating text objects accumulate — all must destroy on tween complete

---

### 3.5 — Combat Impact Feedback

**Goal:** Battle hits should feel physical and snappy.

- Attacker: small **forward lunge** (translate 12px toward target, then snap back, 80ms + 80ms)
- Defender: **hit flash** (brief white tint flicker, 60ms) + **shake** (use existing `shakeObject`)
- Wall HP bar: **brief red pulse** flash when hit
- Victory: reuse existing victory modal, but add a **brief screen flash** (white 0.15 alpha → 0, 200ms) at kill moment

---

### 3.6 — Sound Progression / Combo Audio

**Goal:** The combo multiplier escalation should have distinct audio cues.

- x1 → x2: soft ascending ding
- x3: slightly higher / brighter tone  
- x4: noticeable step up
- x5🔥: satisfying full combo sound (distinct from regular pop)
- Merge: deeper satisfying "thud" or "bloop" distinct from tap
- Check: `SoundManager.js` currently has `playPop()`, `playClick()`, `playVictory()` — extend as needed

> Note: The game may not have audio assets yet. If so, create placeholder stubs in SoundManager and document what audio files are needed.

---

### 3.7 — Progression Pacing & Retention

**Goal:** Keep players engaged across sessions.

- **Daily login bonus** — simple day-streak counter in SaveManager + modal on first load each day
- **Incubator notification badge** — already has a red dot, ensure it fires correctly on ready
- **Quest variety** — review current quest generation; ensure players always have at least 2 active meaningful quests
- **First-session onboarding** — simple 3-step tooltip sequence for new players (tap a mob, merge two mobs, open shop)
- Do NOT add push notifications or server-side features here — local only

---

### 3.8 — Mobile UX Pass

**Goal:** Ensure comfortable playability on real mobile devices.

- Audit all interactive hit zones: minimum 44×44px per mobile HIG
- Verify combo pill buttons are large enough for thumbs
- Verify bottom dock tap targets on small screens (360×640 viewport)
- Check incubator modal close button is easily tappable
- Check quest "ЗАБРАТЬ" button hit zone
- Run `run_all_verifications.py` after any layout change

---

### 3.9 — Yandex Games SDK Integration Review

**Goal:** Prepare for Yandex Games SDK integration.

This is a **review and stub task only** — do not implement live SDK calls.

- Read existing `SoundManager.js` Yandex stub
- Document: what SDK calls are needed (ads, leaderboard, save sync, auth)
- Create a `src/utils/YandexSDK.js` stub with commented method signatures
- Ensure `SaveManager.js` can be extended to support cloud save without breaking local save
- Do not submit to Yandex store in this task

---

## Implementation Rules (Carry Forward from Stage 2)

- Work strictly by item. One item at a time. Validate and screenshot each.
- Do NOT commit until visual approval is given for that item.
- Do NOT change gameplay balance or economy values unless directly required.
- Do NOT redesign approved UI panels (combo pills, quest cards, shop cards, bottom dock, top bar).
- Do NOT break HiDPI / coordinate system invariants.
- Do NOT add new mutation mechanics.
- Do NOT add new RNG at reward-claim time.
- Do NOT use `setTimeout()` in test harnesses (use `requestAnimationFrame` polling).
- All new tweens must have `onComplete: () => obj.destroy()` or equivalent cleanup.

---

## Verification Checklist (Before Any Commit)

```
python tools/validate_syntax.py          # All files: OK
python tools/audit_coordinates.py        # All pointer coords: worldX/worldY
python tools/run_all_verifications.py    # All 4 viewports pass
```

Plus visual approval via regenerated screenshots.

---

## Asset Note

- `assets/mobs/sprites/256/` — **active runtime path** (loaded by BootScene.js)
- `assets/mobs/256/` — **legacy, unreferenced** — keep, do not delete, clean up in dedicated maintenance task
