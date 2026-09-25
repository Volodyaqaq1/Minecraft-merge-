// ============================================================
// scenes/BattleScene.js — арена боя: гонка по разрушению стенки
// ============================================================

class BattleScene extends Phaser.Scene {
    constructor() { super({ key: 'BattleScene' }); }

    init(data) {
        this.playerTeam = (data && data.playerTeam) ? data.playerTeam : [];
        this.botTeam    = (data && data.botTeam) ? data.botTeam : [];
        this.botName    = (data && data.botName) ? data.botName : 'Бот';
        this.state      = (data && data.state) ? SaveManager._deepClone(data.state) : SaveManager.load();
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
        this.chestIcon.baseScale = this.chestIcon.scaleX;

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
        const botPowerRatio = (this.botTeam.length > 0 && this.playerTeam.length > 0)
            ? (this.playerTeam.length / this.botTeam.length)
            : 1.0;
        const bTotalAtk = this.botTeam.reduce((s, m) => s + m.atk, 0) * botPowerRatio;
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

        // 1. Цвет древесины в зависимости от урона (темнеет / затирается при уроне)
        let woodColor = 0xb27848;
        let strokeColor = 0x6e4624;
        if (damageRatio >= 0.65) {
            woodColor = 0x8c5731; // темный избитый брус
            strokeColor = 0x4a2a12;
        } else if (damageRatio >= 0.30) {
            woodColor = 0x9f663a; // слегка потертый брус
            strokeColor = 0x5a3418;
        }

        // Деревянная основа (бревна / брус)
        g.fillStyle(woodColor, 1);
        g.fillRoundedRect(x, y, w, h, 8);

        // Линии досок и окантовка
        g.lineStyle(3, strokeColor, 1);
        g.strokeRoundedRect(x, y, w, h, 8);

        const plankH = 40;
        for (let py = y + plankH; py < y + h; py += plankH) {
            g.lineBetween(x, py, x + w, py);
        }

        // 2. Стадия 1 повреждений (HP < 70%, damageRatio >= 0.3): первые трещины и легкие сколы
        if (damageRatio >= 0.30) {
            g.lineStyle(2, 0x3d2314, 0.95);
            g.lineBetween(x + 12, y + 45, x + 28, y + 80);
            g.lineBetween(x + 28, y + 80, x + 20, y + 115);
            g.lineBetween(x + 44, y + 165, x + 32, y + 195);

            // Тонкие насечки на древесине
            g.lineStyle(1.5, 0x2e180d, 0.85);
            g.lineBetween(x + 6, y + 62, x + 16, y + 66);
            g.lineBetween(x + 36, y + 130, x + 48, y + 136);
        }

        // 3. Стадия 2 повреждений (HP < 35%, damageRatio >= 0.65): глубокие разломы и выбитые края
        if (damageRatio >= 0.65) {
            g.lineStyle(2.8, 0x1f0e05, 1);
            g.lineBetween(x + 10, y + 75, x + 35, y + 100);
            g.lineBetween(x + 35, y + 100, x + 50, y + 125);
            g.lineBetween(x + 18, y + 145, x + 40, y + 180);
            g.lineBetween(x + 40, y + 180, x + 24, y + 220);
            g.lineBetween(x + 8, y + 205, x + 32, y + 235);

            // Выбитые края/сколы по контуру стенки (прорези темного цвета)
            g.fillStyle(0x1a0c04, 0.95);
            g.fillTriangle(x, y + 90, x + 8, y + 95, x, y + 102);
            g.fillTriangle(x + w, y + 150, x + w - 7, y + 156, x + w, y + 162);
            g.fillTriangle(x, y + 175, x + 6, y + 180, x, y + 187);
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
            avatar.baseScale = avatar.scaleX;

            const nameT = createHDText(this, cx, y + 25, mob.name, {
                fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#ffffff',
                stroke: '#0f172a', strokeThickness: 2.5, fontStyle: '800',
            }).setOrigin(0.5, 0);

            // Аккуратная плашка урона
            const atkPill = this.add.graphics();
            drawRoundRect(atkPill, cx - 34, y + 38, 68, 17, 8, isPlayer ? 0x14532d : 0x7f1d1d, 0.9, isPlayer ? 0x22c55e : 0xef4444, 1);

            const isBot = !isPlayer;
            const botPowerRatio = (isBot && this.botTeam.length > 0 && this.playerTeam.length > 0)
                ? (this.playerTeam.length / this.botTeam.length)
                : 1.0;
            const effectiveAtk = isPlayer ? mob.atk : Math.max(1, Math.round(mob.atk * botPowerRatio));

            const atkT = createHDText(this, cx, y + 46, `⚔ ${formatNumber(effectiveAtk)}`, {
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

        // Попадание точно в обращенную к мобу поверхность деревянной стенки
        const surfaceOffset = isPlayer ? -26 : 26;
        const wallBaseX = isPlayer ? this.pWallX : this.bWallX;
        const targetX = wallBaseX + surfaceOffset;
        const targetY = isPlayer ? (this.pWallY - 70 + mobIdx * 70) : (this.bWallY - 70 + mobIdx * 70);

        // Крит с шансом 18% (определяется заранее для усиленного выпада атакующего)
        const isCrit = Math.random() < 0.18;

        // ── 1. ВЫПАД АТАКУЮЩЕГО (Attacker Lunge) ──
        const lungeDist = isCrit ? 20 : 16;
        const targetLungeX = startX + (isPlayer ? lungeDist : -lungeDist);
        const lungeScaleX = isCrit ? 1.12 : 1.07;
        const lungeScaleY = isCrit ? 0.93 : 0.95;

        this.tweens.killTweensOf(attacker.avatar);
        const bScale = attacker.avatar.baseScale || (50 / 256);
        attacker.avatar.x = startX;
        attacker.avatar.y = startY - 6;
        attacker.avatar.setScale(bScale);

        this.tweens.add({
            targets: attacker.avatar,
            x: targetLungeX,
            scaleX: bScale * lungeScaleX,
            scaleY: bScale * lungeScaleY,
            duration: isCrit ? 90 : 80,
            ease: 'Quad.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: attacker.avatar,
                    x: startX,
                    scaleX: bScale,
                    scaleY: bScale,
                    duration: isCrit ? 110 : 100,
                    ease: 'Quad.InOut',
                    onComplete: () => {
                        attacker.avatar.x = startX;
                        attacker.avatar.y = startY - 6;
                        attacker.avatar.setScale(bScale);
                    }
                });
            }
        });

        // 2. Снаряд (звездочка / огненный шар) летит от моба к стенке
        const proj = this.add.text(startX, startY, isPlayer ? '⭐' : '🔥', {
            fontSize: isCrit ? '26px' : '22px',
        }).setOrigin(0.5).setDepth(80);

        this.tweens.add({
            targets: proj,
            x: targetX,
            y: targetY,
            duration: 220,
            ease: 'Quad.In',
            onComplete: () => {
                proj.destroy();
                this._onWallHit(side, attacker.mob, targetX, targetY, isCrit);
            }
        });
    }

