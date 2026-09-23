// ============================================================
// scenes/BattleScene.js — арена боя: гонка по разрушению стенки
// ============================================================

class BattleScene extends Phaser.Scene {
    constructor() { super({ key: 'BattleScene' }); }

    init(data) {
        this.playerTeam = data.playerTeam || [];   // Array<mob>
        this.botTeam    = data.botTeam || [];      // Array<mob>
        this.botName    = data.botName || 'Бот';
        this.state      = data.state || SaveManager.load();
    }

    create() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── 1. Фон лесной тропы / арены (как на скриншотах 4 и 5) ───
        this._buildArenaBackground();

        // ─── 2. Заголовок ───
        this.add.text(W / 2, 20, `⚔  ГОНКА ПРОРЫВА  VS  ${this.botName}`, {
            fontSize: '18px', fontFamily: 'monospace',
            color: '#ffd700', stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5, 0);

        // ─── 3. Сундук с сокровищами в центре ───
        this._buildCenterTreasure();

        // ─── 4. Стенки (деревянные столбы-преграды) и их полоски HP ───
        this._buildWallsAndHP();

        // ─── 5. Колонки мобов игрока (слева) и бота (справа) ───
        this._playerSprites = this._buildTeamColumn(this.playerTeam, 90, true);
        this._botSprites    = this._buildTeamColumn(this.botTeam, W - 90, false);

        // ─── 6. Запуск процесса боя (гонка разрушения стен) ───
        this.battleEnded = false;
        this._startWallBreakRace();
    }

    // ============================================================
    // Фон лесной арены
    // ============================================================

    _buildArenaBackground() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Небо
        const sky = this.add.graphics();
        sky.fillGradientStyle(0x56a635, 0x56a635, 0x2d5a27, 0x2d5a27, 1);
        sky.fillRect(0, 0, W, H);

        // Деревья по бокам
        for (let i = 0; i < 6; i++) {
            const tx = 60 + i * 165;
            const tree = this.add.graphics();
            tree.fillStyle(0x1e3f18, 0.7);
            tree.fillRect(tx - 25, 0, 50, H);
        }

