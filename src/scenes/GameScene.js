// ============================================================
// scenes/GameScene.js — главный экран: свободное поле, кликер, инкубатор (5-10-15 ур), подарки за онлайн
// ============================================================

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init() {
        this.state    = SaveManager.load();
        this.economy  = new Economy(this.state);

        // Гарантируем структуру инкубатора и наград за онлайн
        const targetUnlocks = [5, 15, 25];
        if (!Array.isArray(this.state.incubatorSlots)) {
            this.state.incubatorSlots = [
                { id: 0, unlockLevel: 5, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
                { id: 1, unlockLevel: 15, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
                { id: 2, unlockLevel: 25, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
            ];
        } else {
            this.state.incubatorSlots.forEach((slot, i) => {
                slot.unlockLevel = targetUnlocks[i] || 5;
            });
        }
        if (!this.state.playtime) {
            this.state.playtime = { totalSeconds: 0, claimed: {} };
        }
        if (!Array.isArray(this.state.quests)) {
            this.state.quests = [];
        }
        this.quests = this.state.quests;

        // Комбо-шкала кликера (0..100%)
        this.comboGauge = 0;
        this.currentMultiplier = 1;
    }

    create() {
        setupSceneHiDPICamera(this);
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── 1. Красивый фон поляны (как на скриншоте сквишей) ───
        this._buildBackground();

        // ─── 2. Свободное поле мёрджа ───
        this.mergeField = new MergeField(this, this.economy, this.state);

        // Привязываем кликер по мобу к комбо и наградам
        this.mergeField.onMobClick = (mobItem) => this._onMobClicked(mobItem);

        // При успешном слиянии обновляем магазин, задания и показываем модалку открытия
        this.mergeField.onMergeSuccess = (newMob, isNew) => {
            this._onFieldChanged();
            if (isNew) {
                this._showNewMobUnlockModal(newMob);
            }
        };

        // Открытие нового моба из любого источника (магазин, реклама, инкубатор)
        this.mergeField.onNewMobDiscovered = (newMob) => {
            this._onFieldChanged();
            this._showNewMobUnlockModal(newMob);
        };

        // Быстрое комбо слияний подряд повышает шкалу множителя
        this.mergeField.onMergeCombo = (combo) => {
            if (combo >= 2) {
                this.comboGauge = Math.min(100, this.comboGauge + combo * 18);
                this._redrawComboBar();
            }
        };

        // ─── 3. Верхняя панель (уровень, комбо-шкала x1-x5, монеты, подарки) ───
        this._buildTopBar();

        // ─── 4. Правая панель (покупка за монеты и моб за рекламу) ───
        this._buildRightShop();

        // ─── 5. Левая панель заданий (до 3 заданий с вариативностью до 5 мобов) ───
        this._buildQuestPanel();
        this._scheduleNextQuest();

        // ─── 6. Нижняя панель (Коллекция, Инкубатор, Награды, В бой!) ───
        this._buildBottomBar();

        // ─── 7. Модальные окна ───
        this._buildBattleModal();
        this._buildFighterSelectModal();
        this._buildNewMobModal();
        this._buildPlaytimeModal();
        this._buildIncubatorModal();
        this._buildSettingsModal();

        // ─── 8. Привязка событий экономики к UI ───
        this.economy.onCoinsChange = (val) => this._setCoinsText(val);
        this.economy.onLevelChange = (lvl) => {
            this._updateLevelWidget();
            if (this._isInitialized) {
                spawnFloatingText(this, 130, 90, `НОВЫЙ УРОВЕНЬ ${lvl}! 🌟`, '#ffd700');
            }
        };

        // Синхронизируем уровень с максимальным открытым мобом
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        this.economy.setLevel(maxUnlocked);
        this._updateLevelWidget();

        // ─── 9. Таймер секунд (для онлайна и инкубатора) ───
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => this._onSecondTick(),
        });

        // ─── 10. Редкий вызов на бой от ботов (раз в 90 сек) ───
        this.time.addEvent({
            delay: CONFIG.BOT_CHALLENGE_INTERVAL,
            loop: true,
            callback: () => {
                if (this.mergeField.mobs.length > 0 &&
                    !this._battleModal.visible &&
                    !this._fighterModal.visible &&
                    !this._newMobModal.visible &&
                    !this._playtimeModal.visible &&
                    !this._incubatorModal.visible) {
                    this._openBattleModal();
                }
            },
        });

        // ─── 11. Автосохранение каждые 30 сек ───
        this.time.addEvent({
            delay: 30000,
            loop: true,
            callback: this._save,
            callbackScope: this,
        });

        // ─── 12. Пауза при сворачивании (для Яндекс Игр) ───
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._save();
        });

        // ─── 13. Dev Debug Telemetry Overlay (?debug=1 или CONFIG.DEBUG) ───
        this._buildDevDebugOverlay();
        this._isInitialized = true;
    }

    // ============================================================
    // Фоновая полянка
    // ============================================================

    // ============================================================
    // Фоновая полянка (Пастельный казуальный стиль как в "Сквиши Мерж")
    // ============================================================

    _buildBackground() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // 1. Нежное градиентное небо
        const sky = this.add.graphics();
        sky.fillGradientStyle(0x5cbcf6, 0x5cbcf6, 0xc8eeff, 0xc8eeff, 1);
        sky.fillRect(0, 0, W, H * 0.44);

        // 2. Пушистые процедурные облака (медленно плывут)
        this._clouds = [];
        const cloudData = [
            { x: 120, y: 38, s: 1.0, speed: 0.12 },
            { x: 420, y: 56, s: 0.8, speed: 0.17 },
            { x: 740, y: 34, s: 1.15, speed: 0.13 },
            { x: 920, y: 62, s: 0.7, speed: 0.19 },
        ];
        cloudData.forEach(c => {
            const cg = this.add.graphics();
            cg.fillStyle(0xffffff, 0.85);
            cg.fillCircle(0, 0, 22 * c.s);
            cg.fillCircle(-16 * c.s, 4 * c.s, 16 * c.s);
            cg.fillCircle(16 * c.s, 4 * c.s, 16 * c.s);
            cg.fillRoundedRect(-30 * c.s, 4 * c.s, 60 * c.s, 14 * c.s, 7 * c.s);
            cg.x = c.x;
            cg.y = c.y;
            this._clouds.push({ g: cg, speed: c.speed, s: c.s });
        });

        // 3. Дальние мягкие холмы
        const hills = this.add.graphics();
        hills.fillStyle(0x82ce42, 1);
        hills.beginPath();
        hills.arc(150, H * 0.43 + 60, 210, Math.PI, 0, false);
        hills.arc(520, H * 0.43 + 80, 280, Math.PI, 0, false);
        hills.arc(840, H * 0.43 + 60, 240, Math.PI, 0, false);
        hills.fillPath();

        // 4. Деревья на горизонте
        for (let i = 0; i < 9; i++) {
            const tx = 40 + i * 115 + (i % 2 === 0 ? 15 : -10);
            const ty = H * 0.34 + (i % 3) * 6;
            const tree = this.add.graphics();
            tree.fillStyle(0x785332, 0.9);
            tree.fillRect(tx - 4, ty, 8, 22);
            tree.fillStyle(0x4e9c2b, 0.95);
            tree.fillCircle(tx, ty - 12, 28);
            tree.fillStyle(0x62b738, 0.95);
            tree.fillCircle(tx - 6, ty - 16, 20);
            tree.fillStyle(0x3d8220, 0.95);
            tree.fillCircle(tx + 8, ty - 10, 18);
        }

        // 5. Тёплый фисташковый луг (основная поляна без ядовитых полос)
        const lawn = this.add.graphics();
        lawn.fillGradientStyle(0x9ee54f, 0x9ee54f, 0x6dbf2b, 0x6dbf2b, 1);
        lawn.fillRect(0, H * 0.36, W, H * 0.64);

        // 6. Мягкое солнечное пятно в центре
        const sunbeam = this.add.graphics();
        sunbeam.fillStyle(0xffffff, 0.10);
        sunbeam.fillEllipse(W / 2, H * 0.58, 520, 230);
        sunbeam.fillStyle(0xffffff, 0.05);
        sunbeam.fillEllipse(W / 2, H * 0.58, 680, 310);

        // 7. Декоративная листва по верхним углам
        const foliage = this.add.graphics();
        foliage.fillStyle(0x438622, 0.85);
        foliage.fillCircle(0, 0, 75);
        foliage.fillCircle(65, 0, 55);
        foliage.fillCircle(0, 55, 50);
        foliage.fillStyle(0x56a62f, 0.9);
        foliage.fillCircle(30, 25, 45);

        foliage.fillStyle(0x438622, 0.85);
        foliage.fillCircle(W, 0, 85);
        foliage.fillCircle(W - 70, 0, 60);
        foliage.fillCircle(W, 60, 55);
        foliage.fillStyle(0x56a62f, 0.9);
        foliage.fillCircle(W - 35, 30, 50);
    }

    // ============================================================
    // Верхняя панель (Уровень, Комбо-шкала x1-x5, Подарки, Баланс)
    // ============================================================

    _buildTopBar() {
        const W = CONFIG.WIDTH;

        // 1. Кнопка настроек + тактильный бейдж "Уровень X"
        this._buildSettingsAndLevelWidget(14, 10);

        // 2. Кнопка "🎁 Подарки" (объемная 3D казуальная зеленая кнопка)
        this._giftBtn = createCasualButton(this, 252, 32, 126, 44, 'Подарки 🎁', {
            topColor: 0x22c55e,
            bottomColor: 0x15803d,
            strokeColor: 0x86efac,
            fontSize: '13px',
            radius: 13,
            lip: 4,
        }, () => {
            this._openPlaytimeModal();
        });

        // Пульсирующий индикатор уведомления о готовой награде
        this._giftBadge = this.add.graphics();
        this._giftBadge.fillStyle(0xef4444, 1);
        this._giftBadge.fillCircle(252 + 50, 32 - 14, 6.5);
        this._giftBadge.lineStyle(1.8, 0xffffff, 1);
        this._giftBadge.strokeCircle(252 + 50, 32 - 14, 6.5);
        this._giftBadge.setVisible(false);
        this._giftBadge.setDepth(25);

        this.tweens.add({
            targets: this._giftBadge,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 3. Комбо-шкала множителя (шкала вверху, числа x1-x5 строго снизу под шкалой)
        this._buildComboBar(328, 12, 226, 17);

        // 4. Баланс изумрудов (справа, элегантная белая карточка со скругленными краями)
        const coinCard = this.add.graphics();
        drawCasualCard(coinCard, W - 180, 10, 168, 44, 13, 0xffffff, 0x10b981, 0.9);

        const gemIcon = this.add.image(W - 156, 32, 'icon_gem').setDisplaySize(22, 22);
        this.tweens.add({
            targets: gemIcon,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this._coinsText = createHDText(this, W - 22, 32, `${formatNumber(this.economy.coins)}`, {
            fontSize: '18px',
            color: '#0f172a',
            fontStyle: '900',
        }).setOrigin(1, 0.5);
    }

    _buildSettingsAndLevelWidget(x, y) {
        // Кнопка настроек с шестерёнкой (голубой тактильный скругленный куб)
        const gearSize = 44;
        const gearContainer = this.add.container(x + gearSize / 2, y + gearSize / 2);

        const gearShadow = this.add.graphics();
        gearShadow.fillStyle(0x1d4ed8, 1);
        gearShadow.fillRoundedRect(-gearSize / 2, -gearSize / 2 + 4, gearSize, gearSize, 12);
        gearContainer.add(gearShadow);

        const gearFace = this.add.container(0, 0);
        const gearG = this.add.graphics();
        gearG.fillStyle(0x3b82f6, 1);
        gearG.fillRoundedRect(-gearSize / 2, -gearSize / 2, gearSize, gearSize, 12);
        gearG.fillStyle(0xffffff, 0.25);
        gearG.fillRoundedRect(-gearSize / 2 + 2, -gearSize / 2 + 2, gearSize - 4, 16, { tl: 10, tr: 10, bl: 2, br: 2 });
        gearG.lineStyle(1.5, 0x93c5fd, 0.6);
        gearG.strokeRoundedRect(-gearSize / 2, -gearSize / 2, gearSize, gearSize, 12);
        gearFace.add(gearG);

        const gearIcon = this.add.image(0, 0, 'icon_gear').setDisplaySize(24, 24);
        gearFace.add(gearIcon);
        gearContainer.add(gearFace);

        const gearHit = this.add.rectangle(0, 2, gearSize, gearSize + 4, 0, 0)
            .setInteractive({ cursor: 'pointer' });
        gearContainer.add(gearHit);

        let gearDown = false;
        gearHit.on('pointerdown', () => {
            gearDown = true;
            gearFace.y = 3;
            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
        });
        const releaseGear = () => {
            if (!gearDown) return;
            gearDown = false;
            gearFace.y = 0;
        };
        gearHit.on('pointerup', () => {
            if (gearDown) {
                releaseGear();
                this._openSettingsModal();
            }
        });
        gearHit.on('pointerout', releaseGear);

        // Бейдж уровня (тактильная 3D-кнопка с золотым сиянием и звездой)
        const lvlX = x + gearSize + 6;
        const lvlW = 120;
        const lvlH = 44;

        const lvlContainer = this.add.container(lvlX + lvlW / 2, y + lvlH / 2);

        const lvlShadow = this.add.graphics();
        lvlShadow.fillStyle(0xb45309, 1);
        lvlShadow.fillRoundedRect(-lvlW / 2, -lvlH / 2 + 4, lvlW, lvlH, 12);
        lvlContainer.add(lvlShadow);

        const lvlFace = this.add.container(0, 0);
        const lvlG = this.add.graphics();
        lvlG.fillStyle(0xfef3c7, 1);
        lvlG.fillRoundedRect(-lvlW / 2, -lvlH / 2, lvlW, lvlH, 12);
        lvlG.fillStyle(0xffffff, 0.45);
        lvlG.fillRoundedRect(-lvlW / 2 + 3, -lvlH / 2 + 2, lvlW - 6, 17, { tl: 10, tr: 10, bl: 2, br: 2 });
        lvlG.lineStyle(1.8, 0xf59e0b, 0.95);
        lvlG.strokeRoundedRect(-lvlW / 2, -lvlH / 2, lvlW, lvlH, 12);
        lvlFace.add(lvlG);

        const starIcon = createHDText(this, -lvlW / 2 + 16, 0, '⭐', { fontSize: '15px' }).setOrigin(0.5);
        lvlFace.add(starIcon);

        this.levelWidgetTitle = createHDText(this, 8, 0, `Уровень ${this.economy.level}`, {
            fontSize: '14px',
            color: '#92400e',
            stroke: '#ffffff',
            strokeThickness: 2,
            fontStyle: '900',
        }).setOrigin(0.5);
        lvlFace.add(this.levelWidgetTitle);
        lvlContainer.add(lvlFace);

        const lvlHit = this.add.rectangle(0, 2, lvlW, lvlH + 4, 0, 0)
            .setInteractive({ cursor: 'pointer' });
        lvlContainer.add(lvlHit);

        let lvlDown = false;
        lvlHit.on('pointerdown', () => {
            lvlDown = true;
            lvlFace.y = 3;
            if (typeof SoundManager !== 'undefined') SoundManager.playPop();
        });
        const releaseLvl = () => {
            if (!lvlDown) return;
            lvlDown = false;
            lvlFace.y = 0;
        };
        lvlHit.on('pointerup', () => {
            if (lvlDown) {
                releaseLvl();
                spawnFloatingText(this, lvlX + lvlW / 2, y + lvlH + 20, `🌟 Уровень ${this.economy.level} (макс. сквиш)!`, '#ffd700');
            }
        });
        lvlHit.on('pointerout', releaseLvl);
    }

    _updateLevelWidget() {
        if (this.levelWidgetTitle) {
            this.levelWidgetTitle.setText(`Уровень ${this.economy.level}`);
        }
    }

    _buildComboBar(x, y, w, h) {
        this.comboX = x;
        this.comboY = y;
        this.comboW = w;
        this.comboH = h;

        // Фон шкалы комбо (глубокий казуальный желоб)
        this.comboBg = this.add.graphics();
        drawRoundRect(this.comboBg, x, y, w, h, 8, 0x0f172a, 0.95, 0x334155, 1.8);

        // Разделительные насечки
        const step = w / 5;
        this.comboTicks = this.add.graphics();
        this.comboTicks.lineStyle(1.5, 0x334155, 0.8);
        for (let i = 1; i < 5; i++) {
            this.comboTicks.lineBetween(x + step * i, y + 1, x + step * i, y + h - 1);
        }

        this.comboFill = this.add.graphics();
        this.multiplierTexts = [];
        const mults = [1, 2, 3, 4, 5];
        this._comboColors = ['#94a3b8', '#38bdf8', '#60a5fa', '#c084fc', '#f87171'];

        // Числа x1 x2 x3 x4 x5 расположены СНИЗУ под шкалой с четкой темной обводкой
        mults.forEach((m, idx) => {
            const tx = x + step * idx + step / 2;
            const txt = createHDText(this, tx, y + h + 11, `x${m}`, {
                fontSize: '12px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: this._comboColors[idx],
                fontStyle: '900',
                stroke: '#0f172a',
                strokeThickness: 2.5,
            }).setOrigin(0.5);
            this.multiplierTexts.push(txt);
        });

        this._redrawComboBar();
    }

    _redrawComboBar() {
        this.comboFill.clear();

        let mul = 1;
        if (this.comboGauge >= 80) mul = 5;
        else if (this.comboGauge >= 60) mul = 4;
        else if (this.comboGauge >= 40) mul = 3;
        else if (this.comboGauge >= 20) mul = 2;
        else mul = 1;

        this.currentMultiplier = mul;

        const tierColors = [0x22c55e, 0x06b6d4, 0x3b82f6, 0xa855f7, 0xef4444];
        const fillColor = tierColors[mul - 1] || 0x22c55e;

        const fillW = Math.floor((this.comboW - 4) * (this.comboGauge / 100));
        if (fillW > 0) {
            this.comboFill.fillStyle(fillColor, 1);
            this.comboFill.fillRoundedRect(this.comboX + 2, this.comboY + 2, fillW, this.comboH - 4, 4);

            // Верхний световой блик на заполненной части
            this.comboFill.fillStyle(0xffffff, 0.32);
            this.comboFill.fillRoundedRect(this.comboX + 2, this.comboY + 2, fillW, Math.max(2, (this.comboH - 4) * 0.45), { tl: 4, tr: 4, bl: 1, br: 1 });
        }

        const colors = this._comboColors || ['#94a3b8', '#38bdf8', '#60a5fa', '#c084fc', '#f87171'];
        this.multiplierTexts.forEach((txt, idx) => {
            if (idx + 1 === mul) {
                txt.setColor('#ffd700');
                txt.setFontSize('14px');
                txt.setStroke('#0f172a', 3.5);
            } else {
                txt.setColor(colors[idx]);
                txt.setFontSize('12px');
                txt.setStroke('#0f172a', 2.5);
            }
        });
    }

    // ============================================================
    // Кликер — логика нажатия по мобу
    // ============================================================

    _onMobClicked(mobItem) {
        const mob = getMobByLevel(mobItem.mobLevel);
        if (!mob) return;

        this.comboGauge = Math.min(100, this.comboGauge + CONFIG.COMBO_GAIN_PER_CLICK);
        this._redrawComboBar();

        const baseClick = mob.clickReward || getMobClickReward(mob.level);
        const reward = Math.max(1, Math.floor(baseClick * this.currentMultiplier));
        this.economy.addCoins(reward);

        const clickX = mobItem.container.x;
        const clickY = mobItem.container.y - 45;
        const mulBadge = this.currentMultiplier > 1 ? ` (x${this.currentMultiplier})` : '';
        spawnFloatingText(this, clickX, clickY, `+${formatNumber(reward)} 💎${mulBadge}`, '#5dff6e');
        this._spawnFlyingCoins(clickX, clickY, 2);
    }

    update(time, delta) {
        if (this.comboGauge > 0) {
            const decay = (CONFIG.COMBO_DECAY_PER_SEC * delta) / 1000;
            this.comboGauge = Math.max(0, this.comboGauge - decay);
            this._redrawComboBar();
        }

        // Плавное движение процедурных облаков
        if (this._clouds) {
            this._clouds.forEach(c => {
                c.g.x += c.speed * (delta / 16);
                if (c.g.x > CONFIG.WIDTH + 70) {
                    c.g.x = -70;
                }
            });
        }
    }

    // ============================================================
    // Левая панель заданий (до 3 заданий, счетчик до 5 мобов)
    // ============================================================

    _buildQuestPanel() {
        this._questUiGroup = [];
        this._validateQuests();
        this._renderQuests();
    }

    _scheduleNextQuest() {
        const nextDelay = Phaser.Math.Between(60000, 90000); // Появление новых заданий раз в минуту-полторы
        this.time.delayedCall(nextDelay, () => {
            if (this.quests.length < 3) {
                this._generateQuest();
                this._renderQuests();
                this._save();
            }
            this._scheduleNextQuest();
        });
    }

    _generateQuest() {
        if (this.quests.length >= 3) return;

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const buyLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);

        // "сделай так чтобы в заданиях были мобы только которых можно сделать то есть уровень моба в магазине +1 или больше"
        const minLvl = (buyLevel + 1 <= maxUnlocked) ? (buyLevel + 1) : maxUnlocked;
        const availableLevels = [];
        for (let lvl = minLvl; lvl <= maxUnlocked; lvl++) {
            availableLevels.push(lvl);
        }

        // Стараемся не дублировать уровни в активных заданиях
        const existingLevels = new Set(this.quests.map(q => q.mobLevel));
        let pool = availableLevels.filter(lvl => !existingLevels.has(lvl));
        if (pool.length === 0) pool = availableLevels;

        const mobLevel = Phaser.Utils.Array.GetRandom(pool);
        const mob = getMobByLevel(mobLevel);
        if (!mob) return;

        // "сделай вариативность таких заданий, но чтобы счетчик был до 5"
        let targetCount = 2;
        if (mobLevel === maxUnlocked) {
            targetCount = Phaser.Math.Between(2, 3);
        } else {
            targetCount = Phaser.Math.Between(2, 5);
        }

        const baseCost = getMobCost(mobLevel);
        const rewardCoins = Math.max(80, Math.floor(baseCost * 0.8 * targetCount));
        const rewardXP    = Math.max(25, mobLevel * 20 * targetCount);

        const newQuest = {
            id: Date.now() + Math.random(),
            mobLevel,
            targetCount,
            rewardCoins,
            rewardXP,
        };

        this.quests.push(newQuest);
    }

    _validateQuests() {
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const buyLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);

        let modified = false;
        // Если игрок ушел вперед и моб ниже уровня магазина, задание пропадает или заменяется
        this.quests = this.quests.filter(q => {
            if (q.mobLevel < buyLevel && maxUnlocked > q.mobLevel + CONFIG.BUY_LEVEL_OFFSET) {
                modified = true;
                return false;
            }
            return true;
        });

        // На старте гарантируем хотя бы 2 задания
        while (this.quests.length < 2) {
            this._generateQuest();
            modified = true;
        }

        if (modified) {
            this.state.quests = this.quests;
        }
    }

    _renderQuests() {
        if (this._questUiGroup) {
            this._questUiGroup.forEach(item => {
                if (item) {
                    if (this.tweens) {
                        this.tweens.killTweensOf(item);
                        if (item.buttonFace) this.tweens.killTweensOf(item.buttonFace);
                    }
                    if (item.destroy) item.destroy();
                }
            });
        }
        this._questUiGroup = [];

        const startX = 64;
        const startY = 122;
        const cardW  = 102;
        const cardH  = 98;
        const spacing = 108;

        this.quests.forEach((quest, idx) => {
            const mob = getMobByLevel(quest.mobLevel);
            if (!mob) return;

            const targetCount = quest.targetCount || quest.target || 2;
            quest.targetCount = targetCount;

            // Считаем мобов на поле прямо сейчас (если объединил — статус готовности сбрасывается)
            const rawCount = this.mergeField.mobs.filter(m => m.mobLevel === quest.mobLevel).length;
            const isReady = rawCount >= targetCount;
            quest.isCompleted = isReady;

            const displayCount = Math.min(rawCount, targetCount);

            const cx = startX;
            const cy = startY + idx * spacing;

            // 1. Sticker-style карточка с мягкой тенью и скруглением 14
            const bg = this.add.graphics();
            // Мягкая внешняя тень под стикером
            bg.fillStyle(0x000000, 0.15);
            bg.fillRoundedRect(cx - cardW / 2 + 1, cy - cardH / 2 + 3, cardW, cardH, 14);

            // Белая/пастельная основа стикера
            bg.fillStyle(isReady ? 0xf0fdf4 : 0xffffff, 0.98);
            bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);

            // Контур
            bg.lineStyle(isReady ? 2.5 : 1.5, isReady ? 0x22c55e : 0x94a3b8, 1);
            bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);

            // Верхняя декоративная клейкая лента / стикер-скотч
            bg.fillStyle(isReady ? 0xfbbf24 : 0x93c5fd, 0.95);
            bg.fillRoundedRect(cx - 14, cy - cardH / 2 - 3, 28, 6, 2);
            // Блик на скотче
            bg.fillStyle(0xffffff, 0.4);
            bg.fillRoundedRect(cx - 13, cy - cardH / 2 - 3, 26, 2, 1);
            this._questUiGroup.push(bg);

            // 2. Имя моба вверху карточки
            const nameText = createHDText(this, cx, cy - cardH / 2 + 14, mob.name, {
                fontSize: '11px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#1e293b',
                fontStyle: '900',
            }).setOrigin(0.5);

            // 3. Круглое блюдце (постамент) под portrait моба
            const platter = this.add.graphics();
            // Ободок блюдца
            platter.fillStyle(isReady ? 0xdcfce7 : 0xe2e8f0, 1);
            platter.fillCircle(cx, cy - 2, 25);
            // Внутреннее углубление блюдца
            platter.fillStyle(isReady ? 0xf0fdf4 : 0xffffff, 1);
            platter.fillCircle(cx, cy - 2, 22);
            // Нижняя теневая фаска в углублении
            platter.fillStyle(isReady ? 0xbbf7d0 : 0xf1f5f9, 0.8);
            platter.fillCircle(cx, cy, 18);
            platter.fillStyle(isReady ? 0xf0fdf4 : 0xffffff, 1);
            platter.fillCircle(cx, cy - 2, 18);
            this._questUiGroup.push(platter);

            // Portrait / аватар моба
            const mobTex = (mob.portraitKey && this.textures.exists(mob.portraitKey))
                ? mob.portraitKey
                : (mob.texture || (mob.level <= 10 ? `mob_0${mob.level}` : 'mob_placeholder'));
            const mobImg = this.add.image(cx, cy - 2, mobTex).setDisplaySize(42, 42);

            // 4. Нижнее состояние: мини-прогресс бар (2/4) или кнопка "ЗАБРАТЬ 🎁"
            let statusElements = [];
            if (isReady) {
                // Зелёная 3D кнопка "ЗАБРАТЬ 🎁" с деликатной pulse-анимацией
                const claimBtn = createCasualButton(this, cx, cy + cardH / 2 - 16, cardW - 14, 26, 'ЗАБРАТЬ 🎁', {
                    topColor: 0x22c55e,
                    bottomColor: 0x15803d,
                    strokeColor: 0x86efac,
                    fontSize: '11px',
                    radius: 8,
                    lip: 3,
                    pulse: true,
                    pulseScale: 1.03,
                    pulseDuration: 850
                }, () => {
                    this._claimQuest(idx, cx, cy);
                });
                statusElements.push(claimBtn);
            } else {
                // Мини progress bar через drawCasualProgressBar + прогресс вида 2/4
                const pBarG = this.add.graphics();
                const pBarW = cardW - 16;
                const pBarH = 16;
                const pBarX = cx - pBarW / 2;
                const pBarY = cy + cardH / 2 - 24;
                const progressRatio = targetCount > 0 ? (displayCount / targetCount) : 0;
                drawCasualProgressBar(pBarG, pBarX, pBarY, pBarW, pBarH, 5, progressRatio, 0x0f172a, 0xf59e0b, 0x334155);

                const pText = createHDText(this, cx, pBarY + pBarH / 2, `${displayCount} / ${targetCount}`, {
                    fontSize: '10px',
                    fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#ffffff',
                    fontStyle: '900',
                    stroke: '#0f172a',
                    strokeThickness: 2.5,
                }).setOrigin(0.5);

                statusElements.push(pBarG, pText);
            }

            // Интерактивная зона по всей карточке для удобного тача
            const hitArea = this.add.rectangle(cx, cy, cardW, cardH, 0, 0)
                .setInteractive({ cursor: isReady ? 'pointer' : 'default' });

            hitArea.on('pointerdown', () => {
                if (isReady) {
                    this._claimQuest(idx, cx, cy);
                } else {
                    spawnFloatingText(this, cx + 60, cy - 20, `Соберите ${targetCount}x ${mob.name}!`, '#ffd700');
                }
            });

            this._questUiGroup.push(nameText, mobImg, ...statusElements, hitArea);
        });
    }

    _claimQuest(idx, x, y) {
        const quest = this.quests[idx];
        if (!quest) return;

        // Начисляем монеты
        this.economy.addCoins(quest.rewardCoins);

        if (typeof SoundManager !== 'undefined') {
            SoundManager.playVictory();
        }
        this._spawnFlyingCoins(x, y, 4);
        spawnFloatingText(this, x, y - 20, `+💎 ${formatNumber(quest.rewardCoins)}`, '#5dff6e');

        // Удаляем выполненное задание
        this.quests.splice(idx, 1);
        this.state.quests = this.quests;

        // Если заданий осталось меньше 2, генерируем новое
        if (this.quests.length < 2) {
            this._generateQuest();
        }

        this._renderQuests();
        this._save();
    }

    _onFieldChanged() {
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const shopMobLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);

        // Уровень игрока теперь строго равен максимальному открытому уровню моба
        this.economy.setLevel(maxUnlocked);
        this._updateLevelWidget();

        // Очищаем устаревших мобов, которые больше не смогут объединиться
        if (this.mergeField && this.mergeField.cleanupUnmergeableOldMobs) {
            this.mergeField.cleanupUnmergeableOldMobs(shopMobLevel);
        }

        // Авто-улучшение моба в инкубаторе до уровня магазина при открытии новых мобов
        if (Array.isArray(this.state.incubatorSlots)) {
            this.state.incubatorSlots.forEach(slot => {
                if (slot.active) {
                    slot.mobLevel = shopMobLevel;
                }
            });
        }

        this._updateShopButton();
        this._validateQuests();
        this._renderQuests();
    }

    // ============================================================
    // Правая панель — Магазин покупки мобов
    // ============================================================

    _buildRightShop() {
        this._shopUiGroup = [];
        this._updateShopButton();
    }

    _updateShopButton() {
        if (this._shopUiGroup) {
            this._shopUiGroup.forEach(item => {
                if (item) {
                    if (this.tweens) {
                        this.tweens.killTweensOf(item);
                        if (item.buttonFace) this.tweens.killTweensOf(item.buttonFace);
                    }
                    if (item.destroy) item.destroy();
                }
            });
        }
        this._shopUiGroup = [];

        const W = CONFIG.WIDTH;
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);

        const cardX = W - 72;
        const cardW = 108;
        const cardH = 114;

        // 1. Слот 1: Моб за монеты (мягкая пастельная голубая карточка)
        const buyLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);
        const buyMob   = getMobByLevel(buyLevel);
        const cost     = getMobCost(buyLevel);

        const cardY1 = 130;

        const bg1 = this.add.graphics();
        // Мягкая внешняя тень под карточкой
        bg1.fillStyle(0x000000, 0.16);
        bg1.fillRoundedRect(cardX - cardW / 2 + 1, cardY1 - cardH / 2 + 3, cardW, cardH, 16);
        // Нежно-голубая основа карточки
        bg1.fillStyle(0xf0f9ff, 0.98);
        bg1.fillRoundedRect(cardX - cardW / 2, cardY1 - cardH / 2, cardW, cardH, 16);
        // Шелковистый контур
        bg1.lineStyle(2, 0x38bdf8, 1);
        bg1.strokeRoundedRect(cardX - cardW / 2, cardY1 - cardH / 2, cardW, cardH, 16);
        // Верхний декоративный ярлычок
        bg1.fillStyle(0x38bdf8, 0.9);
        bg1.fillRoundedRect(cardX - 22, cardY1 - cardH / 2 - 2, 44, 5, 2);

        this._shopUiGroup.push(bg1);

        // Круглое блюдце (постамент) под моба
        const platter1 = this.add.graphics();
        // Внешний ободок постамента
        platter1.fillStyle(0xbae6fd, 1);
        platter1.fillCircle(cardX, cardY1 - 11, 35);
        // Внутренняя белая тарелочка
        platter1.fillStyle(0xffffff, 1);
        platter1.fillCircle(cardX, cardY1 - 11, 32);
        // Мягкая нижняя теневая фаска
        platter1.fillStyle(0xe0f2fe, 0.7);
        platter1.fillCircle(cardX, cardY1 - 9, 26);
        platter1.fillStyle(0xffffff, 1);
        platter1.fillCircle(cardX, cardY1 - 11, 26);
        this._shopUiGroup.push(platter1);

        if (buyMob) {
            const buyTex = (buyMob.portraitKey && this.textures.exists(buyMob.portraitKey))
                ? buyMob.portraitKey
                : (buyMob.texture || 'mob_portrait_placeholder');
            const mobImg1 = this.add.image(cardX, cardY1 - 11, buyTex).setDisplaySize(58, 58);

            // Плавное парение моба над постаментом (idle hover)
            this.tweens.add({
                targets: mobImg1,
                y: cardY1 - 15,
                duration: 1400,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Тактильная 3D-кнопка покупки за изумруды
            const buyBtn = createCasualButton(this, cardX, cardY1 + cardH / 2 - 18, cardW - 14, 26, `💎 ${formatNumber(cost)}`, {
                topColor: 0xf59e0b,
                bottomColor: 0xb45309,
                strokeColor: 0xfef08a,
                fontSize: '12px',
                radius: 9,
                lip: 3,
            }, () => this._onBuyMob(buyMob, cost));

            // Интерактивная зона по всей карточке для удобного тапа
            const hitArea1 = this.add.rectangle(cardX, cardY1, cardW, cardH, 0, 0)
                .setInteractive({ cursor: 'pointer' });
            hitArea1.on('pointerdown', () => this._onBuyMob(buyMob, cost));

            this._shopUiGroup.push(mobImg1, buyBtn, hitArea1);
        }

        // 2. Слот 2: Моб за рекламу (мягкая пастельная сиреневая карточка)
        const adMobLevel = Math.max(1, maxUnlocked - CONFIG.AD_LEVEL_OFFSET);
        const adMob      = getMobByLevel(adMobLevel);

        const cardY2 = 258;

        const bg2 = this.add.graphics();
        // Мягкая внешняя тень под карточкой
        bg2.fillStyle(0x000000, 0.16);
        bg2.fillRoundedRect(cardX - cardW / 2 + 1, cardY2 - cardH / 2 + 3, cardW, cardH, 16);
        // Нежно-сиреневая основа карточки
        bg2.fillStyle(0xfaf5ff, 0.98);
        bg2.fillRoundedRect(cardX - cardW / 2, cardY2 - cardH / 2, cardW, cardH, 16);
        // Шелковистый контур
        bg2.lineStyle(2, 0xa855f7, 1);
        bg2.strokeRoundedRect(cardX - cardW / 2, cardY2 - cardH / 2, cardW, cardH, 16);
        // Верхний декоративный ярлычок
        bg2.fillStyle(0xa855f7, 0.9);
        bg2.fillRoundedRect(cardX - 22, cardY2 - cardH / 2 - 2, 44, 5, 2);

        this._shopUiGroup.push(bg2);

        // Круглое блюдце (постамент) под моба за рекламу
        const platter2 = this.add.graphics();
        // Внешний ободок постамента
        platter2.fillStyle(0xe9d5ff, 1);
        platter2.fillCircle(cardX, cardY2 - 11, 35);
        // Внутренняя белая тарелочка
        platter2.fillStyle(0xffffff, 1);
        platter2.fillCircle(cardX, cardY2 - 11, 32);
        // Мягкая нижняя теневая фаска
        platter2.fillStyle(0xf3e8ff, 0.7);
        platter2.fillCircle(cardX, cardY2 - 9, 26);
        platter2.fillStyle(0xffffff, 1);
        platter2.fillCircle(cardX, cardY2 - 11, 26);
        this._shopUiGroup.push(platter2);

        if (adMob) {
            const adTex = (adMob.portraitKey && this.textures.exists(adMob.portraitKey))
                ? adMob.portraitKey
                : (adMob.texture || 'mob_portrait_placeholder');
            const mobImg2 = this.add.image(cardX, cardY2 - 11, adTex).setDisplaySize(58, 58);

            // Плавное парение моба (idle hover) с небольшим сдвигом по фазе
            this.tweens.add({
                targets: mobImg2,
                y: cardY2 - 15,
                duration: 1550,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Тактильная 3D-кнопка просмотра рекламы
            const adBtn = createCasualButton(this, cardX, cardY2 + cardH / 2 - 18, cardW - 14, 26, '🎬 РЕКЛАМА', {
                topColor: 0x9333ea,
                bottomColor: 0x581c87,
                strokeColor: 0xd8b4fe,
                fontSize: '11px',
                radius: 9,
                lip: 3,
            }, () => this._onAdMob(adMob));

            // Интерактивная зона по всей карточке для удобного тапа
            const hitArea2 = this.add.rectangle(cardX, cardY2, cardW, cardH, 0, 0)
                .setInteractive({ cursor: 'pointer' });
            hitArea2.on('pointerdown', () => this._onAdMob(adMob));

            this._shopUiGroup.push(mobImg2, adBtn, hitArea2);
        }
    }

    _onBuyMob(mob, cost) {
        if (!this.economy.spendCoins(cost)) {
            spawnFloatingText(this, CONFIG.WIDTH - 80, 200, 'Мало изумрудов!', '#ff4444');
            return;
        }

        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `+${mob.name}`, '#5dff6e');
        }

        this._onFieldChanged();
    }

    _onAdMob(mob) {
        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `🎁 +${mob.name}!`, '#ffd700');
        }
        this._onFieldChanged();
    }

    // ============================================================
    // Нижняя панель (3D казуальные кнопки на газоне)
    // ============================================================

    _buildBottomBar() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // 1. Полупрозрачная стеклянная подложка дока
        const dockPlate = this.add.graphics();
        // Внешняя тень дока
        dockPlate.fillStyle(0x000000, 0.22);
        dockPlate.fillRoundedRect(10, H - 59, W - 20, 54, 18);
        // Темное полупрозрачное стекло
        dockPlate.fillStyle(0x0f172a, 0.72);
        dockPlate.fillRoundedRect(10, H - 61, W - 20, 54, 18);
        // Деликатный верхний световой блик на стекле
        dockPlate.fillStyle(0xffffff, 0.08);
        dockPlate.fillRoundedRect(12, H - 59, W - 24, 18, { tl: 16, tr: 16, bl: 2, br: 2 });
        // Тонкая шелковистая рамка
        dockPlate.lineStyle(1.5, 0x334155, 0.85);
        dockPlate.strokeRoundedRect(10, H - 61, W - 20, 54, 18);

        const btnY = H - 34;

        // 2. Кнопка "📖 Бестиарий" (Сапфирово-синяя 3D-кнопка)
        createCasualButton(this, 95, btnY, 145, 42, '📖 Бестиарий', {
            topColor: 0x2563eb,
            bottomColor: 0x1d4ed8,
            strokeColor: 0x60a5fa,
            fontSize: '13px',
            radius: 11,
            lip: 3,
        }, () => this.scene.launch('CollectionScene', { collection: [...this.mergeField.collection] }));

        // 3. Кнопка "🥚 Инкубатор" (Аметистово-фиолетовая 3D-кнопка)
        createCasualButton(this, 255, btnY, 145, 42, '🥚 Инкубатор', {
            topColor: 0x7c3aed,
            bottomColor: 0x5b21b6,
            strokeColor: 0xa78bfa,
            fontSize: '13px',
            radius: 11,
            lip: 3,
        }, () => this._openIncubatorModal());

        // Бейдж готовности инкубатора
        this._dockIncubatorBadge = this._createNotificationBadge(255 + 56, btnY - 14);

        // 4. Кнопка "🎁 Награды" (Бирюзово-изумрудная 3D-кнопка)
        createCasualButton(this, 415, btnY, 145, 42, '🎁 Награды', {
            topColor: 0x0d9488,
            bottomColor: 0x115e59,
            strokeColor: 0x2dd4bf,
            fontSize: '13px',
            radius: 11,
            lip: 3,
        }, () => this._openPlaytimeModal());

        // Бейдж готовых наград
        this._dockRewardBadge = this._createNotificationBadge(415 + 56, btnY - 14);

        // 5. Главная кнопка действия (Primary CTA) — "В БОЙ! ⚔️" (Сочная рубиновая 3D-кнопка)
        createCasualButton(this, W - 110, btnY, 185, 44, 'В бой! ⚔️', {
            topColor: 0xef4444,
            bottomColor: 0x991b1b,
            strokeColor: 0xfca5a5,
            fontSize: '17px',
            radius: 12,
            lip: 4,
            pulse: true,
            pulseScale: 1.035,
            pulseDuration: 800,
        }, () => {
            if (this.mergeField.mobs.length === 0) {
                spawnFloatingText(this, W - 110, H - 80, 'Купите бойцов!', '#ff4444');
                return;
            }
            this._openBattleModal();
        });
    }

    _createNotificationBadge(x, y) {
        const badge = this.add.container(x, y).setVisible(false).setDepth(30);
        const g = this.add.graphics();
        g.fillStyle(0xef4444, 1);
        g.fillCircle(0, 0, 7);
        g.lineStyle(1.8, 0xffffff, 1);
        g.strokeCircle(0, 0, 7);
        badge.add(g);

        this.tweens.add({
            targets: badge,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return badge;
    }

    // ============================================================
    // Таймер секунд (Онлайн-награды и Инкубатор)
    // ============================================================

    _onSecondTick() {
        this.state.playtime.totalSeconds++;

        // Проверяем, есть ли готовые награды за онлайн
        const tiers = this._getPlaytimeTiers();
        const hasUnclaimed = tiers.some((t, i) =>
            this.state.playtime.totalSeconds >= t.seconds && !this.state.playtime.claimed[i]
        );

        if (this._giftBadge) {
            this._giftBadge.setVisible(hasUnclaimed);
        }
        if (this._dockRewardBadge) {
            this._dockRewardBadge.setVisible(hasUnclaimed);
        }

        // Проверяем, готов ли инкубатор
        let hasReadyEgg = false;
        if (Array.isArray(this.state.incubatorSlots)) {
            hasReadyEgg = this.state.incubatorSlots.some(s => s.active && Date.now() >= s.endTime);
        }
        if (this._dockIncubatorBadge) {
            this._dockIncubatorBadge.setVisible(hasReadyEgg);
        }

        // Если окно наград открыто — обновляем таймеры
        if (this._playtimeModal && this._playtimeModal.visible) {
            this._renderPlaytimeCards();
        }

        // Если окно инкубатора открыто — обновляем слоты
        if (this._incubatorModal && this._incubatorModal.visible) {
            this._renderIncubatorSlots();
        }
    }

    // ============================================================
    // МЕНЮ НАГРАД ЗА ВРЕМЯ В ИГРЕ (Подарки)
    // ============================================================

    _getPlaytimeTiers() {
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const subMobLevel = Math.max(1, maxUnlocked - 1);
        const subMob      = getMobByLevel(subMobLevel);
        const topMob      = getMobByLevel(maxUnlocked);

        return [
            {
                seconds: 180, // 3 минуты
                timeLabel: '3 мин',
                desc: `2x ${subMob ? subMob.name : 'Моб'} (Lv.${subMobLevel})`,
                icon: subMob ? subMob.emoji : '🐔',
                claim: () => {
                    this.mergeField.spawnMob(subMobLevel);
                    this.mergeField.spawnMob(subMobLevel);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 4);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🎁 Получено 2x ${subMob.name}!`, '#5dff6e');
                }
            },
            {
                seconds: 600, // 10 минут
                timeLabel: '10 мин',
                coins: getMobCost(maxUnlocked) * 3,
                desc: `💎 Мешок изумрудов (${formatNumber(getMobCost(maxUnlocked) * 3)})`,
                icon: '💰',
                claim: (tier) => {
                    this.economy.addCoins(tier.coins);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 8);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `+💎 ${formatNumber(tier.coins)} изумрудов!`, '#5dff6e');
                }
            },
            {
                seconds: 1200, // 20 минут
                timeLabel: '20 мин',
                desc: `3x ${subMob ? subMob.name : 'Моб'} + 150 XP`,
                icon: subMob ? subMob.emoji : '🐔',
                claim: () => {
                    for (let i = 0; i < 3; i++) this.mergeField.spawnMob(subMobLevel);
                    this.economy.addXP(150);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 6);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🎁 3x ${subMob.name} + 150 XP!`, '#5dff6e');
                }
            },
            {
                seconds: 2400, // 40 минут
                timeLabel: '40 мин',
                coins: getMobCost(maxUnlocked) * 8,
                desc: `💎 Сундук (${formatNumber(getMobCost(maxUnlocked) * 8)})`,
                icon: '📦',
                claim: (tier) => {
                    this.economy.addCoins(tier.coins);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 8);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `+💎 ${formatNumber(tier.coins)} изумрудов!`, '#5dff6e');
                }
            },
            {
                seconds: 3600, // 1 час
                timeLabel: '1 час',
                desc: `2x ${topMob ? topMob.name : 'Топ'} + 300 XP`,
                icon: topMob ? topMob.emoji : '⭐',
                claim: () => {
                    this.mergeField.spawnMob(maxUnlocked);
                    this.mergeField.spawnMob(maxUnlocked);
                    this.economy.addXP(300);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 8);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `👑 2x ${topMob.name} + 300 XP!`, '#ffd700');
                }
            },
            {
                seconds: 7200, // 2 часа
                timeLabel: '2 часа',
                coins: getMobCost(maxUnlocked) * 20,
                desc: `💎 Клад (${formatNumber(getMobCost(maxUnlocked) * 20)})`,
                icon: '💎',
                claim: (tier) => {
                    this.economy.addCoins(tier.coins);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 10);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `+💎 ${formatNumber(tier.coins)} изумрудов!`, '#5dff6e');
                }
            },
            {
                seconds: 14400, // 4 часа
                timeLabel: '4 часа',
                desc: `3x ${topMob ? topMob.name : 'Топ'} (Lv.${maxUnlocked})`,
                icon: topMob ? topMob.emoji : '👑',
                claim: () => {
                    for (let i = 0; i < 3; i++) this.mergeField.spawnMob(maxUnlocked);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 10);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `👑 3x ${topMob.name} получено!`, '#ffd700');
                }
            },
            {
                seconds: 28800, // 8 часов
                timeLabel: '8 часов',
                coins: getMobCost(maxUnlocked) * 50,
                desc: `👑 Супер-клад + 1x ${topMob ? topMob.name : 'Топ'}!`,
                icon: '👑',
                claim: (tier) => {
                    this.mergeField.spawnMob(maxUnlocked);
                    this.economy.addCoins(tier.coins);
                    this._spawnFlyingCoins(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 12);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `👑 КОРОЛЕВСКИЙ КЛАД ПОЛУЧЕН!`, '#ffd700');
                }
            },
        ];
    }

    _buildPlaytimeModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._playtimeModal = this.add.container(W / 2, H / 2).setDepth(1000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -315, -210, 630, 420, 18, 0x16213e, 0.98, 0xffd700, 3);

        const title = this.add.text(0, -175, '🎁 НАГРАДЫ ЗА ВРЕМЯ В ИГРЕ', {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._playtimeTimeHeader = this.add.text(0, -145, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#5dff6e', fontStyle: 'bold'
        }).setOrigin(0.5);

        this._playtimeListContainer = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 178, 170, 40, 'ЗАКРЫТЬ', '#747d8c', () => {
            this._playtimeModal.setVisible(false);
        }, '14px');

        this._playtimeModal.add([overlay, bg, title, this._playtimeTimeHeader, this._playtimeListContainer, ...closeBtn]);
    }

    _openPlaytimeModal() {
        this._renderPlaytimeCards();
        this._playtimeModal.setScale(0.7);
        this._playtimeModal.setVisible(true);
        this.tweens.add({ targets: this._playtimeModal, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out' });
    }

    _renderPlaytimeCards() {
        this._playtimeListContainer.removeAll(true);

        const curSeconds = this.state.playtime.totalSeconds;
        const h = Math.floor(curSeconds / 3600);
        const m = Math.floor((curSeconds % 3600) / 60);
        const s = curSeconds % 60;
        const pad = (n) => String(n).padStart(2, '0');

        this._playtimeTimeHeader.setText(`Текущее время в игре: ${pad(h)}:${pad(m)}:${pad(s)}`);

        const tiers = this._getPlaytimeTiers();
        const cardW = 285;
        const cardH = 54;
        const colLeftX = -150;
        const colRightX = 150;
        const rowYs = [-105, -45, 15, 75];

        tiers.forEach((tier, idx) => {
            const isRightCol = idx >= 4;
            const rowIdx = idx % 4;
            const cx = isRightCol ? colRightX : colLeftX;
            const cy = rowYs[rowIdx];

            const isClaimed = !!this.state.playtime.claimed[idx];
            const isReady   = curSeconds >= tier.seconds && !isClaimed;

            const bg = this.add.graphics();
            drawRoundRect(bg, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8,
                isReady ? 0x1b4332 : (isClaimed ? 0x222a35 : 0x192236), 0.92,
                isReady ? 0x5dff6e : 0x4a5568, 1.5);

            const icon = this.add.text(cx - cardW / 2 + 20, cy, tier.icon, { fontSize: '24px' }).setOrigin(0.5);

            const timeTxt = this.add.text(cx - cardW / 2 + 40, cy - 14, tier.timeLabel, {
                fontSize: '11px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
            });

            const descTxt = this.add.text(cx - cardW / 2 + 40, cy + 3, tier.desc, {
                fontSize: '10px', fontFamily: 'monospace', color: '#dddddd', wordWrap: { width: 145 }
            });

            this._playtimeListContainer.add([bg, icon, timeTxt, descTxt]);

            if (isClaimed) {
                const claimBadge = this.add.text(cx + cardW / 2 - 45, cy, 'Взято ✅', {
                    fontSize: '11px', fontFamily: 'monospace', color: '#8892b0', fontStyle: 'bold'
                }).setOrigin(0.5);
                this._playtimeListContainer.add(claimBadge);
            } else if (isReady) {
                const [cBg, cTxt, cHit] = this._makeButton(cx + cardW / 2 - 45, cy, 76, 28, 'ВЗЯТЬ 🎁', '#2ed573', () => {
                    this.state.playtime.claimed[idx] = true;
                    tier.claim(tier);
                    this._renderPlaytimeCards();
                    this._onFieldChanged();
                    this._save();
                }, '10px');
                this._playtimeListContainer.add([cBg, cTxt, cHit]);
            } else {
                const left = tier.seconds - curSeconds;
                const lm = Math.floor(left / 60);
                const ls = left % 60;
                const timerTxt = this.add.text(cx + cardW / 2 - 45, cy, `⏱ ${pad(lm)}:${pad(ls)}`, {
                    fontSize: '11px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
                }).setOrigin(0.5);
                this._playtimeListContainer.add(timerTxt);
            }
        });
    }

    // ============================================================
    // ИНКУБАТОР (Открывается на 5, 10, 15 уровне)
    // Мета-механика: выбор моба, 10 мин таймер, ускорение рекламой,
    // Шансы: 80% x2, 15% x3, 5% МУТАНТ!
    // ============================================================

    _buildIncubatorModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._incubatorModal = this.add.container(W / 2, H / 2).setDepth(1000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setInteractive();
        const bg = this.add.graphics();
        // Светлая кремовая карточка модалки
        drawRoundRect(bg, -315, -215, 630, 430, 20, 0xfffdf0, 0.98, 0x8e44ad, 3);

        const title = this.add.text(0, -182, '🥚 ИНКУБАТОР МОБОВ', {
            fontSize: '22px', fontFamily: 'monospace', color: '#2c3e50',
            stroke: '#ffffff', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._incubatorSubtitle = this.add.text(0, -156, 'Мобы в инкубаторе = уровень моба в магазине!', {
            fontSize: '12px', fontFamily: 'monospace', color: '#6c5ce7', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Красный круглый крестик закрытия в правом верхнем углу (как на скриншоте 4)
        const closeBtnBg = this.add.graphics();
        closeBtnBg.fillStyle(0xff4757, 1);
        closeBtnBg.fillCircle(285, -185, 16);
        closeBtnBg.lineStyle(2, 0xffffff, 1);
        closeBtnBg.strokeCircle(285, -185, 16);

        const closeBtnTxt = this.add.text(285, -185, '✕', {
            fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const closeBtnHit = this.add.circle(285, -185, 18, 0x000000, 0).setInteractive({ cursor: 'pointer' });
        closeBtnHit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            this._incubatorModal.setVisible(false);
        });

        this._incubatorSlotsContainer = this.add.container(0, 0);

        const bottomCloseBtn = this._makeButton(0, 185, 170, 40, 'ЗАКРЫТЬ', '#747d8c', () => {
            this._incubatorModal.setVisible(false);
        }, '14px');

        this._incubatorModal.add([overlay, bg, title, this._incubatorSubtitle, closeBtnBg, closeBtnTxt, closeBtnHit, this._incubatorSlotsContainer, ...bottomCloseBtn]);
    }

    _openIncubatorModal() {
        this._renderIncubatorSlots();
        this._incubatorModal.setScale(0.7);
        this._incubatorModal.setVisible(true);
        this.tweens.add({ targets: this._incubatorModal, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out' });
    }

    _renderIncubatorSlots() {
        this._incubatorSlotsContainer.removeAll(true);

        const slotW = 185;
        const slotH = 280;
        const startX = -195;
        const y = 8;

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const shopMobLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);
        const shopMob = getMobByLevel(shopMobLevel) || getMobByLevel(1);

        if (this._incubatorSubtitle) {
            this._incubatorSubtitle.setText(`Высиживание: ${shopMob.name} (Lv.${shopMobLevel})`);
        }

        const tierConfigs = [
            { minutes: 10,  count: 3,  labelTime: '10 мин',  labelCount: '3 моба (x3)' },
            { minutes: 30,  count: 6,  labelTime: '30 мин',  labelCount: '6 мобов (x6)' },
            { minutes: 120, count: 12, labelTime: '2 часа',   labelCount: '12 мобов (x12)' },
            { minutes: 240, count: 18, labelTime: '4 часа',   labelCount: '18 мобов (x18)' },
            { minutes: 480, count: 25, labelTime: '8 часов',  labelCount: '25 мобов (x25)' },
        ];

        this.state.incubatorSlots.forEach((slot, idx) => {
            const x = startX + idx * 195;
            const isUnlocked = this.economy.level >= slot.unlockLevel;

            if (slot.selectedTierIndex === undefined) {
                slot.selectedTierIndex = Math.min(idx, tierConfigs.length - 1);
            }
            const currentTierIdx = slot.selectedTierIndex % tierConfigs.length;
            const currentTier = tierConfigs[currentTierIdx];

            // Авто-синхронизация моба до уровня магазина!
            if (slot.active) {
                slot.mobLevel = shopMobLevel;
            }

            const bg = this.add.graphics();
            drawRoundRect(bg, x - slotW / 2, y - slotH / 2, slotW, slotH, 14,
                isUnlocked ? (slot.active ? 0xf6fcf8 : 0xfbf9ff) : 0xf1f2f6, 0.98,
                isUnlocked ? (slot.active ? 0x2ed573 : 0x8e44ad) : 0xc8d6e5,
                isUnlocked ? (slot.active ? 2.5 : 2) : 1.5);

            const slotTitle = createHDText(this, x, y - slotH / 2 + 16, `СЛОТ ${idx + 1} (${slot.unlockLevel} УР)`, {
                fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: isUnlocked ? '#2c3e50' : '#8395a7', fontStyle: 'bold'
            }).setOrigin(0.5);

            this._incubatorSlotsContainer.add([bg, slotTitle]);

            if (!isUnlocked) {
                // Заблокированный слот
                const lockIcon = createHDText(this, x, y - 20, '🔒', { fontSize: '42px' }).setOrigin(0.5);
                const lockText = createHDText(this, x, y + 36, `Откроется\nна ${slot.unlockLevel} уровне!`, {
                    fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#576574', align: 'center', fontStyle: 'bold'
                }).setOrigin(0.5);

                this._incubatorSlotsContainer.add([lockIcon, lockText]);
            } else {
                if (slot.active) {
                    // ИДЁТ ИНКУБАЦИЯ
                    const now = Date.now();
                    const isReady = now >= slot.endTime;

                    const eggEmoji = this.add.image(x, y - 55, 'icon_egg').setDisplaySize(54, 54);
                    this.tweens.add({
                        targets: eggEmoji,
                        angle: isReady ? 12 : 5,
                        duration: isReady ? 120 : 350,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.InOut'
                    });

                    const mobInfo = getMobByLevel(slot.mobLevel) || shopMob;
                    const mobCount = slot.mobCount || currentTier.count;
                    const durLabel = slot.durationMinutes >= 60 ? `${slot.durationMinutes / 60} ч` : `${slot.durationMinutes} мин`;

                    const batchInfo = createHDText(this, x, y - 2, `${mobInfo.name}\n(Lv.${mobInfo.level})`, {
                        fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#2d3436', align: 'center', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const countInfo = createHDText(this, x, y + 26, `Пачка: ${mobCount} шт. (${durLabel})`, {
                        fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#e67e22', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    this._incubatorSlotsContainer.add([eggEmoji, batchInfo, countInfo]);

                    if (isReady) {
                        const [cBg, cTxt, cHit] = this._makeButton(x, y + 84, 155, 38, '🐣 ЗАБРАТЬ!', '#2ed573', () => {
                            for (let i = 0; i < mobCount; i++) {
                                // 5% шанс на мутанта
                                if (i === 0 && Math.random() * 100 < 5) {
                                    const mutantLevel = Math.min(CONFIG.MOB_LEVELS, slot.mobLevel + 1);
                                    this.mergeField.spawnMob(mutantLevel);
                                    const mutantMob = getMobByLevel(mutantLevel);
                                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `⚡ МУТАНТ! ${mutantMob.name}! ⭐`, '#ff3838', 24);
                                } else {
                                    this.mergeField.spawnMob(slot.mobLevel);
                                }
                            }
                            if (typeof SoundManager !== 'undefined') SoundManager.playVictory();
                            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🥚 Вылупилось ${mobCount}x ${mobInfo.name}!`, '#2ed573', 22);

                            slot.active = false;
                            this._renderIncubatorSlots();
                            this._onFieldChanged();
                            this._save();
                        }, '12px');

                        this._incubatorSlotsContainer.add([cBg, cTxt, cHit]);
                    } else {
                        const leftSec = Math.ceil((slot.endTime - now) / 1000);
                        const pad = (n) => String(n).padStart(2, '0');
                        const lh = Math.floor(leftSec / 3600);
                        const lm = Math.floor((leftSec % 3600) / 60);
                        const ls = leftSec % 60;
                        const timeStr = lh > 0 ? `${lh}:${pad(lm)}:${pad(ls)}` : `${pad(lm)}:${pad(ls)}`;

                        const timerTxt = createHDText(this, x, y + 46, `⏱ ${timeStr}`, {
                            fontSize: '15px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#d35400', fontStyle: 'bold'
                        }).setOrigin(0.5);

                        // Кнопка ускорения рекламой
                        const [adBg, adTxt, adHit] = this._makeButton(x, y + 84, 155, 34, '⚡ Ускорить рекламой', '#e67e22', () => {
                            slot.endTime = Date.now();
                            if (typeof SoundManager !== 'undefined') SoundManager.playVictory();
                            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, '⚡ Инкубация завершена!', '#ffd700');
                            this._renderIncubatorSlots();
                            this._save();
                        }, '10px');

                        this._incubatorSlotsContainer.add([timerTxt, adBg, adTxt, adHit]);
                    }
                } else {
                    // СЛОТ СВОБОДЕН — ВЫБОР ДЛИТЕЛЬНОСТИ И ПАЧКИ МОБОВ
                    const shopTex = shopMob.texture || (shopMob.level <= 10 ? `mob_0${shopMob.level}` : 'mob_placeholder');
                    const mobEmoji = this.add.image(x, y - 52, shopTex).setDisplaySize(44, 44);

                    const mobName = createHDText(this, x, y - 18, `${shopMob.name} (Lv.${shopMob.level})`, {
                        fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#2d3436', align: 'center', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const selTitle = createHDText(this, x, y + 3, 'Время инкубации:', {
                        fontSize: '10px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#7f8c8d', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    // Плашка переключателя времени и количества
                    const selBox = this.add.graphics();
                    drawRoundRect(selBox, x - 72, y + 15, 144, 38, 8, 0xede7f6, 0.95, 0xd1c4e9, 1.5);

                    const leftArrow = createHDText(this, x - 56, y + 34, '◀', {
                        fontSize: '18px', color: '#8e44ad', fontStyle: 'bold'
                    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

                    leftArrow.on('pointerdown', () => {
                        slot.selectedTierIndex = (currentTierIdx - 1 + tierConfigs.length) % tierConfigs.length;
                        if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                        this._renderIncubatorSlots();
                    });

                    const rightArrow = createHDText(this, x + 56, y + 34, '▶', {
                        fontSize: '18px', color: '#8e44ad', fontStyle: 'bold'
                    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

                    rightArrow.on('pointerdown', () => {
                        slot.selectedTierIndex = (currentTierIdx + 1) % tierConfigs.length;
                        if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                        this._renderIncubatorSlots();
                    });

                    const timeInfo = createHDText(this, x, y + 26, `⏱ ${currentTier.labelTime}`, {
                        fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#2c3e50', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const countInfo = createHDText(this, x, y + 42, `${currentTier.labelCount}`, {
                        fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#27ae60', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const [startBg, startTxt, startHit] = this._makeButton(x, y + 84, 155, 36, '🥚 В ИНКУБАТОР', '#8e44ad', () => {
                        slot.active = true;
                        slot.endTime = Date.now() + currentTier.minutes * 60 * 1000;
                        slot.durationMinutes = currentTier.minutes;
                        slot.mobCount = currentTier.count;
                        slot.mobLevel = shopMobLevel;
                        if (typeof SoundManager !== 'undefined') SoundManager.playPop();
                        this._renderIncubatorSlots();
                        this._save();
                        spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🥚 ${currentTier.count}x ${shopMob.name} (${currentTier.labelTime}) готовятся!`, '#8e44ad');
                    }, '12px');

                    this._incubatorSlotsContainer.add([
                        mobEmoji, mobName, selTitle, selBox,
                        leftArrow, rightArrow, timeInfo, countInfo,
                        startBg, startTxt, startHit
                    ]);
                }
            }
        });
    }

    // ============================================================
    // Дофаминовое окно открытия нового моба ("Dopamine Moment")
    // Вращающиеся лучи, гигантский моб, прирост урона к предыдущему, силуэт ???
    // ============================================================

    _buildNewMobModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._newMobModal = this.add.container(W / 2, H / 2).setDepth(1000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.78).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -280, -210, 560, 420, 22, 0x16213e, 0.98, 0xffd700, 3.5);

        // Вращающиеся лучи сияния за мобом
        this._newMobRays = this.add.graphics();
        this._newMobRays.y = -40;
        const numRays = 16;
        for (let i = 0; i < numRays; i++) {
            const startAngle = (i / numRays) * Math.PI * 2;
            const endAngle = ((i + 0.5) / numRays) * Math.PI * 2;
            this._newMobRays.fillStyle(0xffd700, 0.12);
            this._newMobRays.beginPath();
            this._newMobRays.moveTo(0, 0);
            this._newMobRays.arc(0, 0, 220, startAngle, endAngle);
            this._newMobRays.closePath();
            this._newMobRays.fillPath();
        }

        this.tweens.add({
            targets: this._newMobRays,
            angle: 360,
            duration: 9000,
            repeat: -1
        });

        const title = this.add.text(0, -170, '✨ НОВЫЙ СКВИШ! ✨', {
            fontSize: '30px',
            fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700',
            stroke: '#111625',
            strokeThickness: 5,
            fontStyle: '900',
        }).setOrigin(0.5);

        this._newMobModalContent = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 168, 220, 46, 'КРУТО! 👍', '#22c55e', () => {
            this._newMobModal.setVisible(false);
        }, '16px');

        this._newMobModal.add([overlay, bg, this._newMobRays, title, this._newMobModalContent, ...closeBtn]);
    }

    _showNewMobUnlockModal(newMob) {
        this._newMobModalContent.removeAll(true);

        const prevMob = getMobByLevel(newMob.level - 1);
        const nextMob = getMobByLevel(newMob.level + 1);

        this.tweens.killTweensOf(this._newMobModal);
        this._newMobModal.setDepth(1000);
        this._newMobModal.setScale(0.7);
        this._newMobModal.setVisible(true);

        this.tweens.add({
            targets: this._newMobModal,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 200,
            ease: 'Back.Out'
        });

        const revealNewMob = () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playNewMobFanfare();
            }
            this.cameras.main.shake(180, 0.008);

            // Огромный HD аватар моба посередине с пульсацией
            const newMobTex = newMob.texture || (newMob.level <= 10 ? `mob_0${newMob.level}` : 'mob_placeholder');
            const centerImg = this.add.image(0, -50, newMobTex).setDisplaySize(120, 120);
            const baseScale = centerImg.scaleX;
            centerImg.setScale(baseScale * 0.1);

            this.tweens.add({
                targets: centerImg,
                scaleX: baseScale * 1.2,
                scaleY: baseScale * 1.2,
                duration: 250,
                ease: 'Back.Out',
                onComplete: () => {
                    this.tweens.add({
                        targets: centerImg,
                        scaleX: baseScale * 1.05,
                        scaleY: baseScale * 1.05,
                        duration: 500,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.InOut'
                    });
                }
            });

            // Разлетающиеся частицы искр
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                const dist = randInt(70, 140);
                const spark = this.add.text(0, -50, Math.random() > 0.5 ? '✨' : '⭐', {
                    fontSize: `${randInt(14, 22)}px`
                }).setOrigin(0.5);

                this._newMobModalContent.add(spark);

                this.tweens.add({
                    targets: spark,
                    x: Math.cos(angle) * dist,
                    y: -50 + Math.sin(angle) * dist,
                    alpha: 0,
                    scaleX: 0.3,
                    scaleY: 0.3,
                    duration: 650,
                    ease: 'Cubic.Out',
                    onComplete: () => spark.destroy()
                });
            }

            // Название моба
            const nameText = createHDText(this, 0, 14, newMob.name.toUpperCase(), {
                fontSize: '24px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#ffffff',
                stroke: '#111625',
                strokeThickness: 4,
                fontStyle: '900'
            }).setOrigin(0.5).setAlpha(0);

            // Уровень и АТК
            const statsText = createHDText(this, 0, 44, `LV.${newMob.level}   ⚔ ${formatNumber(newMob.atk)}`, {
                fontSize: '17px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#5dff6e',
                stroke: '#111625',
                strokeThickness: 3,
                fontStyle: '800'
            }).setOrigin(0.5).setAlpha(0);

            // Прирост урона к предыдущему (+X%)
            let diffPct = 120;
            if (prevMob && prevMob.atk > 0) {
                diffPct = Math.round(((newMob.atk - prevMob.atk) / prevMob.atk) * 100);
            }
            const bumpText = createHDText(this, 0, 70, `+${diffPct}% к предыдущему! 🔥`, {
                fontSize: '14px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#ff9f43',
                stroke: '#111625',
                strokeThickness: 3,
                fontStyle: '800'
            }).setOrigin(0.5).setAlpha(0);

            // Следующий моб: стрелка и ??? с силуэтом
            const nextBg = this.add.graphics();
            drawRoundRect(nextBg, -150, 94, 300, 42, 12, 0x111625, 0.95, 0xf59e0b, 1.8);
            nextBg.setAlpha(0);

            const nextTxt = createHDText(this, 0, 115, `➔ Следующий: ??? 🔒 (Lv.${newMob.level + 1})`, {
                fontSize: '13px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#ffd700',
                fontStyle: '800'
            }).setOrigin(0.5).setAlpha(0);

            this._newMobModalContent.add([
                centerImg, nameText, statsText, bumpText, nextBg, nextTxt
            ]);

            this.tweens.add({
                targets: [nameText, statsText, bumpText, nextBg, nextTxt],
                alpha: 1,
                duration: 250,
                ease: 'Linear'
            });
        };

        if (prevMob) {
            // Мини-анимация слияния: два моба слетаются из сторон в центр
            const prevMobTex = prevMob.texture || (prevMob.level <= 10 ? `mob_0${prevMob.level}` : 'mob_placeholder');
            const leftMob = this.add.image(-150, -50, prevMobTex).setDisplaySize(70, 70);
            const rightMob = this.add.image(150, -50, prevMobTex).setDisplaySize(70, 70);
            const mergeLabel = createHDText(this, 0, -115, 'СЛИЯНИЕ... ⚡', {
                fontSize: '18px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#ffd700',
                stroke: '#111625',
                strokeThickness: 3,
                fontStyle: '900'
            }).setOrigin(0.5);

            this._newMobModalContent.add([leftMob, rightMob, mergeLabel]);

            if (typeof SoundManager !== 'undefined') {
                SoundManager.playMerge();
            }

            this.tweens.add({
                targets: leftMob,
                x: 0,
                duration: 340,
                ease: 'Cubic.In'
            });

            this.tweens.add({
                targets: rightMob,
                x: 0,
                duration: 340,
                ease: 'Cubic.In',
                onComplete: () => {
                    leftMob.destroy();
                    rightMob.destroy();
                    mergeLabel.destroy();

                    // Вспышка / хлопок
                    const flash = this.add.graphics();
                    flash.fillStyle(0xffffff, 1);
                    flash.fillCircle(0, -50, 45);
                    this._newMobModalContent.add(flash);

                    this.tweens.add({
                        targets: flash,
                        scaleX: 2.2,
                        scaleY: 2.2,
                        alpha: 0,
                        duration: 280,
                        onComplete: () => flash.destroy()
                    });

                    revealNewMob();
                }
            });
        } else {
            revealNewMob();
        }
    }

    // ============================================================
    // Модальные окна боев
    // ============================================================

    _buildBattleModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._battleModal = this.add.container(W / 2, H / 2).setDepth(1000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x090d16, 0.70).setInteractive();

        const cardW = 460;
        const cardH = 260;

        // Внешняя тень
        const shadowG = this.add.graphics();
        shadowG.fillStyle(0x000000, 0.35);
        shadowG.fillRoundedRect(-cardW / 2 + 2, -cardH / 2 + 5, cardW, cardH, 20);

        // Карточка модалки (мягкий светлый казуальный стиль с золотистой рамкой)
        const bg = this.add.graphics();
        bg.fillStyle(0xfffdfa, 0.99);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
        bg.lineStyle(2.5, 0xf59e0b, 1);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);

        // Верхняя декоративная 3D лента-заголовок
        const headerW = 240;
        const headerH = 42;
        const headerG = this.add.graphics();
        headerG.fillStyle(0xef4444, 1);
        headerG.fillRoundedRect(-headerW / 2, -cardH / 2 - headerH / 2 + 4, headerW, headerH, 12);
        headerG.fillStyle(0xffffff, 0.26);
        headerG.fillRoundedRect(-headerW / 2 + 3, -cardH / 2 - headerH / 2 + 6, headerW - 6, 15, { tl: 9, tr: 9, bl: 2, br: 2 });
        headerG.lineStyle(2, 0xfca5a5, 1);
        headerG.strokeRoundedRect(-headerW / 2, -cardH / 2 - headerH / 2 + 4, headerW, headerH, 12);

        const title = createHDText(this, 0, -cardH / 2 + 6, '⚔️ ВЫЗОВ НА БОЙ! ⚔️', {
            fontSize: '17px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0.5);

        const sub = createHDText(this, 0, -cardH / 2 + 48, 'Вы бросаете вызов сопернику:', {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#64748b', fontStyle: '800',
        }).setOrigin(0.5);

        // Плашка соперника
        const namePill = this.add.graphics();
        const pillW = 260;
        const pillH = 46;
        const pillY = -cardH / 2 + 88;
        drawRoundRect(namePill, -pillW / 2, pillY - pillH / 2, pillW, pillH, 23, 0x0f172a, 0.94, 0xf59e0b, 1.5);

        this._battleModalName = createHDText(this, 0, pillY, '', {
            fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#0f172a', strokeThickness: 2.5, fontStyle: '900',
        }).setOrigin(0.5);

        const hint = createHDText(this, 0, -cardH / 2 + 130, 'Сразитесь за кристаллы и ценные сокровища арены!', {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#475569', fontStyle: '800',
        }).setOrigin(0.5);

        // Кнопки действий:
        // Вторичная (Убежать)
        const runBtn = createCasualButton(this, -95, cardH / 2 - 42, 135, 40, 'Убежать', {
            topColor: 0x64748b, bottomColor: 0x334155, strokeColor: 0x94a3b8,
            fontSize: '14px', textColor: '#ffffff',
        }, () => {
            this._battleModal.setVisible(false);
        });

        // Главная CTA (В бой! ⚔)
        const fightBtn = createCasualButton(this, 95, cardH / 2 - 42, 165, 44, 'В бой! ⚔', {
            topColor: 0xef4444, bottomColor: 0x991b1b, strokeColor: 0xfca5a5,
            fontSize: '16px', textColor: '#ffffff', pulse: true,
        }, () => {
            this._battleModal.setVisible(false);
            this._openFighterSelect();
        });

        this._battleModal.add([overlay, shadowG, bg, headerG, title, sub, namePill, this._battleModalName, hint, runBtn, fightBtn]);
    }

    _openBattleModal() {
        this._currentBotName = getRandomBotName();
        const maxLevel = Math.max(...this.mergeField.collection, 1);
        this._currentBotTeam = generateBotTeam(maxLevel);
        this._battleModalName.setText(this._currentBotName);
        this._battleModal.setVisible(true);
    }

    _buildFighterSelectModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._fighterModal = this.add.container(W / 2, H / 2).setDepth(1000).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x090d16, 0.70).setInteractive();

        const modalW = 770;
        const modalH = 430;

        // Внешняя тень
        const shadowG = this.add.graphics();
        shadowG.fillStyle(0x000000, 0.40);
        shadowG.fillRoundedRect(-modalW / 2 + 2, -modalH / 2 + 6, modalW, modalH, 20);

        // Светлая премиальная основа карточки
        const bg = this.add.graphics();
        bg.fillStyle(0xfffdfa, 0.99);
        bg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20);
        bg.lineStyle(2.5, 0x3b82f6, 1);
        bg.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20);

        // Верхняя плашка шапки
        bg.fillStyle(0x0f172a, 0.94);
        bg.fillRoundedRect(-modalW / 2 + 3, -modalH / 2 + 3, modalW - 6, 56, { tl: 17, tr: 17, bl: 0, br: 0 });

        const title = createHDText(this, 0, -modalH / 2 + 22, '🛡️ ВЫБОР ОТРЯДА В БОЙ', {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0.5);

        // Капсула счетчика бойцов
        const countPill = this.add.graphics();
        drawRoundRect(countPill, -70, -modalH / 2 + 37, 140, 18, 9, 0x166534, 0.9, 0x22c55e, 1.2);

        this._fighterCountText = createHDText(this, 0, -modalH / 2 + 46, 'Выбрано: 0 / 3', {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5);

        this._fighterCards = [];
        this._selectedFighters = new Set();
        this._fighterGridContainer = this.add.container(0, 0);

        const runBtn = createCasualButton(this, -110, 178, 150, 40, 'Убежать', {
            topColor: 0x64748b, bottomColor: 0x334155, strokeColor: 0x94a3b8,
            fontSize: '14px', textColor: '#ffffff',
        }, () => {
            this._fighterModal.setVisible(false);
        });

        const startBtn = createCasualButton(this, 110, 178, 190, 42, 'Начать бой ⚔', {
            topColor: 0x22c55e, bottomColor: 0x15803d, strokeColor: 0x86efac,
            fontSize: '15px', pulse: true, textColor: '#ffffff',
        }, () => {
            this._startBattle();
        });

        this._fighterModal.add([overlay, shadowG, bg, title, countPill, this._fighterCountText, this._fighterGridContainer, runBtn, startBtn]);
    }

    _openFighterSelect() {
        this._selectedFighters = new Set();
        this._fighterGridContainer.removeAll(true);
        this._fighterCards = [];
        this._fighterMobsRef = [];

        // Берем до 12 сильнейших мобов с поля (2 ряда по 6 карточек)
        const availableMobs = this.mergeField.getMobsOnField()
            .sort((a, b) => b.mob.atk - a.mob.atk)
            .slice(0, 12);

        // Авто-выбор до 3 сильнейших мобов
        const autoPickCount = Math.min(3, availableMobs.length);
        for (let i = 0; i < autoPickCount; i++) {
            this._selectedFighters.add(i);
        }

        const perRow = 6;
        for (let i = 0; i < 12; i++) {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = -285 + col * 114;
            const y = -62 + row * 114;

            const entry = availableMobs[i] || null;
            const objs = this._buildFighterCard(x, y, entry, i);
            this._fighterCards.push(objs);
        }

        this._updateFighterCountText();
        this._fighterModal.setVisible(true);
    }

    _updateFighterCountText() {
        if (this._fighterCountText) {
            this._fighterCountText.setText(`Выбрано: ${this._selectedFighters.size} / 3`);
        }
    }

    _buildFighterCard(x, y, entry, idx) {
        const objs = [];
        const cardW = 106;
        const cardH = 106;

        if (!entry) {
            // Пустой слот
            const bg = this.add.graphics();
            drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, 0xf1f5f9, 0.95, 0xcbd5e1, 1.5);
            objs.push(bg);

            const plusTxt = createHDText(this, x, y, '＋', {
                fontSize: '24px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#94a3b8', fontStyle: '900'
            }).setOrigin(0.5);
            objs.push(plusTxt);

            this._fighterGridContainer.add(objs);
            return objs;
        }

        const { mob } = entry;
        const isSelected = this._selectedFighters.has(idx);

        const bg = this.add.graphics();
        objs.push(bg);

        // Круглый постамент под аватар
        const saucer = this.add.graphics();
        objs.push(saucer);

        // Чекбокс в правом верхнем углу
        const checkCircle = this.add.graphics();
        objs.push(checkCircle);

        const checkMarkTxt = createHDText(this, x + cardW / 2 - 14, y - cardH / 2 + 14, isSelected ? '✓' : '', {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5);
        objs.push(checkMarkTxt);

        const drawCardState = (selected) => {
            bg.clear();
            if (selected) {
                // Выделенная карточка (soft mint + emerald border)
                drawRoundRect(bg, x - cardW / 2 + 1, y - cardH / 2 + 2, cardW, cardH, 12, 0x059669, 0.20);
                drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, 0xecfdf5, 0.98, 0x10b981, 2.5);
            } else {
                // Обычная карточка
                drawRoundRect(bg, x - cardW / 2 + 1, y - cardH / 2 + 2, cardW, cardH, 12, 0x000000, 0.08);
                drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, 0xffffff, 0.98, 0xcbd5e1, 1.5);
            }

            saucer.clear();
            saucer.fillStyle(selected ? 0xd1fae5 : 0xf1f5f9, 1);
            saucer.fillCircle(x, y - 14, 23);
            saucer.lineStyle(1.2, selected ? 0x10b981 : 0x94a3b8, 0.6);
            saucer.strokeCircle(x, y - 14, 23);

            checkCircle.clear();
            if (selected) {
                checkCircle.fillStyle(0x10b981, 1);
                checkCircle.fillCircle(x + cardW / 2 - 14, y - cardH / 2 + 14, 9);
                checkCircle.lineStyle(1.5, 0xffffff, 1);
                checkCircle.strokeCircle(x + cardW / 2 - 14, y - cardH / 2 + 14, 9);
                checkMarkTxt.setText('✓');
            } else {
                checkCircle.fillStyle(0xffffff, 1);
                checkCircle.fillCircle(x + cardW / 2 - 14, y - cardH / 2 + 14, 9);
                checkCircle.lineStyle(1.5, 0x94a3b8, 1);
                checkCircle.strokeCircle(x + cardW / 2 - 14, y - cardH / 2 + 14, 9);
                checkMarkTxt.setText('');
            }
        };

        drawCardState(isSelected);

        const mobTex = (mob.portraitKey && this.textures.exists(mob.portraitKey))
            ? mob.portraitKey
            : (mob.texture || (mob.level <= 10 ? `mob_0${mob.level}` : 'mob_placeholder'));
        const mobImg = this.add.image(x, y - 14, mobTex).setDisplaySize(42, 42);
        objs.push(mobImg);

        const nameTxt = createHDText(this, x, y + 17, mob.name, {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#1e293b', fontStyle: '800', align: 'center', wordWrap: { width: cardW - 8 }
        }).setOrigin(0.5);
        objs.push(nameTxt);

        const atkPill = this.add.graphics();
        drawRoundRect(atkPill, x - 34, y + 29, 68, 17, 8, 0xfef2f2, 0.95, 0xef4444, 1);
        objs.push(atkPill);

        const atkTxt = createHDText(this, x, y + 37, `⚔ ${formatNumber(mob.atk)}`, {
            fontSize: '10.5px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#dc2626', fontStyle: '900'
        }).setOrigin(0.5);
        objs.push(atkTxt);

        const hitArea = this.add.rectangle(x, y, cardW, cardH, 0, 0).setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerdown', () => {
            if (this._selectedFighters.has(idx)) {
                this._selectedFighters.delete(idx);
                drawCardState(false);
                if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            } else if (this._selectedFighters.size < CONFIG.BATTLE_MAX_FIGHTERS) {
                this._selectedFighters.add(idx);
                drawCardState(true);
                if (typeof SoundManager !== 'undefined') SoundManager.playPop();
            } else {
                spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 'Максимум 3 моба!', '#ff4757');
            }
            this._updateFighterCountText();
        });
        objs.push(hitArea);

        this._fighterGridContainer.add(objs);

        while (this._fighterMobsRef.length <= idx) this._fighterMobsRef.push(null);
        this._fighterMobsRef[idx] = entry;

        return objs;
    }

    _startBattle() {
        if (this._selectedFighters.size === 0) {
            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 'Выберите хотя бы одного моба!', '#ff4444');
            return;
        }
        const playerTeam = [...this._selectedFighters].map(i => this._fighterMobsRef[i].mob);
        this._fighterModal.setVisible(false);

        // Случайный подбор команды бота: слабее, равный (50 на 50), или сильнее
        const botTeam = generateBotTeam(playerTeam);

        // Сохраняем состояние поля со всеми мобами перед началом боя!
        this._save();

        this.scene.start('BattleScene', {
            playerTeam,
            botTeam,
            botName: this._currentBotName,
            state: this.state,
        });
    }

    // ============================================================
    // Вспомогательные методы
    // ============================================================

    _setCoinsText(val) {
        if (this._coinsText) this._coinsText.setText(`${formatNumber(val)}`);
    }

    _spawnFlyingCoins(startX, startY, count = 3) {
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playCoin();
        }
        const targetX = CONFIG.WIDTH - 100;
        const targetY = 32;

        for (let i = 0; i < count; i++) {
            const coin = this.add.text(startX + randInt(-16, 16), startY + randInt(-16, 16), '💎', {
                fontSize: '18px'
            }).setOrigin(0.5).setDepth(600);

            this.tweens.add({
                targets: coin,
                x: targetX,
                y: targetY,
                scaleX: 0.6,
                scaleY: 0.6,
                alpha: 0.25,
                duration: 400 + i * 50,
                ease: 'Cubic.In',
                onComplete: () => {
                    coin.destroy();
                    if (this._coinsText) {
                        this.tweens.add({
                            targets: this._coinsText,
                            scaleX: 1.15,
                            scaleY: 1.15,
                            duration: 50,
                            yoyo: true
                        });
                    }
                }
            });
        }
    }

    // ============================================================
    // Модальное окно "Настройки"
    // ============================================================

    _buildSettingsModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._settingsModal = this.add.container(W / 2, H / 2).setDepth(500).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setInteractive();
        overlay.on('pointerdown', () => this._settingsModal.setVisible(false));

        const cardW = 340;
        const cardH = 260;

        // Фон карточки настроек (кремовый с двойной декоративной рамкой как на скриншоте 5)
        const bg = this.add.graphics();
        drawRoundRect(bg, -cardW / 2, -cardH / 2, cardW, cardH, 20, 0xfffcf0, 0.98, 0xdfcfb4, 3.5);
        bg.lineStyle(1.5, 0xd4bfa0, 0.7);
        bg.strokeRoundedRect(-cardW / 2 + 8, -cardH / 2 + 8, cardW - 16, cardH - 16, 14);

        // Заголовок "Настройки"
        const title = this.add.text(0, -cardH / 2 + 38, 'Настройки', {
            fontSize: '24px',
            fontFamily: 'monospace',
            color: '#3d312a',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Красный круглый крестик закрытия в правом верхнем углу
        const closeX = cardW / 2 - 4;
        const closeY = -cardH / 2 + 4;
        const closeBtnG = this.add.graphics();
        closeBtnG.fillStyle(0xe74c3c, 1);
        closeBtnG.fillCircle(closeX, closeY, 17);
        closeBtnG.lineStyle(2.5, 0xffffff, 1);
        closeBtnG.strokeCircle(closeX, closeY, 17);

        const closeBtnTxt = this.add.text(closeX, closeY, '✖', {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const closeBtnHit = this.add.circle(closeX, closeY, 22, 0, 0).setInteractive({ cursor: 'pointer' });
        closeBtnHit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            this._settingsModal.setVisible(false);
        });

        // Контейнер для кнопок аудио (Музыка и Звук)
        this._settingsAudioContainer = this.add.container(0, 0);

        // Кнопка "Сброс прогресса"
        const [resetBg, resetTxt, resetHit] = this._makeButton(0, 70, 170, 48, 'Сброс\nпрогресса', '#c0392b', () => {
            this._onResetProgress();
        }, '14px');

        this._settingsModal.add([
            overlay, bg, title,
            closeBtnG, closeBtnTxt, closeBtnHit,
            this._settingsAudioContainer,
            resetBg, resetTxt, resetHit
        ]);
    }

    _openSettingsModal() {
        this._renderSettingsButtons();
        this._settingsModal.setScale(0.7);
        this._settingsModal.setVisible(true);
        this.tweens.add({
            targets: this._settingsModal,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Back.Out'
        });
    }

    _renderSettingsButtons() {
        this._settingsAudioContainer.removeAll(true);

        const soundOn = (typeof SoundManager === 'undefined') || SoundManager.isEnabled();
        const musicOn = (this.state.musicEnabled !== false);

        const btnW = 96;
        const btnH = 76;
        const mX = -62;
        const sX = 62;
        const y = -14;

        // 1. Кнопка "Музыка"
        const mBg = this.add.graphics();
        drawRoundRect(mBg, mX - btnW / 2, y - btnH / 2, btnW, btnH, 12,
            musicOn ? 0xa8d8f8 : 0xd8dde2, 1,
            musicOn ? 0x64b5f6 : 0xb0bec5, 2.5);

        const mIcon = this.add.text(mX, y - 14, '🎵', { fontSize: '26px' }).setOrigin(0.5);
        const mLabel = this.add.text(mX, y + 16, 'Музыка', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: musicOn ? '#0277bd' : '#78909c',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const mHit = this.add.rectangle(mX, y, btnW, btnH, 0, 0).setInteractive({ cursor: 'pointer' });
        mHit.on('pointerdown', () => {
            this.state.musicEnabled = !musicOn;
            this._save();
            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            this._renderSettingsButtons();
        });

        // 2. Кнопка "Звук"
        const sBg = this.add.graphics();
        drawRoundRect(sBg, sX - btnW / 2, y - btnH / 2, btnW, btnH, 12,
            soundOn ? 0xa8d8f8 : 0xd8dde2, 1,
            soundOn ? 0x64b5f6 : 0xb0bec5, 2.5);

        const sIcon = this.add.text(sX, y - 14, soundOn ? '🔊' : '🔇', { fontSize: '26px' }).setOrigin(0.5);
        const sLabel = this.add.text(sX, y + 16, 'Звук', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: soundOn ? '#0277bd' : '#78909c',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const sHit = this.add.rectangle(sX, y, btnW, btnH, 0, 0).setInteractive({ cursor: 'pointer' });
        sHit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.setEnabled(!soundOn);
                if (!soundOn) SoundManager.playClick();
            }
            this._renderSettingsButtons();
        });

        this._settingsAudioContainer.add([mBg, mIcon, mLabel, mHit, sBg, sIcon, sLabel, sHit]);
    }

    _onResetProgress() {
        this._isResetting = true;
        SaveManager.reset();
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playPop();
        }
        this.scene.restart();
    }

    _makeButton(cx, cy, w, h, label, color, callback, fontSize = '13px') {
        const hex = parseInt(color.replace('#', ''), 16);
        const r = Math.max(0, ((hex >> 16) & 0xff) - 55);
        const g = Math.max(0, ((hex >> 8) & 0xff) - 55);
        const b = Math.max(0, (hex & 0xff) - 55);
        const shadowColor = (r << 16) | (g << 8) | b;
        const depth = 4;
        const radius = 12;

        const bg = this.add.graphics();
        const drawBtn = (pressed = false) => {
            bg.clear();
            const yOffset = pressed ? depth : 0;
            // Теневая 3D основа
            drawRoundRect(bg, cx - w / 2, cy - h / 2 + depth, w, h, radius, shadowColor, 1);
            // Верхняя часть кнопки
            drawRoundRect(bg, cx - w / 2, cy - h / 2 + yOffset, w, h, radius, hex, 1, 0xffffff, 1.8);
            // Блик сверху
            bg.fillStyle(0xffffff, 0.28);
            bg.fillRoundedRect(cx - w / 2 + 3, cy - h / 2 + yOffset + 2, w - 6, Math.floor(h * 0.42), radius - 2);
        };

        drawBtn(false);

        const txt = createHDText(this, cx, cy, label, {
            fontSize,
            fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff',
            stroke: '#111625',
            strokeThickness: 3,
            fontStyle: '800',
            align: 'center',
        }).setOrigin(0.5).setDepth(1);

        const hitArea = this.add.rectangle(cx, cy + depth / 2, w, h + depth, 0, 0)
            .setInteractive({ cursor: 'pointer' });

        hitArea.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playClick();
            }
            drawBtn(true);
            txt.y = cy + depth;
        });

        const release = () => {
            drawBtn(false);
            txt.y = cy;
        };

        hitArea.on('pointerup', () => {
            release();
            if (callback) callback();
        });
        hitArea.on('pointerout', release);

        return [bg, txt, hitArea];
    }

    _save() {
        if (this._isResetting) return;
        const fieldState = this.mergeField.toState();
        this.state.player         = this.economy.toState();
        this.state.field          = fieldState.field;
        this.state.collection     = fieldState.collection;
        this.state.shownModals    = fieldState.shownModals;
        this.state.incubatorSlots = this.state.incubatorSlots;
        this.state.playtime       = this.state.playtime;
        this.state.quests         = this.quests;
        SaveManager.save(this.state);
    }

    shutdown() {
        if (!this._isResetting) {
            this._save();
        }
    }

    /**
     * Dev-only оверлей с отображением FPS, renderer resolution, canvas backing size,
     * CSS display size, DPR, active texture count.
     * Включается только при ?debug=1 в URL или CONFIG.DEBUG === true
     */
    _buildDevDebugOverlay() {
        const isDebug = location.search.includes('debug=1') ||
            (typeof CONFIG !== 'undefined' && CONFIG.DEBUG === true);
        if (!isDebug) return;

        const overlayBg = this.add.graphics().setDepth(99999);
        const overlayText = this.add.text(14, 78, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#00ffcc',
            stroke: '#000000',
            strokeThickness: 3,
            lineSpacing: 3,
        }).setDepth(100000);

        let lastTime = performance.now();
        let frameCount = 0;
        let fps = 60;

        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                const now = performance.now();
                fps = Math.round((frameCount * 1000) / (now - lastTime));
                frameCount = 0;
                lastTime = now;

                const canvas = this.scale.canvas;
                const rect = canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const backingW = canvas.width;
                const backingH = canvas.height;
                const cssW = Math.round(rect.width);
                const cssH = Math.round(rect.height);
                const logicalW = (typeof CONFIG !== 'undefined' && CONFIG.WIDTH) || 960;
                const logicalH = (typeof CONFIG !== 'undefined' && CONFIG.HEIGHT) || 540;
                const renderScale = (backingW / logicalW).toFixed(2);
                const physicalScreenW = Math.round(rect.width * dpr);
                const physicalScreenH = Math.round(rect.height * dpr);
                const stretchRatio = (physicalScreenW / backingW).toFixed(2);
                const effectivePPR = (backingW / logicalW).toFixed(2);
                const texCount = Object.keys(this.textures.list).length;
                const vramEstMB = ((texCount * 256 * 256 * 4) / (1024 * 1024)).toFixed(1);

                const lines = [
                    `⚡ [DEV TELEMETRY]`,
                    `FPS: ${fps} [MEASURED]`,
                    `Logical Resolution: ${logicalW}x${logicalH}`,
                    `Backing Buffer Resolution: ${backingW}x${backingH} [MEASURED]`,
                    `CSS Display Resolution: ${cssW}x${cssH} [MEASURED]`,
                    `Render Scale: ${renderScale}x [MEASURED]`,
                    `DPR: ${dpr.toFixed(2)} [MEASURED]`,
                    `CSS Stretch Ratio: ${stretchRatio}x [MEASURED]`,
                    `Effective Physical Pixels Per Logical Pixel: ${effectivePPR} [MEASURED]`,
                    `Active Textures: ${texCount} [MEASURED]`,
                    `VRAM (Est. 256px): ~${vramEstMB} MB [ESTIMATED]`,
                ];

                overlayText.setText(lines.join('\n'));
                overlayBg.clear();
                overlayBg.fillStyle(0x0a0f1d, 0.88);
                overlayBg.lineStyle(1.5, 0x00ffcc, 0.7);
                overlayBg.fillRoundedRect(8, 72, overlayText.width + 12, overlayText.height + 12, 6);
                overlayBg.strokeRoundedRect(8, 72, overlayText.width + 12, overlayText.height + 12, 6);
            }
        });

        this.events.on('update', () => { frameCount++; });
    }
}
