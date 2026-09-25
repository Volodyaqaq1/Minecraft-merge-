# NEXT TASK — Stage 3 Step 3: Audio Polish & Platform Integration Readiness

**Status:** Stage 3 Step 1, Step 2 (Combat Juice), and Progression & Balance Pass completed and verified.  
**Branch:** `main`  
**Prerequisite:** Read `AGENT_HANDOFF.md` in full before starting any work.

---

## Context

1. **Stage 3 Step 1:** Merge tactile feel, drag lift, invalid drop shake, combo shockwaves, and atomic incubator rewards completed.
2. **Stage 3 Step 2:** Combat Juice (attacker lunge, defender squash & hit flash, dynamic procedural wall damage, wood chip particles, floating damage numbers, critical burst, wall collapse, and victory rush) completed.
3. **Progression & Balance Pass:**
   - Level gating ladder (Player Lv.1 base, mob Lv.4 ad offer, Lv.6 incubator slot 1, Lv.9 online rewards, Lv.11 quests, Lv.15 slot 2, Lv.25 slot 3).
   - Incubator 30% speedup per incubation cycle.
   - 3-mob opponent bot team with power-ratio scaled damage for exact 50/50 balance.
   - Clean top bar (gift button removed, combo bar centered, red knob removed).
   - Field persistence guard preventing mob loss across scene transitions.

---

## Implementation Priority for Next Step

### 1. Audio Pass / Sound Polish
- Add satisfying synthesized Web Audio effects for:
  - Button presses and dock navigation tabs.
  - Wall break final shatter.
  - Chest opening in battle victory.
  - Quests claim fanfare.
  - Incubator -30% speedup confirmation.
- Ensure audio mute toggle in settings cleanly silences all Web Audio nodes without audio context errors.

### 2. Platform Integration Readiness (Yandex Games SDK / Mobile Wrapper)
- Prepare clean abstraction hooks for:
  - Rewarded video ad triggers (right-panel ad mob, incubator -30% speedup, battle x2 reward).
  - Interstitial ad triggers on scene transitions.
  - Cloud save sync with fallback to `localStorage`.
- Verify responsive layout across aspect ratios (16:9, 18:9, 19.5:9 mobile screens).

---

## Verification Checklist (Before Commit)

```bash
python tools/validate_syntax.py          # All JS files: OK
python tools/test_progression_pass.py    # All 43 progression assertions pass
```
