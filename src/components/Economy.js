// ============================================================
// components/Economy.js — монеты, XP, уровень, множитель
// ============================================================

class Economy {
    constructor(state) {
        this.coins      = state.player.coins;
        this.xp         = state.player.xp;
        this.level      = state.player.level;
        this.multiplier = state.player.multiplier || 1;

        // Коллбеки для обновления UI
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

    getLevelProgress() {
        const table = CONFIG.XP_TO_LEVEL;
        const curXP = table[this.level - 1] || 0;
        const nextXP = table[this.level] || table[table.length - 1];
        if (nextXP <= curXP) return 1;
        return Math.min(1, (this.xp - curXP) / (nextXP - curXP));
    }

    // ---- Мёрдж: ТОЛЬКО ОПЫТ (БЕЗ МОНЕТ) ----

    /**
     * Вызывается при каждом слиянии. Начисляет ТОЛЬКО XP!
     */
    onMerge(mob) {
        const xpEarned = Math.round(CONFIG.XP_PER_MERGE * Math.sqrt(mob.level));
        this.addXP(xpEarned);
        return xpEarned; // возвращаем количество полученного опыта
    }

    // ---- Бои ----

    onBattleWin(prizeAmount) {
        this.addCoins(prizeAmount);
        this.addXP(CONFIG.XP_PER_MERGE * 4);
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