        // Тропинка по центру
        const path = this.add.graphics();
        path.fillStyle(0xa47c48, 0.85);
        path.fillRect(0, H - 120, W, 120);
    }

    // ============================================================
    // Сокровище в центре
    // ============================================================

    _buildCenterTreasure() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Приз = сумма АТК всех мобов * множитель
        const totalAtk = [...this.playerTeam, ...this.botTeam].reduce((s, m) => s + m.atk, 0);
        this.prize = Math.floor(totalAtk * CONFIG.BATTLE_PRIZE_MULTIPLIER);

        const cx = W / 2;
        const cy = H / 2 - 10;

        // Лучи сияния за сундуком
        this.rays = this.add.graphics();
        this.rays.fillStyle(0xffd700, 0.15);
        this.rays.fillCircle(cx, cy, 110);

        // Иконка сундука
        this.chestIcon = this.add.text(cx, cy - 20, '🎁', { fontSize: '64px' }).setOrigin(0.5);

        // Подпись награды
        this.add.text(cx, cy + 40, `💎 ${formatNumber(this.prize)}`, {
            fontSize: '18px', fontFamily: 'monospace',
            color: '#5dff6e', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5);
    }

    // ============================================================
    // Деревянные стенки и HP-бары
    // ============================================================

    _buildWallsAndHP() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const wallW = 60;
        const wallH = 260;
        const wallY = H / 2 - 20;

        // ── 1. Стенка Игрока (слева) ──
        this.pWallX = 260;
        this.pWallY = wallY;
        this.pWallGraphics = this.add.graphics();
        this._drawWoodenWall(this.pWallGraphics, this.pWallX - wallW / 2, this.pWallY - wallH / 2, wallW, wallH);

        const pTotalAtk = this.playerTeam.reduce((s, m) => s + m.atk, 0);
        const bTotalAtk = this.botTeam.reduce((s, m) => s + m.atk, 0);

        // ОБЕ СТЕНКИ ИМЕЮТ ОДИНАКОВОЕ ЗДОРОВЬЕ:
        // Рассчитывается от среднего урона матча.
        // - Если мобы одинаковые: честный шанс 50 на 50 (решают криты)!
        // - Если мобы игрока сильнее: игрок сносит стенку быстрее и побеждает!
        // - Если мобы бота сильнее: бот побеждает!
        const avgAtk = Math.max(10, (pTotalAtk + bTotalAtk) / 2);
        const matchWallHP = Math.max(80, Math.round(avgAtk * CONFIG.BATTLE_WALL_HP_FACTOR));

        this.pWallMaxHP = matchWallHP;
        this.pWallHP    = matchWallHP;

        // HP бар стенки игрока (зеленый снизу)
        const pBarBg = this.add.graphics();
        drawRoundRect(pBarBg, this.pWallX - 60, H - 90, 120, 24, 6, 0x1f2421, 0.9, 0xffffff, 2);

        this.pBarFill = this.add.graphics();
        this.pBarText = this.add.text(this.pWallX, H - 78, '100%', {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this._updateWallHPBar('player');

        // ── 2. Стенка Бота (справа) ──
        this.bWallX = W - 260;
        this.bWallY = wallY;
        this.bWallGraphics = this.add.graphics();
        this._drawWoodenWall(this.bWallGraphics, this.bWallX - wallW / 2, this.bWallY - wallH / 2, wallW, wallH);

        this.bWallMaxHP = matchWallHP;
        this.bWallHP    = matchWallHP;

        // HP бар стенки бота (красный снизу)
        const bBarBg = this.add.graphics();
        drawRoundRect(bBarBg, this.bWallX - 60, H - 90, 120, 24, 6, 0x1f2421, 0.9, 0xffffff, 2);

        this.bBarFill = this.add.graphics();
        this.bBarText = this.add.text(this.bWallX, H - 78, '100%', {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this._updateWallHPBar('bot');
    }

    _drawWoodenWall(g, x, y, w, h) {
        g.clear();
        // Деревянная текстура (доски как в Minecraft)
        g.fillStyle(0xb27848, 1);
        g.fillRoundedRect(x, y, w, h, 8);

        // Линии досок
        g.lineStyle(3, 0x6e4624, 1);
        g.strokeRoundedRect(x, y, w, h, 8);

        const plankH = 40;
        for (let py = y + plankH; py < y + h; py += plankH) {
            g.lineBetween(x, py, x + w, py);
        }
    }

    _updateWallHPBar(side) {
        if (side === 'player') {
            const ratio = Math.max(0, this.pWallHP / this.pWallMaxHP);
            this.pBarFill.clear();
            if (ratio > 0) {
                this.pBarFill.fillStyle(0x2ed573, 1);
                this.pBarFill.fillRoundedRect(this.pWallX - 58, CONFIG.HEIGHT - 88, Math.floor(116 * ratio), 20, 4);
            }
            this.pBarText.setText(`${Math.ceil(ratio * 100)}%`);
        } else {
            const ratio = Math.max(0, this.bWallHP / this.bWallMaxHP);
            this.bBarFill.clear();
            if (ratio > 0) {
                this.bBarFill.fillStyle(0xff4757, 1);
                this.bBarFill.fillRoundedRect(this.bWallX - 58, CONFIG.HEIGHT - 88, Math.floor(116 * ratio), 20, 4);
            }
            this.bBarText.setText(`${Math.ceil(ratio * 100)}%`);
        }
    }

    // ============================================================
    // Колонки мобов
    // ============================================================

    _buildTeamColumn(team, cx, isPlayer) {
        const H = CONFIG.HEIGHT;
        const sprites = [];

        team.forEach((mob, i) => {
            const y = H / 2 - 90 + i * 95;

            // Фон-кружок карточки бойца
            const bg = this.add.graphics();
            drawRoundRect(bg, cx - 40, y - 40, 80, 80, 40, mob.rarityColor, 0.45, 0xffffff, 2);

            const emoji = this.add.text(cx, y - 6, mob.emoji, { fontSize: '42px' }).setOrigin(0.5);

            const nameT = this.add.text(cx, y + 26, mob.name, {
                fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
                stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
            }).setOrigin(0.5, 0);

            const atkT = this.add.text(cx, y + 38, `⚔${formatNumber(mob.atk)}`, {
                fontSize: '11px', fontFamily: 'monospace', color: isPlayer ? '#5dff6e' : '#ff7979',
                fontStyle: 'bold',
            }).setOrigin(0.5, 0);

            sprites.push({ bg, emoji, nameT, atkT, mob, x: cx, y });
        });

        return sprites;
    }

    // ============================================================
    // Механика гонки по разрушению стен
    // ============================================================

    _startWallBreakRace() {
        // Каждый моб игрока периодически атакует СВОЮ стенку
        this.playerTeam.forEach((mob, i) => {
            const stagger = i * 220;
            this.time.addEvent({
                delay: CONFIG.BATTLE_ATTACK_SPEED,
                startAt: stagger,
                loop: true,
                callback: () => {
                    if (!this.battleEnded) this._performAttack('player', i);
                },
            });
        });

        // Каждый моб бота периодически атакует СВОЮ стенку
        this.botTeam.forEach((mob, i) => {
            const stagger = i * 220;
            this.time.addEvent({
                delay: CONFIG.BATTLE_ATTACK_SPEED,
                startAt: stagger,
                loop: true,
                callback: () => {
                    if (!this.battleEnded) this._performAttack('bot', i);
                },
            });
        });
    }

    _performAttack(side, mobIdx) {
        if (this.battleEnded) return;

        const isPlayer = side === 'player';
        const team     = isPlayer ? this._playerSprites : this._botSprites;
        const attacker = team[mobIdx];
        if (!attacker) return;

        const startX = attacker.x;
        const startY = attacker.y;

        const targetX = isPlayer ? this.pWallX : this.bWallX;
        const targetY = isPlayer ? (this.pWallY - 70 + mobIdx * 70) : (this.bWallY - 70 + mobIdx * 70);

        // 1. Снаряд (звездочка / луч атаки) летит от моба к стенке
        const proj = this.add.text(startX, startY, isPlayer ? '⭐' : '🔥', {
            fontSize: '22px',
        }).setOrigin(0.5).setDepth(80);

        this.tweens.add({
            targets: proj,
            x: targetX,
            y: targetY,
            duration: 220,
            ease: 'Quad.In',
            onComplete: () => {
                proj.destroy();
                this._onWallHit(side, attacker.mob, targetX, targetY);
            }
        });

        // Небольшой отскок самого моба при ударе
        this.tweens.add({
            targets: attacker.emoji,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 90,
            yoyo: true,
        });
    }

    _onWallHit(side, mob, hitX, hitY) {
        if (this.battleEnded) return;

        const isPlayer = side === 'player';

        // Крит с шансом 18%
        const isCrit = Math.random() < 0.18;
        const damage = Math.round(mob.atk * (isCrit ? 1.75 : 1.0));

        // Тряска стенки
        const wallG = isPlayer ? this.pWallGraphics : this.bWallGraphics;
        shakeObject(this, wallG);

        // Всплывающий урон на стенке
        const hitWords = isPlayer ? ['БАМ!', 'КРИТ!', 'УДАР!', 'POW!'] : ['ТУК!', 'ХРЯСЬ!', 'THUMP!'];
        const word = hitWords[Math.floor(Math.random() * hitWords.length)];
        const textColor = isCrit ? '#ff3838' : (isPlayer ? '#ffd700' : '#ff9f43');

        spawnFloatingText(this, hitX + (isPlayer ? 10 : -10), hitY, `${word} ${formatNumber(damage)}`, textColor);

        // Уменьшение HP
        if (isPlayer) {
            this.pWallHP -= damage;
            this._updateWallHPBar('player');

            if (this.pWallHP <= 0) {
                this.pWallHP = 0;
                this._endBattle('player');
            }
        } else {
            this.bWallHP -= damage;
            this._updateWallHPBar('bot');

            if (this.bWallHP <= 0) {
                this.bWallHP = 0;
                this._endBattle('bot');
            }
        }
    }

    _endBattle(winner) {
        if (this.battleEnded) return;
        this.battleEnded = true;

        const isWin = winner === 'player';

        // Анимация разрушения стенки победителя
        const brokenWall = isWin ? this.pWallGraphics : this.bWallGraphics;
        this.tweens.add({
            targets: brokenWall,
            alpha: 0,
            scaleY: 0,
            duration: 350,
        });

        // Анимация сундука при открытии
        this.tweens.add({
            targets: this.chestIcon,
            scaleX: 1.4,
            scaleY: 1.4,
            duration: 250,
            yoyo: true,
        });

        this.time.delayedCall(700, () => {
            this._showResultModal(isWin);
        });
    }

    _showResultModal(isWin) {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(200);
        const bg = this.add.graphics().setDepth(201);
        drawRoundRect(bg, W / 2 - 200, H / 2 - 130, 400, 260, 16,
            isWin ? 0x1b4332 : 0x49111c, 0.98,
            isWin ? 0xffd700 : 0xff4757, 3);

        const emoji = isWin ? '🏆' : '💀';
        // По требованию: пишем «ник бота вас опередил» при поражении
        const title = isWin ? 'СОКРОВИЩЕ ВАШЕ!' : `${this.botName} вас опередил!`;
        const color = isWin ? '#ffd700' : '#ff6b81';

        this.add.text(W / 2, H / 2 - 95, emoji, { fontSize: '48px' }).setOrigin(0.5).setDepth(202);
        this.add.text(W / 2, H / 2 - 45, title, {
            fontSize: '18px', fontFamily: 'monospace',
            color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(202);

        if (isWin) {
            this.state.player.coins = (this.state.player.coins || 0) + this.prize;
            this.state.player.xp = (this.state.player.xp || 0) + CONFIG.XP_PER_MERGE * 4;
            this.add.text(W / 2, H / 2 + 5, `+💎 ${formatNumber(this.prize)} изумрудов!`, {
                fontSize: '18px', fontFamily: 'monospace',
                color: '#5dff6e', stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(202);
        } else {
            // По требованию: 0.5 (50%) от возможной награды при поражении!
            const halfPrize = Math.floor(this.prize * 0.5);
            this.state.player.coins = (this.state.player.coins || 0) + halfPrize;

            this.add.text(W / 2, H / 2 - 2, `+💎 ${formatNumber(halfPrize)} изумрудов`, {
                fontSize: '17px', fontFamily: 'monospace',
                color: '#5dff6e', stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(202);

            this.add.text(W / 2, H / 2 + 25, '(Утешительная награда 50%)', {
                fontSize: '12px', fontFamily: 'monospace', color: '#ffd700',
            }).setOrigin(0.5).setDepth(202);
        }

        // Сохраняем состояние сразу же!
        SaveManager.save(this.state);

        // Кнопка возврата в деревню
        const [bbg, btxt, bhit] = this._makeButton(W / 2, H / 2 + 75, 200, 48,
            '🏠 На главную', isWin ? '#2ed573' : '#747d8c', () => {
                this.scene.start('GameScene');
            });
        bbg.setDepth(202); btxt.setDepth(203); bhit.setDepth(204);
    }

    _makeButton(cx, cy, w, h, label, color, callback) {
        const hex = parseInt(color.replace('#', ''), 16);
        const bg = this.add.graphics();
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h, 8, hex, 1);
        const txt = this.add.text(cx, cy, label, {
            fontSize: '15px', fontFamily: 'monospace',
            color: '#fff', stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);
        const hit = this.add.rectangle(cx, cy, w, h, 0, 0).setInteractive({ cursor: 'pointer' });
        hit.on('pointerdown', callback);
        return [bg, txt, hit];
    }
}
