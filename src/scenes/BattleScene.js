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
        setupSceneHiDPICamera(this);
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── 1. Фон лесной тропы / арены (как на скриншотах 4 и 5) ───
        this._buildArenaBackground();

        // ─── 2. Заголовок ───
        createHDText(this, W / 2, 20, `⚔  ГОНКА ПРОРЫВА  VS  ${this.botName}`, {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#111625', strokeThickness: 3, fontStyle: '900',
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

        // 1. Нежно-голубое градиентное небо
        const sky = this.add.graphics();
        sky.fillGradientStyle(0x5cbcf6, 0x5cbcf6, 0xc8eeff, 0xc8eeff, 1);
        sky.fillRect(0, 0, W, H * 0.44);

        // 2. Пушистые облака на горизонте
        for (let i = 0; i < 4; i++) {
            const cx = 120 + i * 235;
            const cy = 35 + (i % 2) * 18;
            const cg = this.add.graphics();
            cg.fillStyle(0xffffff, 0.85);
            cg.fillCircle(cx, cy, 20);
            cg.fillCircle(cx - 14, cy + 4, 14);
            cg.fillCircle(cx + 14, cy + 4, 14);
            cg.fillRoundedRect(cx - 26, cy + 4, 52, 12, 6);
        }

        // 3. Мягкие зеленые холмы
        const hills = this.add.graphics();
        hills.fillStyle(0x7ecb3e, 1);
        hills.beginPath();
        hills.arc(220, H * 0.43 + 60, 240, Math.PI, 0, false);
        hills.arc(720, H * 0.43 + 60, 260, Math.PI, 0, false);
        hills.fillPath();

        // 4. Тёплый фисташковый луг без резких полос
        const ground = this.add.graphics();
        ground.fillGradientStyle(0x9ee54f, 0x9ee54f, 0x6bbd29, 0x6bbd29, 1);
        ground.fillRect(0, H * 0.36, W, H * 0.64);

        // 5. Песчаная мягкая дорожка между мобами и сундуком
        const path = this.add.graphics();
        drawRoundRect(path, 40, H / 2 - 40, W - 80, 80, 20, 0xf6d59b, 0.55);

        // 6. Мягкое солнечное пятно в центре
        const centerSun = this.add.graphics();
        centerSun.fillStyle(0xffffff, 0.12);
        centerSun.fillEllipse(W / 2, H / 2, 420, 180);
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

        // ЕДИНЫЙ КОНТЕЙНЕР: сундук, лучи и надпись награды привязаны вместе
        this.treasureContainer = this.add.container(cx, cy).setDepth(20);

        // Лучи сияния за сундуком (позиционированы внутри контейнера)
        this.rays = this.add.graphics();
        this.rays.fillStyle(0xffd700, 0.16);
        this.rays.fillCircle(0, -10, 95);
        this.rays.fillStyle(0xffffff, 0.10);
        this.rays.fillCircle(0, -10, 120);

        // Иконка сундука
        this.chestIcon = this.add.image(0, -16, 'icon_chest').setDisplaySize(68, 68);

        // Подпись награды
        this.prizeText = createHDText(this, 0, 36, `💎 ${formatNumber(this.prize)}`, {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#5dff6e', stroke: '#111625', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0.5);

        this.treasureContainer.add([this.rays, this.chestIcon, this.prizeText]);

        // Плавное парение сокровища в центре арены
        this.tweens.add({
            targets: this.treasureContainer,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
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
        this.pWallX = 270;
        this.pWallY = wallY;
        this.pWallGraphics = this.add.graphics();
        this.pWallGraphics.setPosition(this.pWallX, this.pWallY);
        this.pWallGraphics._shakeBaseX = this.pWallX;
        this._drawWoodenWall(this.pWallGraphics, -wallW / 2, -wallH / 2, wallW, wallH, 0);

        const pTotalAtk = this.playerTeam.reduce((s, m) => s + m.atk, 0);
        const bTotalAtk = this.botTeam.reduce((s, m) => s + m.atk, 0);
        const avgAtk = Math.max(10, (pTotalAtk + bTotalAtk) / 2);
        const matchWallHP = Math.max(80, Math.round(avgAtk * CONFIG.BATTLE_WALL_HP_FACTOR));

        this.pWallMaxHP = matchWallHP;
        this.pWallHP    = matchWallHP;

        // HP бар стенки игрока
        this.pBarFill = this.add.graphics();
        this.pBarFlash = this.add.graphics().setAlpha(0);
        this.pBarText = createHDText(this, this.pWallX, H - 79, '100%', {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#0f172a', strokeThickness: 2.5, fontStyle: '900'
        }).setOrigin(0.5);

        // ── 2. Стенка Бота (справа) ──
        this.bWallX = W - 270;
        this.bWallY = wallY;
        this.bWallGraphics = this.add.graphics();
        this.bWallGraphics.setPosition(this.bWallX, this.bWallY);
        this.bWallGraphics._shakeBaseX = this.bWallX;
        this._drawWoodenWall(this.bWallGraphics, -wallW / 2, -wallH / 2, wallW, wallH, 0);

        this.bWallMaxHP = matchWallHP;
        this.bWallHP    = matchWallHP;

        // HP бар стенки бота
        this.bBarFill = this.add.graphics();
        this.bBarFlash = this.add.graphics().setAlpha(0);
        this.bBarText = createHDText(this, this.bWallX, H - 79, '100%', {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#0f172a', strokeThickness: 2.5, fontStyle: '900'
        }).setOrigin(0.5);

        this._updateWallHPBar('player', false);
        this._updateWallHPBar('bot', false);
    }

    _drawWoodenWall(g, x, y, w, h, damageRatio = 0) {
        g.clear();
        // Деревянная основа (бревна / брус)
        g.fillStyle(0xb27848, 1);
        g.fillRoundedRect(x, y, w, h, 8);

        // Линии досок и окантовка
        g.lineStyle(3, 0x6e4624, 1);
        g.strokeRoundedRect(x, y, w, h, 8);

        const plankH = 40;
        for (let py = y + plankH; py < y + h; py += plankH) {
            g.lineBetween(x, py, x + w, py);
        }

        // Трещины при повреждениях:
        // Если HP < 70% (damageRatio >= 0.3)
        if (damageRatio >= 0.3) {
            g.lineStyle(2, 0x3d2314, 0.95);
            g.lineBetween(x + 12, y + 45, x + 28, y + 80);
            g.lineBetween(x + 28, y + 80, x + 20, y + 115);
            g.lineBetween(x + 44, y + 165, x + 32, y + 195);
        }
        // Если HP < 35% (damageRatio >= 0.65)
        if (damageRatio >= 0.65) {
            g.lineStyle(2.5, 0x1f0e05, 1);
            g.lineBetween(x + 10, y + 75, x + 35, y + 100);
            g.lineBetween(x + 35, y + 100, x + 50, y + 125);
            g.lineBetween(x + 18, y + 145, x + 40, y + 180);
            g.lineBetween(x + 40, y + 180, x + 24, y + 220);
            g.lineBetween(x + 8, y + 205, x + 32, y + 235);
        }
    }

    _updateWallHPBar(side, flashDamage = false) {
        const H = CONFIG.HEIGHT;
        const barW = 120;
        const barH = 22;

        if (side === 'player') {
            const ratio = Math.max(0, this.pWallHP / this.pWallMaxHP);
            const damageRatio = 1 - ratio;
            this._drawWoodenWall(this.pWallGraphics, -30, -130, 60, 260, damageRatio);

            this.pBarFill.clear();
            drawCasualProgressBar(this.pBarFill, this.pWallX - barW / 2, H - 90, barW, barH, 7, ratio, 0x0f172a, 0x22c55e, 0x334155);
            this.pBarText.setText(`${Math.ceil(ratio * 100)}%`);

            if (flashDamage) {
                this.pBarFlash.clear();
                this.pBarFlash.fillStyle(0xffffff, 0.75);
                this.pBarFlash.fillRoundedRect(this.pWallX - barW / 2, H - 90, barW, barH, 7);
                this.pBarFlash.setAlpha(1);
                this.tweens.add({ targets: this.pBarFlash, alpha: 0, duration: 160 });
            }
        } else {
            const ratio = Math.max(0, this.bWallHP / this.bWallMaxHP);
            const damageRatio = 1 - ratio;
            this._drawWoodenWall(this.bWallGraphics, -30, -130, 60, 260, damageRatio);

            this.bBarFill.clear();
            drawCasualProgressBar(this.bBarFill, this.bWallX - barW / 2, H - 90, barW, barH, 7, ratio, 0x0f172a, 0xef4444, 0x334155);
            this.bBarText.setText(`${Math.ceil(ratio * 100)}%`);

            if (flashDamage) {
                this.bBarFlash.clear();
                this.bBarFlash.fillStyle(0xffffff, 0.75);
                this.bBarFlash.fillRoundedRect(this.bWallX - barW / 2, H - 90, barW, barH, 7);
                this.bBarFlash.setAlpha(1);
                this.tweens.add({ targets: this.bBarFlash, alpha: 0, duration: 160 });
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
            const y = H / 2 - 90 + i * 95;
            const rColor = mob.rarityColor || 0x64748b;

            // Фон-кружок карточки бойца с мягкой тенью и цветной рамкой редкости
            const bg = this.add.graphics();
            drawRoundRect(bg, cx - 41, y - 41 + 2, 82, 82, 41, 0x020617, 0.4);
            drawRoundRect(bg, cx - 40, y - 40, 80, 80, 40, 0x162032, 0.85, rColor, 2.2);

            // Внутреннее блюдце
            bg.fillStyle(0x0f172a, 0.6);
            bg.fillCircle(cx, y - 6, 26);

            const mobTex = (mob.portraitKey && this.textures.exists(mob.portraitKey))
                ? mob.portraitKey
                : (mob.texture || (mob.level <= 10 ? `mob_0${mob.level}` : 'mob_placeholder'));
            const avatar = this.add.image(cx, y - 6, mobTex).setDisplaySize(50, 50);

            const nameT = createHDText(this, cx, y + 25, mob.name, {
                fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ffffff',
                stroke: '#0f172a', strokeThickness: 2.5, fontStyle: '800',
            }).setOrigin(0.5, 0);

            // Аккуратная плашка урона
            const atkPill = this.add.graphics();
            drawRoundRect(atkPill, cx - 34, y + 38, 68, 17, 8, isPlayer ? 0x14532d : 0x7f1d1d, 0.9, isPlayer ? 0x22c55e : 0xef4444, 1);

            const atkT = createHDText(this, cx, y + 46, `⚔ ${formatNumber(mob.atk)}`, {
                fontSize: '10.5px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: isPlayer ? '#4ade80' : '#fca5a5', stroke: '#0f172a', strokeThickness: 2, fontStyle: '900',
            }).setOrigin(0.5, 0.5);

            sprites.push({ bg, atkPill, avatar, emoji: avatar, nameT, atkT, mob, x: cx, y });
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
        const baseScale = attacker.avatar.scaleX;
        this.tweens.add({
            targets: attacker.avatar,
            scaleX: baseScale * 1.25,
            scaleY: baseScale * 1.25,
            duration: 90,
            yoyo: true,
        });
    }

    _onWallHit(side, mob, hitX, hitY) {
        if (this.battleEnded) return;

        const isPlayer = side === 'player';

        if (typeof SoundManager !== 'undefined') {
            SoundManager.playClink();
        }

        // Крит с шансом 18%
        const isCrit = Math.random() < 0.18;
        const damage = Math.round(mob.atk * (isCrit ? 1.75 : 1.0));

        // Тряска стенки
        const wallG = isPlayer ? this.pWallGraphics : this.bWallGraphics;
        shakeObject(this, wallG);

        // Всплывающий урон на стенке (аккуратный цветной бейдж с округлыми краями)
        this._spawnDamageBadge(hitX + (isPlayer ? 10 : -10), hitY, damage, isCrit, isPlayer);

        // Уменьшение HP
        if (isPlayer) {
            this.pWallHP -= damage;
            this._updateWallHPBar('player', true);

            if (this.pWallHP <= 0) {
                this.pWallHP = 0;
                this._endBattle('player');
            }
        } else {
            this.bWallHP -= damage;
            this._updateWallHPBar('bot', true);

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
        const targetX = isWin ? 150 : CONFIG.WIDTH - 150;

        // Анимация разрушения стенки победителя
        const brokenWall = isWin ? this.pWallGraphics : this.bWallGraphics;
        this.tweens.add({
            targets: brokenWall,
            alpha: 0,
            scaleY: 0,
            duration: 350,
        });

        // Награда целиком (сундук + лучи + надпись) перетягивается к победителю!
        this.tweens.killTweensOf(this.treasureContainer);
        this.tweens.add({
            targets: this.treasureContainer,
            x: targetX,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 800,
            ease: 'Back.Out',
        });

        this.time.delayedCall(900, () => {
            this._showResultModal(isWin);
        });
    }

    _showResultModal(isWin) {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        if (isWin) {
            if (typeof SoundManager !== 'undefined') SoundManager.playVictory();
        } else {
            if (typeof SoundManager !== 'undefined') SoundManager.playDefeat();
        }

        const basePrize = isWin ? this.prize : Math.max(1, Math.floor(this.prize * 0.5));

        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(200).setInteractive();
        const modal = this.add.container(W / 2, H / 2).setDepth(201);

        const cardW = 460;
        const cardH = 330;

        // Мягкая внешняя тень модального окна
        const shadowG = this.add.graphics();
        shadowG.fillStyle(0x000000, 0.35);
        shadowG.fillRoundedRect(-cardW / 2 + 2, -cardH / 2 + 6, cardW, cardH, 22);

        // Белая глянцевая основа карточки
        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.99);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22);
        bg.lineStyle(3, isWin ? 0xf59e0b : 0x94a3b8, 1);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 22);

        // Верхний декоративный бейдж с заголовком
        const headerW = 230;
        const headerH = 46;
        const headerBg = this.add.graphics();
        headerBg.fillStyle(isWin ? 0x22c55e : 0xef4444, 1);
        headerBg.fillRoundedRect(-headerW / 2, -cardH / 2 - headerH / 2 + 4, headerW, headerH, 14);
        headerBg.fillStyle(0xffffff, 0.28);
        headerBg.fillRoundedRect(-headerW / 2 + 3, -cardH / 2 - headerH / 2 + 6, headerW - 6, 17, { tl: 11, tr: 11, bl: 3, br: 3 });
        headerBg.lineStyle(2, isWin ? 0x86efac : 0xfca5a5, 1);
        headerBg.strokeRoundedRect(-headerW / 2, -cardH / 2 - headerH / 2 + 4, headerW, headerH, 14);

        const titleText = isWin ? 'ПОБЕДА! 🏆' : 'ПОРАЖЕНИЕ 💔';
        const title = createHDText(this, 0, -cardH / 2 + 6, titleText, {
            fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900'
        }).setOrigin(0.5);

        const subText = isWin
            ? 'Отличный бой! Сокровище принадлежит вашей команде!'
            : 'Берите более сильных мобов в команду, чтобы победить';
        const sub = createHDText(this, 0, -cardH / 2 + 56, subText, {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#64748b', fontStyle: '800', align: 'center', wordWrap: { width: cardW - 40 }
        }).setOrigin(0.5);

        // Плашка базовой награды
        const prizePill = this.add.graphics();
        const pillW = 180;
        const pillH = 34;
        const pillY = -cardH / 2 + 94;
        prizePill.fillStyle(0xfef3c7, 1);
        prizePill.fillRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);
        prizePill.lineStyle(1.5, 0xf59e0b, 1);
        prizePill.strokeRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, pillH / 2);

        const prizeTxt = createHDText(this, 0, pillY, `💎 +${formatNumber(basePrize)}`, {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#92400e', fontStyle: '900'
        }).setOrigin(0.5);

        const adTitle = createHDText(this, 0, -cardH / 2 + 138, 'Умножить награду за рекламу:', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#334155', fontStyle: '900'
        }).setOrigin(0.5);

        // Полоса слайдера от x2 до x5 в темном казуальном желобе
        const trackW = 280;
        const trackH = 14;
        const trackY = -cardH / 2 + 178;
        const trackBg = this.add.graphics();
        drawRoundRect(trackBg, -trackW / 2, trackY - trackH / 2, trackW, trackH, 7, 0x0f172a, 0.95, 0x334155, 1.5);

        // Метки множителей над шкалой
        const labelY = trackY - 18;
        const lX2Left  = createHDText(this, -trackW / 2 + 12, labelY, 'x2', { fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#94a3b8', fontStyle: '800', stroke: '#0f172a', strokeThickness: 2 }).setOrigin(0.5);
        const lX3Left  = createHDText(this, -trackW / 4, labelY, 'x3', { fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#f59e0b', fontStyle: '900', stroke: '#0f172a', strokeThickness: 2.5 }).setOrigin(0.5);
        const lX5Mid   = createHDText(this, 0, labelY, 'x5 🔥', { fontSize: '16px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ef4444', fontStyle: '900', stroke: '#0f172a', strokeThickness: 3 }).setOrigin(0.5);
        const lX3Right = createHDText(this, trackW / 4, labelY, 'x3', { fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#f59e0b', fontStyle: '900', stroke: '#0f172a', strokeThickness: 2.5 }).setOrigin(0.5);
        const lX2Right = createHDText(this, trackW / 2 - 12, labelY, 'x2', { fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#94a3b8', fontStyle: '800', stroke: '#0f172a', strokeThickness: 2 }).setOrigin(0.5);

        // Бегающий ползунок (круглая фиолетовая бусина с иконкой)
        const knobContainer = this.add.container(0, trackY);
        const knobG = this.add.graphics();
        knobG.fillStyle(0x581c87, 1);
        knobG.fillRoundedRect(-16, -16 + 3, 32, 32, 8);
        knobG.fillStyle(0x9333ea, 1);
        knobG.fillRoundedRect(-16, -16, 32, 32, 8);
        knobG.lineStyle(1.8, 0xffffff, 1);
        knobG.strokeRoundedRect(-16, -16, 32, 32, 8);
        const knobTxt = createHDText(this, 0, 0, '🎬', { fontSize: '16px' }).setOrigin(0.5);
        knobContainer.add([knobG, knobTxt]);

        let sliderActive = true;
        let currentMult = 3;

        // Большая сочная 3D кнопка множителя
        const claimBtn = createCasualButton(this, 0, cardH / 2 - 58, 280, 48, `🎬 ЗАБРАТЬ x3 (💎 ${formatNumber(basePrize * 3)})`, {
            topColor: 0x22c55e,
            bottomColor: 0x15803d,
            strokeColor: 0x86efac,
            fontSize: '15px',
            radius: 12,
            lip: 4,
            pulse: true,
            pulseScale: 1.03,
            pulseDuration: 750,
        }, () => {
            if (!sliderActive) return;
            sliderActive = false;

            const finalCoins = basePrize * currentMult;
            this.state.player.coins = (this.state.player.coins || 0) + finalCoins;
            if (isWin) {
                this.state.player.xp = (this.state.player.xp || 0) + CONFIG.XP_PER_MERGE * 4;
            }
            SaveManager.save(this.state);

            if (typeof SoundManager !== 'undefined') SoundManager.playVictory();
            spawnFloatingText(this, W / 2, H / 2, `🎁 x${currentMult} НАГРАДА ПОЛУЧЕНА!`, '#ffd700', 24);

            this.time.delayedCall(450, () => {
                this.scene.start('GameScene');
            });
        });

        // Вторичная кнопка "Забрать без рекламы (1x)"
        const skipContainer = this.add.container(0, cardH / 2 - 18);
        const skipBg = this.add.graphics();
        drawRoundRect(skipBg, -100, -12, 200, 24, 12, 0xf1f5f9, 0.95, 0xcbd5e1, 1);
        const skipTxt = createHDText(this, 0, 0, 'Забрать без рекламы (1x)', {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#64748b', fontStyle: '800'
        }).setOrigin(0.5);
        const skipHit = this.add.rectangle(0, 0, 200, 24, 0, 0).setInteractive({ cursor: 'pointer' });
        skipContainer.add([skipBg, skipTxt, skipHit]);

        skipHit.on('pointerdown', () => {
            if (!sliderActive) return;
            sliderActive = false;

            this.state.player.coins = (this.state.player.coins || 0) + basePrize;
            if (isWin) {
                this.state.player.xp = (this.state.player.xp || 0) + CONFIG.XP_PER_MERGE * 4;
            }
            SaveManager.save(this.state);

            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            this.scene.start('GameScene');
        });

        modal.add([
            shadowG, bg, headerBg, title, sub,
            prizePill, prizeTxt, adTitle,
            trackBg, lX2Left, lX3Left, lX5Mid, lX3Right, lX2Right,
            knobContainer,
            claimBtn,
            skipContainer
        ]);

        // Анимация бегающего ползунка с комфортной скоростью (~1.8 сек проход)
        this._resultSlider = {
            active: true,
            container: knobContainer,
            trackW,
            onUpdate: (time) => {
                if (!sliderActive) return;
                const sinVal = Math.sin(time * 0.0035);
                const xPos = sinVal * (trackW / 2 - 15);
                knobContainer.x = xPos;

                const absDist = Math.abs(xPos);
                if (absDist < 30) {
                    currentMult = 5;
                } else if (absDist < 75) {
                    currentMult = 4;
                } else if (absDist < 110) {
                    currentMult = 3;
                } else {
                    currentMult = 2;
                }

                // Динамическая подсветка активного множителя
                lX5Mid.setScale(currentMult === 5 ? 1.25 : 1.0);
                lX3Left.setScale((currentMult === 4 || currentMult === 3) && xPos < 0 ? 1.2 : 1.0);
                lX3Right.setScale((currentMult === 4 || currentMult === 3) && xPos > 0 ? 1.2 : 1.0);
                lX2Left.setScale(currentMult === 2 && xPos < 0 ? 1.15 : 1.0);
                lX2Right.setScale(currentMult === 2 && xPos > 0 ? 1.15 : 1.0);

                claimBtn.setText(`🎬 ЗАБРАТЬ x${currentMult} (💎 ${formatNumber(basePrize * currentMult)})`);
            }
        };

        claimBtn.setText(`🎬 ЗАБРАТЬ x3 (💎 ${formatNumber(basePrize * 3)})`);
    }

    update(time, delta) {
        if (this._resultSlider && this._resultSlider.active) {
            this._resultSlider.onUpdate(time);
        }
    }

    _makeButton(cx, cy, w, h, label, color, callback, fontSize = '15px') {
        const hex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        const bg = this.add.graphics();
        const shadowHex = typeof darkenColor === 'function' ? darkenColor(hex, 0.42) : 0x111625;
        // 3D bottom base shadow
        drawRoundRect(bg, cx - w / 2, cy - h / 2 + 3, w, h, 10, shadowHex, 1);
        // Face button
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h - 2, 10, hex, 1);
        // Top highlight
        bg.fillStyle(0xffffff, 0.25);
        bg.fillRoundedRect(cx - w / 2 + 4, cy - h / 2 + 2, w - 8, Math.floor((h - 2) * 0.42), 5);

        const txt = createHDText(this, cx, cy - 1, label, {
            fontSize,
            fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#fff',
            stroke: '#111625',
            strokeThickness: 2.5,
            fontStyle: '800',
        }).setOrigin(0.5);

        const hit = this.add.rectangle(cx, cy, w, h, 0, 0).setInteractive({ cursor: 'pointer' });
        hit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playClick();
            }
            bg.y += 2;
            txt.y += 2;
            this.time.delayedCall(90, () => {
                bg.y -= 2;
                txt.y -= 2;
                callback();
            });
        });
        return [bg, txt, hit];
    }

    _spawnDamageBadge(x, y, damage, isCrit, isPlayer) {
        const container = this.add.container(x, y).setDepth(200);
        const badgeBg = this.add.graphics();
        const icon = isCrit ? '⚡' : '💥';
        const label = isCrit ? `КРИТ -${formatNumber(damage)}` : `-${formatNumber(damage)}`;
        // If isPlayer wall was hit, show orange/red. If bot wall was hit, show emerald/cyan.
        const bgHex = isCrit ? 0xdc2626 : (isPlayer ? 0xef4444 : 0x10b981);
        const txt = createHDText(this, 0, 0, `${icon} ${label}`, {
            fontSize: isCrit ? '14px' : '12px',
            fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff',
            stroke: '#111625',
            strokeThickness: 2.5,
            fontStyle: '900',
        }).setOrigin(0.5);

        const badgeW = txt.width + 16;
        const badgeH = isCrit ? 26 : 22;
        drawRoundRect(badgeBg, -badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2, bgHex, 0.95, 0xffffff, 1.5);
        container.add([badgeBg, txt]);
        container.setScale(0.4);

        this.tweens.add({
            targets: container,
            y: y - 36,
            scaleX: isCrit ? 1.25 : 1.0,
            scaleY: isCrit ? 1.25 : 1.0,
            duration: 180,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: container,
                    y: y - 64,
                    alpha: 0,
                    duration: 380,
                    ease: 'Quad.In',
                    onComplete: () => container.destroy()
                });
            }
        });
    }
}
