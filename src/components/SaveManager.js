// ============================================================
// components/SaveManager.js — сохранение в localStorage
// ============================================================

const SaveManager = {
    KEY: 'mc_merge_save',

    DEFAULT_STATE: {
        player: {
            level: 1,
            xp: 0,
            coins: 500,
            multiplier: 1,
        },
        field: [],          // [{ slot: 0, mobLevel: 3 }, ...]
        queue: [],          // [3, 1, 2, 4] — уровни мобов в очереди
        collection: [1],    // открытые уровни мобов
        shopSlots: [null, null], // [mobLevel|null, mobLevel|null]
        freeSpawnTime: 0,   // timestamp когда можно брать следующего
        incubator: null,    // { finishTime, mobLevel } | null
    },

    /**
     * Загрузить сохранение (возвращает объект состояния)
     */
    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return this._deepClone(this.DEFAULT_STATE);
            const saved = JSON.parse(raw);
            // Мержим с дефолтом чтобы новые поля появлялись
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
        return saved;
    },
};
