// ============================================================
// components/SaveManager.js — сохранение в localStorage
// ============================================================

const SaveManager = {
    KEY: 'bestiary_squishy_save_v1',

    DEFAULT_STATE: {
        player: {
            level: 1,
            xp: 0,
            coins: CONFIG.STARTING_COINS, // 100 монет (ровно на 2 цыпы)
            multiplier: 1,
        },
        field: [],          // [{ id, mobLevel, x, y }, ...]
        collection: [1],    // открытые уровни мобов
        freeSpawnTime: 0,   // timestamp когда можно брать бесплатного
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
