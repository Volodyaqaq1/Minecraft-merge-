// ============================================================
// components/Economy.js — монеты, XP, уровень, множитель
// ============================================================

class Economy {
    constructor(state) {
        this.coins      = state.player.coins;
        this.xp         = state.player.xp;
        this.level      = state.player.level;
        this.multiplier = state.player.multiplier;

        // Коллбеки для обновления UI (GameScene подпишется)
        this.onCoinsChange      = null;
        this.onLevelChange      = null;
        this.onMultiplierChange = null;
    }

    // ---- Монеты ----

    addCoins(amount) {
        this.coins += Math.floor(amount);
        if (this.onCoinsChange) this.onCoinsChange(this.coins);
    }

    spendCoins(amount) {
        if (this.coins < amount) return false;
        this.coins -= amount;
        if (this.onCoinsChange) this.onCoinsChange(this.coins);
        return true;
    }

    canAfford(amount) {
        return this.coins >= amount;
    }

    // ---- Опыт и уровень ----

    addXP(amount) {
        this.xp += amount;
        const newLevel = getLevelFromXP(this.xp);
        if (newLevel !== this.level) {
            this.level = newLevel;
            this.multiplier = getMultiplier(this.level);
            if (this.onLevelChange) this.onLevelChange(this.level);
            if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
        }
    }

    /**
     * Прогресс к следующему уровню [0..1]
     */
    getLevelProgress() {
        const table = CONFIG.XP_TO_LEVEL;
        const curXP = table[this.level - 1] || 0;
        const nextXP = table[this.level] || table[table.length - 1];
        if (nextXP <= curXP) return 1;
        return Math.min(1, (this.xp - curXP) / (nextXP - curXP));
    }

    // ---- Мёрдж ----

    /**
     * Вызывается при каждом мёрдже. Начисляет монеты + XP.
     * mob — объект моба из MOBS (тот что получился)
     */
    onMerge(mob) {
        const coins = Math.floor(mob.atk * CONFIG.MERGE_COIN_MULTIPLIER * this.multiplier);
        this.addCoins(coins);
        this.addXP(CONFIG.XP_PER_MERGE);
        return coins; // вернём чтобы показать floating text
    }

    // ---- Бои ----

    /**
     * Начислить приз за победу в бою
     */
    onBattleWin(prizeAmount) {
        this.addCoins(prizeAmount);
        this.addXP(CONFIG.XP_PER_MERGE * 5); // бонус xp
    }

    // ---- Сериализация ----

    toState() {
        return {
            level:      this.level,
            xp:         this.xp,
            coins:      this.coins,
            multiplier: this.multiplier,
        };
    }
}
