// ============================================================
// utils/SoundManager.js — процедурный синтезатор звуков на Web Audio API
// Не требует внешних файлов, работает с нулевой задержкой и без сбоев сети
// ============================================================

const SoundManager = (function () {
    let ctx = null;
    let enabled = true;

    function getContext() {
        if (!ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                ctx = new AudioCtx();
            }
        }
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        return ctx;
    }

    // Автоматическая активация аудио при первом же касании или клике в игре
    function ensureAudioUnlocked() {
        const unlock = () => {
            const c = getContext();
            if (c && c.state === 'running') {
                ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
                    window.removeEventListener(evt, unlock);
                });
            }
        };
        ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
            window.addEventListener(evt, unlock, { passive: true });
        });
    }

    if (typeof window !== 'undefined') {
        ensureAudioUnlocked();
    }

    return {
        setEnabled(val) {
            enabled = !!val;
        },
        isEnabled() {
            return enabled;
        },

        // --- 1. Клик по кнопке интерфейса ---
        playClick() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(480, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(c.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        },

        // --- 2. Падение / появление моба на поле (мягкий поп) ---
        playPop() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(c.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        },

        // --- 3. Столкновение / кликер по мобу ---
        playClink() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const osc = c.createOscillator();
            const gain = c.createGain();

            osc.type = 'sine';
            const baseFreq = 700 + Math.random() * 200;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(c.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        },

        // --- 3b. Удар в бою (деревянный/панчевый звук с критом) ---
        playHit(isCrit = false) {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;

            // Басовый панч (thud)
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = isCrit ? 'sawtooth' : 'triangle';
            const startFreq = isCrit ? 220 : 160;
            const endFreq = isCrit ? 50 : 40;
            const dur = isCrit ? 0.12 : 0.08;

            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

            gain.gain.setValueAtTime(isCrit ? 0.35 : 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            osc.connect(gain);
            gain.connect(c.destination);
            osc.start(now);
            osc.stop(now + dur);

            // Для крита — дополнительный яркий щелчок/искра
            if (isCrit) {
                const osc2 = c.createOscillator();
                const gain2 = c.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880, now);
                osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.09);

                gain2.gain.setValueAtTime(0.2, now);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

                osc2.connect(gain2);
                gain2.connect(c.destination);
                osc2.start(now);
                osc2.stop(now + 0.09);
            }
        },

        // --- 4. Звук слияния (Merge) с динамическим повышением тона при комбо ---
        playMerge(comboLevel = 1) {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const pitchScale = Math.min(2.5, Math.pow(1.15, Math.max(0, comboLevel - 1)));

            // Аккорд из двух гармоничных нот (C5 + E5 со сдвигом на G5)
            const freqs = [523.25 * pitchScale, 659.25 * pitchScale, 783.99 * pitchScale];

            freqs.forEach((freq, idx) => {
                const osc = c.createOscillator();
                const gain = c.createGain();

                osc.type = 'triangle';
                const startTime = now + idx * 0.04;
                osc.frequency.setValueAtTime(freq, startTime);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.08, startTime + 0.16);

                gain.gain.setValueAtTime(0.22, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.22);
            });
        },

        // --- 5. Звон монет / изумрудов ---
        playCoin() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            [987.77, 1318.51].forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();

                osc.type = 'sine';
                const startTime = now + i * 0.06;
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.25, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.14);
            });
        },

        // --- 6. Победный фанфар ---
        playVictory() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const notes = [
                { f: 523.25, d: 0.12 }, // C5
                { f: 659.25, d: 0.12 }, // E5
                { f: 783.99, d: 0.14 }, // G5
                { f: 1046.50, d: 0.38 }, // C6
            ];

            let offset = 0;
            notes.forEach(n => {
                const osc = c.createOscillator();
                const gain = c.createGain();

                osc.type = 'triangle';
                const t = now + offset;
                osc.frequency.setValueAtTime(n.f, t);

                gain.gain.setValueAtTime(0.28, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(t);
                osc.stop(t + n.d);

                offset += n.d * 0.75;
            });
        },

        // --- 7. Звук поражения ---
        playDefeat() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4

            let offset = 0;
            notes.forEach((freq, i) => {
                const osc = c.createOscillator();
                const gain = c.createGain();

                osc.type = 'sawtooth';
                const t = now + offset;
                osc.frequency.setValueAtTime(freq, t);

                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(t);
                osc.stop(t + 0.2);

                offset += 0.14;
            });
        },

        // --- 8. Эпический фанфар открытия нового моба (Dopamine Fanfare) ---
        playNewMobFanfare() {
            if (!enabled) return;
            const c = getContext();
            if (!c) return;

            const now = c.currentTime;
            const melody = [
                { f: 440.00, t: 0.00, dur: 0.12 }, // A4
                { f: 554.37, t: 0.10, dur: 0.12 }, // C#5
                { f: 659.25, t: 0.20, dur: 0.14 }, // E5
                { f: 880.00, t: 0.32, dur: 0.45 }, // A5
                { f: 1108.73, t: 0.50, dur: 0.55 }, // C#6
            ];

            melody.forEach(note => {
                const osc = c.createOscillator();
                const gain = c.createGain();

                osc.type = 'triangle';
                const st = now + note.t;
                osc.frequency.setValueAtTime(note.f, st);

                gain.gain.setValueAtTime(0.32, st);
                gain.gain.exponentialRampToValueAtTime(0.001, st + note.dur);

                osc.connect(gain);
                gain.connect(c.destination);

                osc.start(st);
                osc.stop(st + note.dur);
            });
        },

        playFanfare() {
            this.playNewMobFanfare();
        },
    };
})();
