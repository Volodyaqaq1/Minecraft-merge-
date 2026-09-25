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

    setLevel(newLevel) {
        if (!newLevel || newLevel < 1) newLevel = 1;
        const levelChanged = (newLevel !== this.level);
        if (levelChanged) {
            this.level = newLevel;
            this.multiplier = getMultiplier(this.level);
            if (this.onLevelChange) this.onLevelChange(this.level);
            if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
        }
    }

    addXP(amount) {
        // Опыт устарел: уровень игрока теперь строго привязан к максимальному открытому мобу
    }

    getXPDetails() {
        return {
            level: this.level,
            curInLevel: 0,
            neededInLevel: 1,
            progress: 1,
        };
    }

    getLevelProgress() {
        return 1;
    }

    // ---- Мёрдж ----

    onMerge(mob) {
        return 0;
    }

    // ---- Бои ----

    onBattleWin(prizeAmount) {
        this.addCoins(prizeAmount);
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
