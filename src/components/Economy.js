// ============================================================
// components/Economy.js — монеты, XP, уровень, множитель
// ============================================================

class Economy {
    constructor(state) {
        this.coins      = state.player.coins;
        this.xp         = state.player.xp || 0;
        this.level      = state.player.level || 1;
        this.multiplier = state.player.multiplier || 1;

        // Коллбеки для обновления UI
        this.onCoinsChange      = null;
        this.onLevelChange      = null;
        this.onMultiplierChange = null;
        this.onXPChange         = null; // вызывается при любом начислении опыта
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
        const levelChanged = (newLevel !== this.level);

        if (levelChanged) {
            this.level = newLevel;
            this.multiplier = getMultiplier(this.level);
            if (this.onLevelChange) this.onLevelChange(this.level);
            if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
        }

        if (this.onXPChange) {
            this.onXPChange(this.getXPDetails());
        }
    }

    getXPDetails() {
        const table = CONFIG.XP_TO_LEVEL;
        const curBase = table[this.level - 1] || 0;
        const nextBase = table[this.level] || (curBase + 1000);
        const curInLevel = Math.max(0, this.xp - curBase);
        const neededInLevel = Math.max(1, nextBase - curBase);
        const progress = Math.min(1, curInLevel / neededInLevel);
        return {
            level: this.level,
            curInLevel,
            neededInLevel,
            progress,
        };
    }

    getLevelProgress() {
        return this.getXPDetails().progress;
    }

    // ---- Мёрдж: ТОЛЬКО ОПЫТ (БЕЗ МОНЕТ) ----

    /**
     * Вызывается при каждом слиянии. Начисляет ТОЛЬКО XP!
     */
    onMerge(mob) {
        const xpEarned = Math.round(CONFIG.XP_PER_MERGE * Math.sqrt(mob.level));
        this.addXP(xpEarned);
        return xpEarned;
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
