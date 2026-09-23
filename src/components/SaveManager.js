// ============================================================
// components/SaveManager.js — сохранение в localStorage
// ============================================================

const SaveManager = {
    KEY: 'mc_merge_save_v2',

    DEFAULT_STATE: {
        player: {
            level: 1,
            xp: 0,
            coins: CONFIG.STARTING_COINS, // 100 монет (ровно на 2 курицы)
            multiplier: 1,
        },
        field: [],          // [{ id, mobLevel, x, y }, ...]
        collection: [1],    // открытые уровни мобов
        freeSpawnTime: 0,   // timestamp когда можно брать бесплатного
        incubatorSlots: [
            { id: 0, unlockLevel: 5, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
            { id: 1, unlockLevel: 10, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
            { id: 2, unlockLevel: 15, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
        ],
        playtime: {
            totalSeconds: 0,
            claimed: {},    // { 0: true, 1: true... }
        },
        quests: [],         // активные задания [{ id, mobLevel, targetCount, currentCount, isCompleted, rewardCoins, rewardXP }, ...]
        shownModals: [1],   // уровни мобов, модалка для которых уже показывалась
    },

    /**
     * Загрузить сохранение (возвращает объект состояния)
     */
    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return this._deepClone(this.DEFAULT_STATE);
            const saved = JSON.parse(raw);
            return this._merge(this._deepClone(this.DEFAULT_STATE), saved);
        } catch (e) {
            console.warn('SaveManager: ошибка загрузки, сброс', e);
            return this._deepClone(this.DEFAULT_STATE);
        }
    },

    /**
     * Сохранить состояние
     */
    save(state) {
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
    },

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    _merge(def, saved) {
        for (const key in def) {
            if (saved[key] === undefined) {
                saved[key] = def[key];
            } else if (typeof def[key] === 'object' && !Array.isArray(def[key]) && def[key] !== null) {
                saved[key] = this._merge(def[key], saved[key]);
            }
        }
        // Массивы берём из saved если они есть
        if (Array.isArray(saved.field)) def.field = saved.field;
        if (Array.isArray(saved.collection)) def.collection = saved.collection;
        if (Array.isArray(saved.incubatorSlots)) def.incubatorSlots = saved.incubatorSlots;
        if (Array.isArray(saved.quests)) def.quests = saved.quests;
        if (Array.isArray(saved.shownModals)) def.shownModals = saved.shownModals;
        if (saved.playtime) def.playtime = saved.playtime;
        return def;
    },
};
