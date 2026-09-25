// ============================================================
// components/SaveManager.js — сохранение в localStorage с миграцией v2
// ============================================================

const SaveManager = {
    KEY: 'bestiary_squishy_save_v1',

    DEFAULT_STATE: {
        saveVersion: 2,
        player: {
            level: 1,
            xp: 0,
            coins: CONFIG.STARTING_COINS, // 100 монет (ровно на 2 цыпы)
            multiplier: 1,
        },
        field: [],          // [{ id, mobLevel, x, y }, ...]
        collection: [1],    // открытые уровни мобов (1..90)
        freeSpawnTime: 0,   // timestamp когда можно брать бесплатного
        currentEvolution: 'ordinary',
        elementalEvolutionUnlocked: false,
        goldenEvolutionUnlocked: false,
        selectedWorld: 'green_hills',
        unlockedWorlds: ['green_hills'],
        features: {
            incubator:      { unlocked: false, animSeen: false, firstOpened: false },
            rewards:        { unlocked: false, animSeen: false, firstOpened: false },
            quests:         { unlocked: false, animSeen: false, firstOpened: false },
            shop_ad:        { unlocked: false, animSeen: false, firstOpened: false },
            world_selector: { unlocked: false, animSeen: false, firstOpened: false },
        },
        incubatorSlots: [
            { id: 0, unlockLevel: 6, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0, adSpeedupUsed: false },
            { id: 1, unlockLevel: 15, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0, adSpeedupUsed: false },
            { id: 2, unlockLevel: 25, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0, adSpeedupUsed: false },
        ],
        playtime: {
            totalSeconds: 0,
            startedAt: null,
            claimed: {},    // { 0: true, 1: true... }
        },
        quests: [],         // активные задания [{ id, mobLevel, targetCount, currentCount, isCompleted, rewardCoins, rewardXP }, ...]
        shownModals: [1],   // уровни мобов, модалка для которых уже показывалась
    },

    /**
     * Загрузить сохранение (возвращает объект состояния с миграцией)
     */
    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return this._deepClone(this.DEFAULT_STATE);
            const saved = JSON.parse(raw);
            const isV1 = !saved || !saved.saveVersion || saved.saveVersion < 2;
            const merged = this._merge(this._deepClone(this.DEFAULT_STATE), saved);
            if (isV1) {
                merged.saveVersion = 1;
            }
            return this._migrate(merged);
        } catch (e) {
            console.warn('SaveManager: ошибка загрузки, сброс', e);
            return this._deepClone(this.DEFAULT_STATE);
        }
    },

    /**
     * Сохранить состояние
     */
    save(state) {
        if (!state || typeof state !== 'object') return;
        try {
            localStorage.setItem(this.KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('SaveManager: ошибка сохранения', e);
        }
    },

    /**
     * Сбросить прогресс
     */
    reset() {
        localStorage.removeItem(this.KEY);
        try {
            localStorage.removeItem('mc_merge_save_v2');
            localStorage.removeItem('mc_merge_save_v1');
        } catch (e) {}
    },

    /**
     * Безопасная миграция сохранений на канонический порядок и 3 эволюции
     */
    _migrate(state) {
        if (!state || typeof state !== 'object') return this._deepClone(this.DEFAULT_STATE);

        // Миграция со старого порядка (v1 -> v2)
        if (!state.saveVersion || state.saveVersion < 2) {
            const oldToNewMap = {
                1: 1,   // Цыпа -> Цыпа
                2: 3,   // Хрюша -> Хрюша (теперь #3)
                3: 4,   // Бурёнка -> Бурёнка (теперь #4)
                4: 5,   // Овечка -> Овечка (теперь #5)
                5: 2,   // Кролик -> Кролик (теперь #2)
                6: 6,   // Летучая мышка -> Летучая мышка (#6)
                7: 11,  // Зомбик -> Зомбик (теперь #11)
                8: 12,  // Скелетик -> Скелетик (теперь #12)
                9: 8,   // Паучок -> Паучок (теперь #8)
                10: 10, // Бумик -> Бумик (#10)
            };

            if (Array.isArray(state.field)) {
                state.field.forEach(mob => {
                    if (mob && mob.mobLevel && oldToNewMap[mob.mobLevel]) {
                        mob.mobLevel = oldToNewMap[mob.mobLevel];
                    }
                });
            }

            if (Array.isArray(state.collection)) {
                const newCol = new Set();
                state.collection.forEach(lvl => {
                    if (oldToNewMap[lvl]) newCol.add(oldToNewMap[lvl]);
                    else if (lvl > 0 && lvl <= 90) newCol.add(lvl);
                });
                if (!newCol.has(1)) newCol.add(1);
                state.collection = Array.from(newCol).sort((a, b) => a - b);
            }

            if (Array.isArray(state.quests)) {
                state.quests.forEach(q => {
                    if (q && q.mobLevel && oldToNewMap[q.mobLevel]) {
                        q.mobLevel = oldToNewMap[q.mobLevel];
                    }
                });
            }

            // Для старых игроков, у которых уже открыты фичи, не показываем стартовую анимацию повторно
            if (state.player && state.player.level) {
                state.features = state.features || {};
                if (state.player.level >= 6)  state.features.incubator = { unlocked: true, animSeen: true, firstOpened: true };
                if (state.player.level >= 9)  state.features.rewards   = { unlocked: true, animSeen: true, firstOpened: true };
                if (state.player.level >= 11) state.features.quests    = { unlocked: true, animSeen: true, firstOpened: true };
            }

            state.saveVersion = 2;
        }

        // Гарантируем валидность коллекции мобов (числа >= 1)
        if (!Array.isArray(state.collection) || state.collection.length === 0) {
            state.collection = [1];
        } else {
            const cleanCol = new Set();
            state.collection.forEach(lvl => {
                const n = Number(lvl);
                if (Number.isFinite(n) && n >= 1 && n <= 90) cleanCol.add(n);
            });
            if (!cleanCol.has(1)) cleanCol.add(1);
            state.collection = Array.from(cleanCol).sort((a, b) => a - b);
        }

        // Также добавляем в коллекцию любых мобов, которые есть на поле
        if (Array.isArray(state.field)) {
            state.field.forEach(mob => {
                if (mob && Number.isFinite(Number(mob.mobLevel)) && Number(mob.mobLevel) >= 1) {
                    if (!state.collection.includes(Number(mob.mobLevel))) {
                        state.collection.push(Number(mob.mobLevel));
                    }
                }
            });
            state.collection.sort((a, b) => a - b);
        }

        // Уровень игрока строго равен максимальному открытому мобу
        if (!state.player || typeof state.player !== 'object') {
            state.player = { level: 1, xp: 0, coins: CONFIG.STARTING_COINS, multiplier: 1 };
        }
        const maxFromCol = Math.max(...state.collection, 1);
        state.player.level = Math.max(Number(state.player.level) || 1, maxFromCol);

        // Гарантируем наличие новых полей
        if (!state.currentEvolution) state.currentEvolution = 'ordinary';
        if (state.elementalEvolutionUnlocked === undefined) {
            state.elementalEvolutionUnlocked = state.collection.some(lvl => lvl >= 30);
        }
        if (state.goldenEvolutionUnlocked === undefined) {
            state.goldenEvolutionUnlocked = state.collection.some(lvl => lvl >= 60);
        }

        const validWorlds = (typeof WORLDS !== 'undefined' && Array.isArray(WORLDS))
            ? WORLDS.map(w => w.id)
            : ['green_hills', 'sunset_valley', 'night_meadow', 'ice_world', 'fire_world', 'end_world', 'golden_world'];
        if (!state.selectedWorld || !validWorlds.includes(state.selectedWorld)) {
            state.selectedWorld = 'green_hills';
        }
        if (!Array.isArray(state.unlockedWorlds)) {
            state.unlockedWorlds = ['green_hills'];
        } else if (!state.unlockedWorlds.includes('green_hills')) {
            state.unlockedWorlds.unshift('green_hills');
        }

        if (!state.features || typeof state.features !== 'object') {
            const pLvl = state.player.level || 1;
            state.features = {
                incubator:      { unlocked: pLvl >= 6,  animSeen: pLvl >= 6,  firstOpened: pLvl >= 6 },
                rewards:        { unlocked: pLvl >= 9,  animSeen: pLvl >= 9,  firstOpened: pLvl >= 9 },
                quests:         { unlocked: pLvl >= 11, animSeen: pLvl >= 11, firstOpened: pLvl >= 11 },
                shop_ad:        { unlocked: false, animSeen: true, firstOpened: true },
                world_selector: { unlocked: false, animSeen: true, firstOpened: true },
            };
        }

        return state;
    },

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    _merge(target, source) {
        if (!source || typeof source !== 'object') return target;
        for (const key in source) {
            if (source[key] === undefined || source[key] === null) continue;
            if (Array.isArray(source[key])) {
                target[key] = source[key];
            } else if (typeof source[key] === 'object') {
                if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
                    target[key] = {};
                }
                this._merge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    },
};
