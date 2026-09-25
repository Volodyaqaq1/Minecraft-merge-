// ============================================================
// components/BattleSystem.js — логика боёв (без UI)
// ============================================================

class BattleSystem {
    /**
     * @param {Array} playerTeam  — массив объектов mob (до 3)
     * @param {Array} botTeam     — массив объектов mob (до 3)
     */
    constructor(playerTeam, botTeam) {
        // Клонируем с HP
        this.player = playerTeam.map(m => ({
            ...m,
            hp: m.atk * 10,
            maxHp: m.atk * 10,
            alive: true,
        }));
        this.bot = botTeam.map(m => ({
            ...m,
            hp: m.atk * 10,
            maxHp: m.atk * 10,
            alive: true,
        }));
        this.round = 0;
        this.done  = false;
        this.winner = null; // 'player' | 'bot' | 'draw'
        this.log = []; // массив событий для воспроизведения в BattleScene
    }

    /**
     * Просимулировать весь бой сразу и вернуть лог событий.
     * BattleScene воспроизводит лог с задержками.
     *
     * Событие: { type: 'attack', attacker: 'player'|'bot', attackerIdx, targetIdx,
     *             damage, crit, defenderHp, defenderMaxHp }
     *           { type: 'death', side: 'player'|'bot', idx }
     *           { type: 'end', winner: 'player'|'bot'|'draw', prize }
     */
    simulate() {
        const MAX_ROUNDS = CONFIG.BATTLE_ROUNDS;

        for (let r = 0; r < MAX_ROUNDS && !this.done; r++) {
            // Каждый живой игрок атакует случайного живого бота и наоборот
            for (let pi = 0; pi < this.player.length; pi++) {
                if (!this.player[pi].alive) continue;
                const biAlive = this.bot.map((b, i) => b.alive ? i : -1).filter(i => i >= 0);
                if (biAlive.length === 0) { this._end(); return this.log; }
                const bi = biAlive[randInt(0, biAlive.length - 1)];
                this._attack('player', pi, bi);
            }
            for (let bi = 0; bi < this.bot.length; bi++) {
                if (!this.bot[bi].alive) continue;
                const piAlive = this.player.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
                if (piAlive.length === 0) { this._end(); return this.log; }
                const pi = piAlive[randInt(0, piAlive.length - 1)];
                this._attack('bot', bi, pi);
            }
        }
        this._end();
        return this.log;
    }

    _attack(attackerSide, attackerIdx, targetIdx) {
        const attacker = attackerSide === 'player' ? this.player[attackerIdx] : this.bot[attackerIdx];
        const defSide  = attackerSide === 'player' ? this.bot : this.player;
        const target   = defSide[targetIdx];

        if (!attacker.alive || !target.alive) return;

        // Крит 15% шанс — x2 урон
        const crit   = Math.random() < 0.15;
        const damage = Math.floor(attacker.atk * (crit ? 2 : 1));

        target.hp -= damage;
        if (target.hp <= 0) {
            target.hp    = 0;
            target.alive = false;
            this.log.push({
                type: 'attack',
                attackerSide, attackerIdx, targetIdx,
                damage, crit,
                defenderSide: attackerSide === 'player' ? 'bot' : 'player',
                defenderHp:  target.hp,
                defenderMaxHp: target.maxHp,
            });
            this.log.push({
                type: 'death',
                side: attackerSide === 'player' ? 'bot' : 'player',
                idx: targetIdx,
            });
        } else {
            this.log.push({
                type: 'attack',
                attackerSide, attackerIdx, targetIdx,
                damage, crit,
                defenderSide: attackerSide === 'player' ? 'bot' : 'player',
                defenderHp:  target.hp,
                defenderMaxHp: target.maxHp,
            });
        }
    }

    _end() {
        this.done = true;
        const pAlive = this.player.some(p => p.alive);
        const bAlive = this.bot.some(b => b.alive);
        this.winner  = pAlive && !bAlive ? 'player'
                     : bAlive && !pAlive ? 'bot'
                     : 'draw';

        // Приз: сбалансированная награда за победу
        const maxLvl = Math.max(...this.player.map(m => m.level || 1), 1);
        const totalAtk = [...this.player, ...this.bot].reduce((s, m) => s + m.atk, 0);
        const prize = (typeof getBattleWinReward === 'function')
            ? getBattleWinReward(maxLvl)
            : Math.floor(totalAtk * CONFIG.BATTLE_PRIZE_MULTIPLIER);

        this.log.push({ type: 'end', winner: this.winner, prize });
    }

    /**
     * Статичный метод: вычислить приз не запуская симуляцию
     */
    static calcPrize(playerTeam, botTeam) {
        const maxLvl = Math.max(...(playerTeam || []).map(m => m.level || 1), 1);
        if (typeof getBattleWinReward === 'function') {
            return getBattleWinReward(maxLvl);
        }
        const totalAtk = [...playerTeam, ...botTeam].reduce((s, m) => s + m.atk, 0);
        return Math.floor(totalAtk * CONFIG.BATTLE_PRIZE_MULTIPLIER);
    }
}
