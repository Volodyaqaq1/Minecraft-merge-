// ============================================================
// scenes/BattleScene.js — арена боя
// ============================================================

class BattleScene extends Phaser.Scene {
    constructor() { super({ key: 'BattleScene' }); }

    init(data) {
        this.playerTeam = data.playerTeam;   // Array<mob>
        this.botTeam    = data.botTeam;      // Array<mob>
        this.botName    = data.botName;
        this.economy    = data.economy;      // Economy instance
    }

    create() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── Фон (подземелье) ───
        this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e);
        // Имитация подземелья
        for (let i = 0; i < 8; i++) {
            this.add.rectangle(60 + i * 120, H / 2, 18, H, 0x2a2a4e, 0.5);
        }

        // ─── Заголовок ───
        this.add.text(W / 2, 18, `⚔  VS  ${this.botName}`, {
            fontSize: '20px', fontFamily: 'monospace',
            color: '#ffd700', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // ─── Сундук с призом ───
        this.prize = BattleSystem.calcPrize(this.playerTeam, this.botTeam);
        const chestX = W / 2;
        const chestY = H / 2 - 20;
        this.add.text(chestX, chestY - 40, '🎁', { fontSize: '48px' }).setOrigin(0.5);
        this._prizeText = this.add.text(chestX, chestY + 20,
            `💎 ${formatNumber(this.prize)}`, {
            fontSize: '16px', fontFamily: 'monospace',
            color: '#5dff6e', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        // ─── HP-полоски ───
        this._buildHPBars();

        // ─── Мобы игрока (слева) ───
        this._playerSprites = this._buildTeamColumn(this.playerTeam, 90, true);

        // ─── Мобы бота (справа) ───
        this._botSprites = this._buildTeamColumn(this.botTeam, W - 90, false);

        // ─── Запуск боя ───
        this._runBattle();
    }

    // ============================================================
    // HP Bars
    // ============================================================

    _buildHPBars() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;
        const barW = 18, barH = 240;
        const barY  = H / 2 - barH / 2;

        // Игрок (зелёная, слева от центра)
        const pBg = this.add.graphics();
        pBg.fillStyle(0x333333, 0.8);
        pBg.fillRoundedRect(W / 2 - 100 - barW / 2, barY, barW, barH, 4);

        this._pBarFill = this.add.graphics();
        this._pBarMaxH = barH;
        this._pBarX    = W / 2 - 100 - barW / 2;
        this._pBarY    = barY;
        this._pBarW    = barW;
        this._drawHPBar(this._pBarFill, this._pBarX, this._pBarY, this._pBarW, barH, 0x27ae60);

        // Бот (красная, справа от центра)
        const bBg = this.add.graphics();
        bBg.fillStyle(0x333333, 0.8);
        bBg.fillRoundedRect(W / 2 + 100 - barW / 2, barY, barW, barH, 4);

        this._bBarFill = this.add.graphics();
        this._bBarX    = W / 2 + 100 - barW / 2;
        this._bBarY    = barY;
        this._bBarW    = barW;
        this._drawHPBar(this._bBarFill, this._bBarX, this._bBarY, this._bBarW, barH, 0xc0392b);

        // Суммарный HP для анимации полоски
        this._playerTotalMaxHP = this.playerTeam.reduce((s, m) => s + m.atk * 10, 0);
        this._botTotalMaxHP    = this.botTeam.reduce((s, m) => s + m.atk * 10, 0);
        this._playerCurHP = this._playerTotalMaxHP;
        this._botCurHP    = this._botTotalMaxHP;
    }

    _drawHPBar(g, x, y, w, fullH, color) {
        g.clear();
        g.fillStyle(color, 1);
        g.fillRoundedRect(x, y, w, fullH, 4);
    }

    _updateHPBar(side, ratio) {
        ratio = Math.max(0, Math.min(1, ratio));
        if (side === 'player') {
            const h = Math.floor(this._pBarMaxH * ratio);
            this._pBarFill.clear();
            if (h > 0) {
                this._pBarFill.fillStyle(0x27ae60, 1);
                this._pBarFill.fillRoundedRect(
                    this._pBarX,
                    this._pBarY + this._pBarMaxH - h,
                    this._pBarW, h, 4);
            }
        } else {
            const h = Math.floor(this._pBarMaxH * ratio);
            this._bBarFill.clear();
            if (h > 0) {
                this._bBarFill.fillStyle(0xc0392b, 1);
                this._bBarFill.fillRoundedRect(
                    this._bBarX,
                    this._pBarY + this._pBarMaxH - h,
                    this._bBarW, h, 4);
            }
        }
    }

    // ============================================================
    // Колонки мобов
    // ============================================================

    _buildTeamColumn(team, cx, isPlayer) {
        const H = CONFIG.HEIGHT;
        const sprites = [];
        team.forEach((mob, i) => {
            const y = H / 2 - 80 + i * 100;
            const emoji = this.add.text(cx, y, mob.emoji, { fontSize: '36px' }).setOrigin(0.5);
            const nameT = this.add.text(cx, y + 28, mob.name, {
                fontSize: '8px', fontFamily: 'monospace', color: '#ccc',
                stroke: '#000', strokeThickness: 1,
            }).setOrigin(0.5, 0);
            sprites.push({ emoji, nameT, alive: true, mob });
        });
        return sprites;
    }

    // ============================================================
    // Логика боя (воспроизведение лога)
    // ============================================================

    _runBattle() {
        const system = new BattleSystem(this.playerTeam, this.botTeam);
        const log    = system.simulate();

        // Суммарный урон по сторонам для HP-баров
        let playerDmgTotal = 0, botDmgTotal = 0;

        let delay = 500;
        log.forEach((event) => {
            this.time.delayedCall(delay, () => {
                this._processEvent(event, playerDmgTotal, botDmgTotal);
            });

            if (event.type === 'attack') {
                if (event.defenderSide === 'player') playerDmgTotal += event.damage;
                else                                  botDmgTotal   += event.damage;
                delay += CONFIG.BATTLE_ROUND_DELAY;
            }
            if (event.type === 'end') {
                delay += 1200;
            }
        });
    }

    _processEvent(event, pdmg, bdmg) {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        if (event.type === 'attack') {
            const isPlayerAttacking = event.attackerSide === 'player';
            const defSprites = isPlayerAttacking ? this._botSprites : this._playerSprites;
            const target = defSprites[event.targetIdx];
            if (!target || !target.alive) return;

            // Всплывающий урон
            const floatX = isPlayerAttacking ? W - 90 : 90;
            const floatY = H / 2 - 80 + event.targetIdx * 100;
            const color = event.crit ? '#ff0000' : '#ffffff';
            const prefix = event.crit ? '💥 КРИТ! ' : '⚔ ';
            spawnFloatingText(this, floatX, floatY, `${prefix}${formatNumber(event.damage)}`, color);

            // Shake
            if (target.emoji) shakeObject(this, target.emoji);

            // Обновить HP-бар
            if (event.defenderSide === 'player') {
                this._playerCurHP -= event.damage;
                this._updateHPBar('player', this._playerCurHP / this._playerTotalMaxHP);
            } else {
                this._botCurHP -= event.damage;
                this._updateHPBar('bot', this._botCurHP / this._botTotalMaxHP);
            }
        }

        if (event.type === 'death') {
            const sprites = event.side === 'player' ? this._playerSprites : this._botSprites;
            const sp = sprites[event.idx];
            if (!sp) return;
            sp.alive = false;
            this.tweens.add({
                targets: [sp.emoji, sp.nameT],
                alpha: 0, scaleX: 0, scaleY: 0,
                duration: 400,
            });
        }

        if (event.type === 'end') {
            this._showResult(event.winner, event.prize);
        }
    }

    // ============================================================
    // Результат боя
    // ============================================================

    _showResult(winner, prize) {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const isWin = winner === 'player';
        const isDraw = winner === 'draw';

        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(300);
        const bg = this.add.graphics().setDepth(301);
        drawRoundRect(bg, W / 2 - 200, H / 2 - 130, 400, 260, 16,
            isWin ? 0x1a4a1a : isDraw ? 0x3a3a1a : 0x4a1a1a, 0.97,
            isWin ? 0xffd700 : isDraw ? 0xffffff : 0xff4444, 2);

        const emoji = isWin ? '🏆' : isDraw ? '🤝' : '💀';
        const title = isWin ? 'ПОБЕДА!' : isDraw ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ';
        const color = isWin ? '#ffd700' : isDraw ? '#ffffff' : '#ff4444';

        this.add.text(W / 2, H / 2 - 100, emoji, { fontSize: '48px' }).setOrigin(0.5).setDepth(302);
        this.add.text(W / 2, H / 2 - 50, title, {
            fontSize: '28px', fontFamily: 'monospace',
            color, stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(302);

        if (isWin) {
            this.economy.onBattleWin(prize);
            this.add.text(W / 2, H / 2, `+💎 ${formatNumber(prize)}`, {
                fontSize: '20px', fontFamily: 'monospace',
                color: '#5dff6e', stroke: '#000', strokeThickness: 2,
            }).setOrigin(0.5).setDepth(302);
        } else {
            this.add.text(W / 2, H / 2, 'Тренируй бойцов!', {
                fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
            }).setOrigin(0.5).setDepth(302);
        }

        // Кнопка возврата
        const [bbg, btxt, bhit] = this._makeButtonAbs(W / 2, H / 2 + 80, 180, 44,
            '🏠 На главную', '#636e72', () => {
                this.scene.start('GameScene');
            });
        bbg.setDepth(302); btxt.setDepth(303); bhit.setDepth(304);
    }

    _makeButtonAbs(cx, cy, w, h, label, color, callback) {
        const hex = parseInt(color.replace('#', ''), 16);
        const bg = this.add.graphics();
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h, 8, hex, 1);
        const txt = this.add.text(cx, cy, label, {
            fontSize: '13px', fontFamily: 'monospace',
            color: '#fff', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);
        const hit = this.add.rectangle(cx, cy, w, h, 0, 0).setInteractive({ cursor: 'pointer' });
        hit.on('pointerdown', callback);
        return [bg, txt, hit];
    }
}