    _onWallHit(side, mob, hitX, hitY, isCrit = false) {
        if (this.battleEnded) return;

        const isPlayer = side === 'player';
        const botPowerRatio = (!isPlayer && this.botTeam.length > 0 && this.playerTeam.length > 0)
            ? (this.playerTeam.length / this.botTeam.length)
            : 1.0;
        const effectiveAtk = isPlayer ? mob.atk : Math.max(1, Math.round(mob.atk * botPowerRatio));
        const damage = Math.round(effectiveAtk * (isCrit ? 1.75 : 1.0));

        // 1. Звук удара (обычный панч или сочный крит со звоном)
        if (typeof SoundManager !== 'undefined') {
            if (typeof SoundManager.playHit === 'function') {
                SoundManager.playHit(isCrit);
            } else {
                SoundManager.playClink();
            }
        }

        // 2. Удар по деревянной стенке (Wall Impact & Punch)
        const wallG = isPlayer ? this.pWallGraphics : this.bWallGraphics;
        const baseX = wallG._shakeBaseX !== undefined ? wallG._shakeBaseX : (isPlayer ? this.pWallX : this.bWallX);
        const punchDisp = (isPlayer ? 1 : -1) * (isCrit ? 6 : 4);
        const punchScaleX = isCrit ? 1.08 : 1.055;
        const punchScaleY = isCrit ? 0.93 : 0.955;

        this.tweens.killTweensOf(wallG);
        wallG.x = baseX + punchDisp;
        wallG.scaleX = punchScaleX;
        wallG.scaleY = punchScaleY;

        this.tweens.add({
            targets: wallG,
            x: baseX,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: isCrit ? 110 : 90,
            ease: 'Back.Out',
            onComplete: () => {
                wallG.x = baseX;
                wallG.setScale(1.0);
            }
        });

        // 3. Короткая белая вспышка на стенке (Hit Flash, 60-80ms)
        const wallFlash = this.add.graphics().setDepth(30);
        wallFlash.fillStyle(0xffffff, isCrit ? 0.65 : 0.45);
        wallFlash.fillRoundedRect(baseX - 30, this.pWallY - 130, 60, 260, 8);
        this.tweens.add({
            targets: wallFlash,
            alpha: 0,
            duration: isCrit ? 80 : 60,
            ease: 'Quad.Out',
            onComplete: () => wallFlash.destroy(),
        });

        // 4. Частицы щепок (Wood Chips)
        this._spawnWoodChips(hitX, hitY, isCrit, isPlayer);

        // 5. Микро-тряска экрана ТОЛЬКО на крит (70ms, интенсивность 0.0025)
        if (isCrit) {
            this.cameras.main.shake(70, 0.0025);
        }

        // 6. Компактный всплывающий урон (Damage badge)
        this._spawnDamageBadge(hitX + (isPlayer ? 14 : -14), hitY, damage, isCrit, isPlayer);

        // 7. Уменьшение HP стенки
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
        const targetX = isWin ? 190 : CONFIG.WIDTH - 190;

        const brokenWall = isWin ? this.pWallGraphics : this.bWallGraphics;
        const brokenWallX = isWin ? this.pWallX : this.bWallX;
        const brokenWallY = this.pWallY;

        // Обнуление HP полоски разбитой стенки
        if (isWin) {
            this.pWallHP = 0;
            this._updateWallHPBar('player', true);
        } else {
            this.bWallHP = 0;
            this._updateWallHPBar('bot', true);
        }

        // ── 1. ФИНАЛЬНОЕ РАЗРУШЕНИЕ СТЕНКИ (Final Wall Break Payoff) ──
        if (typeof SoundManager !== 'undefined') {
            if (typeof SoundManager.playHit === 'function') SoundManager.playHit(true);
            SoundManager.playPop();
        }

        // Легкая вспышка экрана
        const screenFlash = this.add.rectangle(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, CONFIG.WIDTH, CONFIG.HEIGHT, 0xffffff, 0.16).setDepth(250);
        this.tweens.add({
            targets: screenFlash,
            alpha: 0,
            duration: 200,
            ease: 'Quad.Out',
            onComplete: () => screenFlash.destroy(),
        });

        // 14-16 разлетающихся щепок и облачка пыли
        this._spawnWallBreakExplosion(brokenWallX, brokenWallY);

        // Панч и разрушение стенки: scaleX 1.08, scaleY 0.82 -> scaleY 0, alpha 0, duration 260ms
        this.tweens.killTweensOf(brokenWall);
        brokenWall.scaleX = 1.08;
        brokenWall.scaleY = 0.82;

        this.tweens.add({
            targets: brokenWall,
            scaleX: 1.15,
            scaleY: 0,
            alpha: 0,
            duration: 260,
            ease: 'Cubic.In',
            onComplete: () => {
                brokenWall.setVisible(false);
            }
        });

        // ── 2. РЕАКЦИЯ ПОБЕДИВШЕЙ КОМАНДЫ (Victory Team Rush) ──
        const winTeam = isWin ? this._playerSprites : this._botSprites;
        const rushDir = isWin ? 24 : -24;

        winTeam.forEach((member, idx) => {
            this.time.delayedCall(idx * 60, () => {
                if (!member || !member.avatar) return;
                const origX = member.x;
                const origY = member.y - 6;
                const bScale = member.avatar.baseScale || (50 / 256);

                // 1. Bounce вверх 8-12px + пиковый scale 1.05
                this.tweens.add({
                    targets: member.avatar,
                    y: origY - 10,
                    scaleX: bScale * 1.05,
                    scaleY: bScale * 1.05,
                    duration: 140,
                    ease: 'Back.Out',
                    onComplete: () => {
                        // 2. Шаг/рывок в сторону сокровища (+24px) и возврат по Y
                        this.tweens.add({
                            targets: member.avatar,
                            x: origX + rushDir,
                            y: origY,
                            scaleX: bScale,
                            scaleY: bScale,
                            duration: 180,
                            ease: 'Quad.Out',
                        });
                    }
                });
            });
        });

        // Победный салют из конфетти и звездочек рядом с победителями
        this._spawnVictoryConfetti(isWin ? 90 : CONFIG.WIDTH - 90, CONFIG.HEIGHT / 2);

        // ── 3. ПЕРЕМЕЩЕНИЕ И ВЗРЫВ СОКРОВИЩА (Treasure Payoff) ──
        this.tweens.killTweensOf(this.treasureContainer);
        this.tweens.add({
            targets: this.treasureContainer,
            x: targetX,
            scaleX: 1.18,
            scaleY: 1.18,
            duration: 360,
            ease: 'Cubic.Out',
            onComplete: () => {
                // Chest pop: 0.82 -> 1.16 -> 1.0 + vertical bounce (y -10px -> original)
                const cBase = this.chestIcon.baseScale || (68 / 512);
                this.chestIcon.setScale(cBase * 0.82);
                this.chestIcon.y = -26;
                this.tweens.add({
                    targets: this.chestIcon,
                    scaleX: cBase * 1.16,
                    scaleY: cBase * 1.16,
                    y: -16,
                    duration: 150,
                    ease: 'Back.Out',
                    onComplete: () => {
                        this.tweens.add({
                            targets: this.chestIcon,
                            scaleX: cBase,
                            scaleY: cBase,
                            duration: 100,
                            ease: 'Quad.InOut',
                        });
                    }
                });

                // Короткое золотое glow ring вокруг сундука
                const chestGlow = this.add.graphics();
                chestGlow.lineStyle(3, 0xffd700, 0.8);
                chestGlow.strokeCircle(0, -16, 22);
                this.treasureContainer.add(chestGlow);
                this.tweens.add({
                    targets: chestGlow,
                    scaleX: 2.5,
                    scaleY: 2.5,
                    alpha: 0,
                    duration: 280,
                    ease: 'Quad.Out',
                    onComplete: () => chestGlow.destroy(),
                });

                // Пульсация золотого сияния лучей
                this.tweens.add({
                    targets: this.rays,
                    alpha: 0.50,
                    scaleX: 1.35,
                    scaleY: 1.35,
                    duration: 220,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                });

                // Награда всплывает с pop: scale 0.8 -> 1.12 -> 1.0
                this.prizeText.setScale(0.8);
                this.tweens.add({
                    targets: this.prizeText,
                    scaleX: 1.12,
                    scaleY: 1.12,
                    duration: 150,
                    ease: 'Back.Out',
                    onComplete: () => {
                        this.tweens.add({
                            targets: this.prizeText,
                            scaleX: 1.0,
                            scaleY: 1.0,
                            duration: 100,
                        });
                    }
                });

                // 8-12 небольших конфетти около сундука
                this._spawnChestConfetti(targetX, CONFIG.HEIGHT / 2 - 16);

                if (typeof SoundManager !== 'undefined') SoundManager.playCoin();
            }
        });

        // Переход к модальному окну победы через комфортные 1200ms
        this.time.delayedCall(1200, () => {
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
                this.scene.start('GameScene', { state: this.state });
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
            this.scene.start('GameScene', { state: this.state });
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

        const label = isCrit ? `КРИТ! -${formatNumber(damage)}` : `-${formatNumber(damage)}`;
        const textColor = isCrit ? '#fef08a' : (isPlayer ? '#fca5a5' : '#86efac');
        const strokeColor = isCrit ? '#7f1d1d' : '#0f172a';
        const fontSize = isCrit ? '18px' : '15px'; // увеличен на 10-15% для лучшей читаемости

        const txt = createHDText(this, 0, 0, label, {
            fontSize,
            fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: textColor,
            stroke: strokeColor,
            strokeThickness: isCrit ? 3.5 : 2.5,
            fontStyle: '900',
        }).setOrigin(0.5);

        // Компактная полупрозрачная плашечка под цифры урона
        const padX = isCrit ? 10 : 8;
        const padY = isCrit ? 5 : 4;
        const bgW = txt.width + padX * 2;
        const bgH = isCrit ? 26 : 21;
        const bgG = this.add.graphics();
        const bgHex = isCrit ? 0xb91c1c : 0x0f172a;
        drawRoundRect(bgG, -bgW / 2, -bgH / 2, bgW, bgH, bgH / 2, bgHex, isCrit ? 0.92 : 0.80, isCrit ? 0xf59e0b : 0x334155, 1);

        container.add([bgG, txt]);
        container.setScale(0.85);

        // Анимация: scale 0.85 -> 1.05 -> 1.0, подъем вверх и fade out за ~580ms
        this.tweens.add({
            targets: container,
            y: y - 20,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 120,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: container,
                    y: y - 48,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    alpha: 0,
                    duration: 460,
                    ease: 'Quad.In',
                    onComplete: () => container.destroy(),
                });
            }
        });
    }

    _spawnWoodChips(x, y, isCrit, isPlayer) {
        // Увеличены размер щепок на ~25% и дальность разлета
        const count = isCrit ? Phaser.Math.Between(8, 12) : Phaser.Math.Between(5, 7);
        const colors = [0x8b5a2b, 0xa06535, 0xc49a6c, 0xd4a373, 0xf59e0b];

        for (let i = 0; i < count; i++) {
            const g = this.add.graphics().setDepth(180);
            const color = colors[i % colors.length];
            g.fillStyle(color, 1.0);
            g.lineStyle(1.4, 0x3d1d07, 0.95);

            // Крупнее на ~25%: w 7-11, h 4-8
            const w = Phaser.Math.Between(7, 11);
            const h = Phaser.Math.Between(4, 8);
            if (i % 2 === 0) {
                g.fillRect(-w / 2, -h / 2, w, h);
                g.strokeRect(-w / 2, -h / 2, w, h);
            } else {
                g.fillTriangle(-w / 2, h / 2, 0, -h / 2, w / 2, h / 2);
                g.strokeTriangle(-w / 2, h / 2, 0, -h / 2, w / 2, h / 2);
            }

            const startX = x + Phaser.Math.Between(-5, 5);
            const startY = y + Phaser.Math.Between(-10, 10);
            g.setPosition(startX, startY);

            // Разлет щепок наружу в открытое пространство перед стенкой
            const baseAngle = isPlayer ? Math.PI : 0;
            const angle = baseAngle + (Math.random() - 0.5) * 1.7;
            const dist = isCrit ? Phaser.Math.Between(36, 68) : Phaser.Math.Between(28, 54);
            const lifetime = Phaser.Math.Between(340, 500);
            const targetX = startX + Math.cos(angle) * dist;
            const targetY = startY + Math.sin(angle) * dist + Phaser.Math.Between(8, 20);

            this.tweens.add({
                targets: g,
                x: targetX,
                y: targetY,
                angle: Phaser.Math.Between(-240, 240),
                alpha: 0,
                scaleX: 0.25,
                scaleY: 0.25,
                duration: lifetime,
                ease: 'Quad.Out',
                onComplete: () => g.destroy(),
            });
        }

        // Для критического удара: impact ring + 6-8 золотых искр
        if (isCrit) {
            // Короткий impact ring: radius 15 -> 42, alpha 0.75 -> 0, duration ~220ms
            const ring = this.add.graphics().setDepth(184);
            ring.lineStyle(3, 0xffd700, 0.75);
            ring.strokeCircle(0, 0, 15);
            ring.setPosition(x, y);
            this.tweens.add({
                targets: ring,
                scaleX: 42 / 15,
                scaleY: 42 / 15,
                alpha: 0,
                duration: 220,
                ease: 'Quad.Out',
                onComplete: () => ring.destroy(),
            });

            // 6-8 хорошо видимых золотых sparks/stars
            const sparkCount = Phaser.Math.Between(6, 8);
            for (let i = 0; i < sparkCount; i++) {
                const spark = this.add.graphics().setDepth(185);
                spark.fillStyle(0xffd700, 1.0);
                spark.lineStyle(1.5, 0xffffff, 0.9);
                const sparkSize = 5.5;
                spark.fillCircle(0, 0, sparkSize);
                spark.strokeCircle(0, 0, sparkSize);
                spark.setPosition(x, y);

                const sAngle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.4;
                const sDist = Phaser.Math.Between(32, 58);

                this.tweens.add({
                    targets: spark,
                    x: x + Math.cos(sAngle) * sDist,
                    y: y + Math.sin(sAngle) * sDist,
                    alpha: 0,
                    scaleX: 0.15,
                    scaleY: 0.15,
                    duration: 380,
                    ease: 'Cubic.Out',
                    onComplete: () => spark.destroy(),
                });
            }
        }
    }

    _spawnChestConfetti(x, y) {
        const colors = [0xffd700, 0x22c55e, 0x38bdf8, 0xfbbf24, 0xf43f5e];
        const count = 10;
        for (let i = 0; i < count; i++) {
            const g = this.add.graphics().setDepth(175);
            g.fillStyle(colors[i % colors.length], 1.0);
            g.fillRect(-2.5, -2, 5, 4);

            const startX = x + Phaser.Math.Between(-15, 15);
            const startY = y + Phaser.Math.Between(-15, 15);
            g.setPosition(startX, startY);

            const angle = (i / count) * Math.PI * 2;
            const dist = Phaser.Math.Between(20, 42);

            this.tweens.add({
                targets: g,
                x: startX + Math.cos(angle) * dist,
                y: startY + Math.sin(angle) * dist - Phaser.Math.Between(5, 15),
                angle: Phaser.Math.Between(-180, 180),
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: Phaser.Math.Between(360, 520),
                ease: 'Quad.Out',
                onComplete: () => g.destroy(),
            });
        }
    }

    _spawnWallBreakExplosion(x, y) {
        // 14-16 разлетающихся крупных деревянных обломков
        const count = 16;
        const colors = [0x8b5a2b, 0xa06535, 0xc49a6c, 0xd4a373, 0x6e4624, 0xf59e0b];

        for (let i = 0; i < count; i++) {
            const g = this.add.graphics().setDepth(160);
            const color = colors[i % colors.length];
            g.fillStyle(color, 1.0);

            const w = Phaser.Math.Between(4, 8);
            const h = Phaser.Math.Between(3, 7);
            g.fillRect(-w / 2, -h / 2, w, h);

            const startY = y + Phaser.Math.Between(-90, 90);
            g.setPosition(x, startY);

            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = Phaser.Math.Between(35, 80);
            const targetX = x + Math.cos(angle) * dist;
            const targetY = startY + Math.sin(angle) * dist + Phaser.Math.Between(10, 25);
            const dur = Phaser.Math.Between(350, 520);

            this.tweens.add({
                targets: g,
                x: targetX,
                y: targetY,
                angle: Phaser.Math.Between(-260, 260),
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: dur,
                ease: 'Cubic.Out',
                onComplete: () => g.destroy(),
            });
        }

        // 6 клубов пыли
        for (let i = 0; i < 6; i++) {
            const dust = this.add.graphics().setDepth(159);
            dust.fillStyle(0xd5c4a1, 0.45);
            const r = Phaser.Math.Between(8, 16);
            dust.fillCircle(0, 0, r);
            const startY = y + Phaser.Math.Between(-70, 70);
            dust.setPosition(x, startY);

            this.tweens.add({
                targets: dust,
                x: x + (Math.random() - 0.5) * 60,
                y: startY + (Math.random() - 0.5) * 40 - 15,
                scaleX: 1.6,
                scaleY: 1.6,
                alpha: 0,
                duration: 480,
                ease: 'Quad.Out',
                onComplete: () => dust.destroy(),
            });
        }
    }

    _spawnVictoryConfetti(x, y) {
        const colors = [0xffd700, 0x22c55e, 0x38bdf8, 0xf43f5e, 0xfbbf24, 0xa855f7];
        const count = 12;

        for (let i = 0; i < count; i++) {
            const g = this.add.graphics().setDepth(170);
            const color = colors[i % colors.length];
            g.fillStyle(color, 1.0);

            if (i % 3 === 0) {
                g.fillTriangle(0, -5, 4, 4, -4, 4);
                g.fillTriangle(0, 5, 4, -4, -4, -4);
            } else {
                g.fillRect(-3, -2, 6, 4);
            }

            const startX = x + Phaser.Math.Between(-30, 30);
            const startY = y + Phaser.Math.Between(-80, 80);
            g.setPosition(startX, startY);

            const angle = (i / count) * Math.PI * 2;
            const dist = Phaser.Math.Between(25, 60);

            this.tweens.add({
                targets: g,
                x: startX + Math.cos(angle) * dist,
                y: startY + Math.sin(angle) * dist - Phaser.Math.Between(5, 20),
                angle: Phaser.Math.Between(-180, 180),
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: Phaser.Math.Between(450, 650),
                ease: 'Cubic.Out',
                onComplete: () => g.destroy(),
            });
        }
    }

    _playDefenderReaction(mobSprite, fromLeft) {
        if (!mobSprite || !mobSprite.avatar) return;
        const avatar = mobSprite.avatar;
        const origX = mobSprite.x;
        const origY = mobSprite.y - 6;
        const knockbackX = origX + (fromLeft ? 5 : -5);

        avatar.setTint(0xffffff);
        this.time.delayedCall(70, () => {
            if (avatar && avatar.active) avatar.clearTint();
        });

        this.tweens.killTweensOf(avatar);
        const bScale = avatar.baseScale || (50 / 256);
        this.tweens.add({
            targets: avatar,
            x: knockbackX,
            scaleX: bScale * 1.08,
            scaleY: bScale * 0.92,
            duration: 70,
            ease: 'Quad.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: avatar,
                    x: origX,
                    scaleX: bScale,
                    scaleY: bScale,
                    duration: 90,
                    ease: 'Quad.InOut',
                    onComplete: () => {
                        avatar.x = origX;
                        avatar.y = origY;
                        avatar.setScale(bScale);
                    }
                });
            }
        });
    }
}
