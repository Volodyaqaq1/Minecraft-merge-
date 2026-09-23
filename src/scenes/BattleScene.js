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

        // Лучи сияния за сундуком (позиционируем в центре, рисуем в 0, 0)
        this.rays = this.add.graphics();
        this.rays.setPosition(cx, cy);
        this.rays.fillStyle(0xffd700, 0.15);
        this.rays.fillCircle(0, 0, 110);

        // Иконка сундука
        this.chestIcon = this.add.image(cx, cy - 20, 'icon_chest').setDisplaySize(68, 68);

        // Подпись награды
        this.prizeText = createHDText(this, cx, cy + 40, `💎 ${formatNumber(this.prize)}`, {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#5dff6e', stroke: '#111625', strokeThickness: 3, fontStyle: '900',
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

        // ── 1. Стенка Игрока (слева, ровно посередине между мобами 90 и центром 450) ──
        this.pWallX = 270;
        this.pWallY = wallY;
        this.pWallGraphics = this.add.graphics();
        this.pWallGraphics.setPosition(this.pWallX, this.pWallY);
        this._drawWoodenWall(this.pWallGraphics, -wallW / 2, -wallH / 2, wallW, wallH);

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
        this.pBarText = createHDText(this, this.pWallX, H - 78, '100%', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ffffff', fontStyle: '800'
        }).setOrigin(0.5);
        this._updateWallHPBar('player');

        // ── 2. Стенка Бота (справа, ровно посередине между ботом 810 и центром 450) ──
        this.bWallX = W - 270;
        this.bWallY = wallY;
        this.bWallGraphics = this.add.graphics();
        this.bWallGraphics.setPosition(this.bWallX, this.bWallY);
        this._drawWoodenWall(this.bWallGraphics, -wallW / 2, -wallH / 2, wallW, wallH);

        this.bWallMaxHP = matchWallHP;
        this.bWallHP    = matchWallHP;

        // HP бар стенки бота (красный снизу)
        const bBarBg = this.add.graphics();
        drawRoundRect(bBarBg, this.bWallX - 60, H - 90, 120, 24, 6, 0x1f2421, 0.9, 0xffffff, 2);

        this.bBarFill = this.add.graphics();
        this.bBarText = createHDText(this, this.bWallX, H - 78, '100%', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ffffff', fontStyle: '800'
        }).setOrigin(0.5);
        this._updateWallHPBar('bot');
    }

    _drawWoodenWall(g, x, y, w, h) {
        g.clear();
        // Деревянная текстура (доски)
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

            const mobTex = mob.texture || (mob.level <= 10 ? `mob_0${mob.level}` : 'mob_placeholder');
            const avatar = this.add.image(cx, y - 6, mobTex).setDisplaySize(56, 56);

            const nameT = createHDText(this, cx, y + 26, mob.name, {
                fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ffffff',
                stroke: '#111625', strokeThickness: 2, fontStyle: '800',
            }).setOrigin(0.5, 0);

            const atkT = createHDText(this, cx, y + 39, `⚔${formatNumber(mob.atk)}`, {
                fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: isPlayer ? '#4ade80' : '#f87171',
                stroke: '#111625', strokeThickness: 2, fontStyle: '800',
            }).setOrigin(0.5, 0);

            sprites.push({ bg, avatar, emoji: avatar, nameT, atkT, mob, x: cx, y });
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
        const targetX = isWin ? 150 : CONFIG.WIDTH - 150;

        // Анимация разрушения стенки победителя
        const brokenWall = isWin ? this.pWallGraphics : this.bWallGraphics;
        this.tweens.add({
            targets: brokenWall,
            alpha: 0,
            scaleY: 0,
            duration: 350,
        });

        // Награда перетягивается в сторону победителя («как будто он её забирает»)!
        const chestBaseScale = this.chestIcon.scaleX;
        this.tweens.add({
            targets: this.chestIcon,
            x: targetX,
            scaleX: chestBaseScale * 1.25,
            scaleY: chestBaseScale * 1.25,
            duration: 800,
            ease: 'Back.Out',
        });
        this.tweens.add({
            targets: [this.prizeText, this.rays],
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

        const cardW = 480;
        const cardH = 310;
        const bg = this.add.graphics();
        drawRoundRect(bg, -cardW / 2, -cardH / 2, cardW, cardH, 20, 0xfffdf0, 0.99, 0xf39c12, 3.5);

        const titleText = isWin ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ...';
        const titleColor = isWin ? '#198754' : '#b02a37';
        const title = createHDText(this, 0, -112, titleText, {
            fontSize: '28px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: titleColor, fontStyle: '900'
        }).setOrigin(0.5);

        const subText = isWin
            ? '🏆 Отличный бой! Сокровище принадлежит вашей команде!'
            : '📗 Бери мобов более высокого уровня в бой, чтобы победить';
        const sub = createHDText(this, 0, -74, subText, {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#555555', fontStyle: '800', align: 'center', wordWrap: { width: cardW - 40 }
        }).setOrigin(0.5);

        const adTitle = createHDText(this, 0, -36, 'Увеличить награду за просмотр рекламы?', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#7f8c8d', fontStyle: '800'
        }).setOrigin(0.5);

        // Полоса слайдера от x2 до x5
        const trackW = 280;
        const trackH = 10;
        const trackY = 10;
        const trackBg = this.add.graphics();
        drawRoundRect(trackBg, -trackW / 2, trackY - trackH / 2, trackW, trackH, 5, 0xe8c48a, 1, 0xb98e4f, 1.5);

        // Метки множителей над шкалой
        const labelY = trackY - 18;
        const lX2Left  = createHDText(this, -trackW / 2 + 10, labelY, 'x2', { fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#888', fontStyle: '800' }).setOrigin(0.5);
        const lX3Left  = createHDText(this, -trackW / 4, labelY, 'x3', { fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#888', fontStyle: '800' }).setOrigin(0.5);
        const lX5Mid   = createHDText(this, 0, labelY, 'x5 🔥', { fontSize: '16px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#e11d48', fontStyle: '900' }).setOrigin(0.5);
        const lX3Right = createHDText(this, trackW / 4, labelY, 'x3', { fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#888', fontStyle: '800' }).setOrigin(0.5);
        const lX2Right = createHDText(this, trackW / 2 - 10, labelY, 'x2', { fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#888', fontStyle: '800' }).setOrigin(0.5);

        // Бегающий ползунок
        const knobContainer = this.add.container(0, trackY);
        const knobG = this.add.graphics();
        drawRoundRect(knobG, -15, -15, 30, 30, 7, 0x8e44ad, 1, 0xffffff, 2);
        const knobTxt = createHDText(this, 0, 0, '🎬', { fontSize: '16px' }).setOrigin(0.5);
        knobContainer.add([knobG, knobTxt]);

        let sliderActive = true;
        let currentMult = 3;

        // Большая зеленая кнопка множителя
        const [claimBg, claimTxt, claimHit] = this._makeButton(0, 70, 240, 50, '', '#2ed573', () => {
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
        }, '16px');

        // Текстовая кнопка "НЕ НАДО" (забрать 1x без рекламы)
        const skipTxt = createHDText(this, 0, 124, 'НЕ НАДО', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#7f8c8d', fontStyle: '800'
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

        skipTxt.on('pointerdown', () => {
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
            bg, title, sub, adTitle,
            trackBg, lX2Left, lX3Left, lX5Mid, lX3Right, lX2Right,
            knobContainer,
            claimBg, claimTxt, claimHit,
            skipTxt
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

                claimTxt.setText(`${formatNumber(basePrize * currentMult)} 💎 ▶`);
            }
        };

        claimTxt.setText(`${formatNumber(basePrize * 3)} 💎 ▶`);
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
