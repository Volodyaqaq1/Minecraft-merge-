// ============================================================
// scenes/GameScene.js — главный экран: свободное поле, кликер, инкубатор (5-10-15 ур), подарки за онлайн
// ============================================================

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init() {
        this.state    = SaveManager.load();
        this.economy  = new Economy(this.state);

        // Гарантируем структуру инкубатора и наград за онлайн
        if (!Array.isArray(this.state.incubatorSlots)) {
            this.state.incubatorSlots = [
                { id: 0, unlockLevel: 5, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
                { id: 1, unlockLevel: 10, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
                { id: 2, unlockLevel: 15, active: false, endTime: 0, durationMinutes: 0, mobCount: 0, mobLevel: 0 },
            ];
        }
        if (!this.state.playtime) {
            this.state.playtime = { totalSeconds: 0, claimed: {} };
        }

        // Комбо-шкала кликера (0..100%)
        this.comboGauge = 0;
        this.currentMultiplier = 1;
    }

    create() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── 1. Красивый фон поляны (как на скриншоте сквишей) ───
        this._buildBackground();

        // ─── 2. Свободное поле мёрджа ───
        this.mergeField = new MergeField(this, this.economy, this.state);

        // Привязываем кликер по мобу к комбо и наградам
        this.mergeField.onMobClick = (mobItem) => this._onMobClicked(mobItem);

        // При успешном слиянии обновляем магазин, левую карточку и показываем модалку открытия
        this.mergeField.onMergeSuccess = (newMob, isNew) => {
            this._updateShopButton();
            this._updateLeftStatusCard();
            if (isNew) {
                this._showNewMobUnlockModal(newMob);
            }
        };

        // Открытие нового моба из любого источника (магазин, реклама, инкубатор)
        this.mergeField.onNewMobDiscovered = (newMob) => {
            this._updateShopButton();
            this._updateLeftStatusCard();
            this._showNewMobUnlockModal(newMob);
        };

        // ─── 3. Верхняя панель (уровень, комбо-шкала x1-x5, монеты, подарки) ───
        this._buildTopBar();

        // ─── 4. Правая панель (покупка за монеты и моб за рекламу) ───
        this._buildRightShop();

        // ─── 5. Левая карточка статуса (лучший моб и счетчик на поле) ───
        this._buildLeftStatusCard();

        // ─── 6. Нижняя панель (Коллекция, Инкубатор, Награды, В бой!) ───
        this._buildBottomBar();

        // ─── 7. Модальные окна ───
        this._buildBattleModal();
        this._buildFighterSelectModal();
        this._buildNewMobModal();
        this._buildPlaytimeModal();
        this._buildIncubatorModal();

        // ─── 8. Привязка событий экономики к UI ───
        this.economy.onCoinsChange = (val) => this._setCoinsText(val);
        this.economy.onXPChange = (details) => this._updateLevelWidget(details);
        this.economy.onLevelChange = (lvl) => {
            this._updateLevelWidget();
            spawnFloatingText(this, 84, 65, `НОВЫЙ УРОВЕНЬ ${lvl}! 🌟`, '#ffd700');
        };

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
    }

    // ============================================================
    // Фоновая полянка
    // ============================================================

    _buildBackground() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const sky = this.add.graphics();
        sky.fillGradientStyle(0x73c9f7, 0x73c9f7, 0xb8e3fa, 0xb8e3fa, 1);
        sky.fillRect(0, 0, W, H / 2);

        const ground = this.add.graphics();
        ground.fillGradientStyle(0x56a635, 0x56a635, 0x3d7b23, 0x3d7b23, 1);
        ground.fillRect(0, H / 3, W, H * 2 / 3);

        for (let i = 0; i < 7; i++) {
            const x = 70 + i * 140;
            const treeY = H / 3 + 20;

            const tree = this.add.graphics();
            tree.fillStyle(0x4a7c29, 0.9);
            tree.fillCircle(x, treeY - 30, 45);
            tree.fillStyle(0x3e6822, 0.9);
            tree.fillCircle(x + 20, treeY - 20, 35);
        }
    }

    // ============================================================
    // Верхняя панель (Уровень, Комбо-шкала x1-x5, Подарки, Баланс)
    // ============================================================

    _buildTopBar() {
        const W = CONFIG.WIDTH;

        // 1. Кнопка уровня с прогресс-баром опыта (слева)
        this._buildLevelWidget(12, 10, 150, 44);

        // 2. Кнопка "🎁 Подарки" (открывает меню наград за время в игре)
        const [fBg, fTxt, fHit] = this._makeButton(236, 32, 132, 44, '🎁 Подарки', '#27ae60', () => {
            this._openPlaytimeModal();
        }, '14px');
        this._giftBtnText = fTxt;

        // 3. Комбо-шкала множителя (центр: x1 x2 x3 x4 x5)
        this._buildComboBar(316, 16, 246, 32);

        // 4. Баланс изумрудов (справа)
        const coinBg = this.add.graphics();
        drawRoundRect(coinBg, W - 190, 10, 175, 44, 10, 0xffffff, 0.95, 0xdddddd, 2);

        this.add.text(W - 173, 32, '💎', { fontSize: '22px' }).setOrigin(0.5);
        this._coinsText = this.add.text(W - 22, 32, `${formatNumber(this.economy.coins)}`, {
            fontSize: '19px',
            fontFamily: 'monospace',
            color: '#2e7d32',
            fontStyle: 'bold',
        }).setOrigin(1, 0.5);
    }

    _buildLevelWidget(x, y, w, h) {
        this.levelWidgetX = x;
        this.levelWidgetY = y;
        this.levelWidgetW = w;
        this.levelWidgetH = h;

        this.levelWidgetBg = this.add.graphics();
        this.levelWidgetFill = this.add.graphics();

        this.levelWidgetTitle = this.add.text(x + w / 2, y + 14, '', {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.levelWidgetSub = this.add.text(x + w / 2, y + 30, '', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 1,
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this._updateLevelWidget();
    }

    _updateLevelWidget(details) {
        if (!details) {
            details = this.economy.getXPDetails();
        }

        const { levelWidgetX: x, levelWidgetY: y, levelWidgetW: w, levelWidgetH: h } = this;
        if (!this.levelWidgetBg) return;

        // Фон виджета уровня
        this.levelWidgetBg.clear();
        drawRoundRect(this.levelWidgetBg, x, y, w, h, 8, 0x16213e, 0.95, 0x3d5a80, 2);

        // Полоска опыта
        this.levelWidgetFill.clear();
        const fillW = Math.floor((w - 4) * Math.max(0, Math.min(1, details.progress)));
        if (fillW > 0) {
            this.levelWidgetFill.fillStyle(0x00c9ff, 0.85);
            this.levelWidgetFill.fillRoundedRect(x + 2, y + 2, fillW, h - 4, 6);
        }

        this.levelWidgetTitle.setText(`⛏ Уровень ${details.level}`);
        this.levelWidgetSub.setText(`${formatNumber(details.curInLevel)} / ${formatNumber(details.neededInLevel)} XP`);
    }

    _buildComboBar(x, y, w, h) {
        this.comboX = x;
        this.comboY = y;
        this.comboW = w;
        this.comboH = h;

        this.comboBg = this.add.graphics();
        drawRoundRect(this.comboBg, x, y, w, h, 8, 0x5a3e1b, 0.9, 0xffd700, 2);

        this.comboFill = this.add.graphics();
        this.multiplierTexts = [];
        const mults = [1, 2, 3, 4, 5];
        const step = w / 5;

        mults.forEach((m, idx) => {
            const tx = x + step * idx + step / 2;
            const txt = this.add.text(tx, y + h / 2, `x${m}`, {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: idx === 0 ? '#5dff6e' : '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            this.multiplierTexts.push(txt);
        });

        this._redrawComboBar();
    }

    _redrawComboBar() {
        this.comboFill.clear();
        const fillW = Math.floor((this.comboW - 6) * (this.comboGauge / 100));
        if (fillW > 0) {
            this.comboFill.fillStyle(0x5dff6e, 0.95);
            this.comboFill.fillRoundedRect(this.comboX + 3, this.comboY + 3, fillW, this.comboH - 6, 6);
        }

        let mul = 1;
        if (this.comboGauge >= 80) mul = 5;
        else if (this.comboGauge >= 60) mul = 4;
        else if (this.comboGauge >= 40) mul = 3;
        else if (this.comboGauge >= 20) mul = 2;
        else mul = 1;

        this.currentMultiplier = mul;

        this.multiplierTexts.forEach((txt, idx) => {
            if (idx + 1 === mul) {
                txt.setColor('#ffd700');
                txt.setFontSize('16px');
            } else {
                txt.setColor('#dddddd');
                txt.setFontSize('13px');
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

        const reward = Math.max(1, Math.floor(mob.atk * CONFIG.CLICK_REWARD_RATIO * this.currentMultiplier));
        this.economy.addCoins(reward);

        const clickX = mobItem.container.x;
        const clickY = mobItem.container.y - 45;
        const mulBadge = this.currentMultiplier > 1 ? ` (x${this.currentMultiplier})` : '';
        spawnFloatingText(this, clickX, clickY, `+${formatNumber(reward)} 💎${mulBadge}`, '#5dff6e');
    }

    update(time, delta) {
        if (this.comboGauge > 0) {
            const decay = (CONFIG.COMBO_DECAY_PER_SEC * delta) / 1000;
            this.comboGauge = Math.max(0, this.comboGauge - decay);
            this._redrawComboBar();
        }
    }

    // ============================================================
    // Левая карточка статуса (Пояснение счетчика)
    // ============================================================

    _buildLeftStatusCard() {
        this._leftCardGroup = [];
        this._updateLeftStatusCard();
    }

    _updateLeftStatusCard() {
        this._leftCardGroup.forEach(item => item.destroy && item.destroy());
        this._leftCardGroup = [];

        const x = 62;
        const y = 126;
        const w = 106;
        const h = 122;

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const topMob = getMobByLevel(maxUnlocked);

        const bg = this.add.graphics();
        drawRoundRect(bg, x - w / 2, y - h / 2, w, h, 14, 0xffffff, 0.94, 0xffd700, 2.5);
        this._leftCardGroup.push(bg);

        // Поясняющий заголовок
        const title = this.add.text(x, y - h / 2 + 13, 'ТОП МОБ', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#b7791f',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        if (topMob) {
            // Эмодзи сильнейшего открытого моба
            const emoji = this.add.text(x, y - 5, topMob.emoji, { fontSize: '48px' }).setOrigin(0.5);

            // Бейдж количества мобов на полянке
            const countBadge = this.add.graphics();
            drawRoundRect(countBadge, x - 47, y + 28, 94, 25, 7, 0x27ae60, 1);

            const countText = this.add.text(x, y + 40, `На поле: ${this.mergeField.mobs.length}`, {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            this._leftCardGroup.push(title, emoji, countBadge, countText);
        }
    }

    // ============================================================
    // Правая панель — Магазин покупки мобов
    // ============================================================

    _buildRightShop() {
        this._shopUiGroup = [];
        this._updateShopButton();
    }

    _updateShopButton() {
        this._shopUiGroup.forEach(item => item.destroy && item.destroy());
        this._shopUiGroup = [];

        const W = CONFIG.WIDTH;
        const maxUnlocked = Math.max(...this.mergeField.collection, 1);

        // 1. Слот 1: Моб за монеты (на 3 уровня ниже максимального)
        const buyLevel = Math.max(1, maxUnlocked - CONFIG.BUY_LEVEL_OFFSET);
        const buyMob   = getMobByLevel(buyLevel);
        const cost     = getMobCost(buyLevel);

        const cardX = W - 78;
        const cardY = 135;
        const cardSize = 122;

        const bg1 = this.add.graphics();
        drawRoundRect(bg1, cardX - cardSize / 2, cardY - cardSize / 2, cardSize, cardSize, 18, 0xffffff, 0.94, 0x4aa3df, 3);
        this._shopUiGroup.push(bg1);

        if (buyMob) {
            const mobImg = this.add.text(cardX, cardY - 14, buyMob.emoji, {
                fontSize: '52px',
            }).setOrigin(0.5);

            const priceBg = this.add.graphics();
            drawRoundRect(priceBg, cardX - cardSize / 2 + 6, cardY + cardSize / 2 - 32, cardSize - 12, 26, 8, 0xffd700, 1);

            const priceText = this.add.text(cardX, cardY + cardSize / 2 - 19, `💎 ${formatNumber(cost)}`, {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#222222',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            const hitArea1 = this.add.rectangle(cardX, cardY, cardSize, cardSize, 0, 0)
                .setInteractive({ cursor: 'pointer' });

            hitArea1.on('pointerdown', () => this._onBuyMob(buyMob, cost));

            this._shopUiGroup.push(mobImg, priceBg, priceText, hitArea1);
        }

        // 2. Слот 2: Моб за рекламу (на 1 уровень ниже максимального!)
        const adMobLevel = Math.max(1, maxUnlocked - CONFIG.AD_LEVEL_OFFSET);
        const adMob      = getMobByLevel(adMobLevel);

        const cardY2 = 275;
        const bg2 = this.add.graphics();
        drawRoundRect(bg2, cardX - cardSize / 2, cardY2 - cardSize / 2, cardSize, cardSize, 18, 0xffffff, 0.94, 0x4aa3df, 3);
        this._shopUiGroup.push(bg2);

        if (adMob) {
            const mobImg2 = this.add.text(cardX, cardY2 - 14, adMob.emoji, {
                fontSize: '52px',
            }).setOrigin(0.5);

            const adBg = this.add.graphics();
            drawRoundRect(adBg, cardX - cardSize / 2 + 6, cardY2 + cardSize / 2 - 32, cardSize - 12, 26, 8, 0x8e44ad, 1);

            const adText = this.add.text(cardX, cardY2 + cardSize / 2 - 19, '📺 Реклама', {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            const hitArea2 = this.add.rectangle(cardX, cardY2, cardSize, cardSize, 0, 0)
                .setInteractive({ cursor: 'pointer' });

            hitArea2.on('pointerdown', () => this._onAdMob(adMob));

            this._shopUiGroup.push(mobImg2, adBg, adText, hitArea2);
        }
    }

    _onBuyMob(mob, cost) {
        if (!this.economy.spendCoins(cost)) {
            spawnFloatingText(this, CONFIG.WIDTH - 80, 200, 'Мало изумрудов!', '#ff4444');
            return;
        }

        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `+${mob.emoji} ${mob.name}`, '#5dff6e');
        }

        this._updateLeftStatusCard();
    }

    _onAdMob(mob) {
        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `🎁 +${mob.emoji} ${mob.name}!`, '#ffd700');
        }
        this._updateLeftStatusCard();
    }

    // ============================================================
    // Нижняя панель
    // ============================================================

    _buildBottomBar() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const g = this.add.graphics();
        drawRoundRect(g, 0, H - 62, W, 62, 0, 0x16213e, 0.96);

        this._makeButton(105, H - 31, 145, 46, '📖 Коллекция', '#34495e',
            () => this.scene.launch('CollectionScene', { collection: [...this.mergeField.collection] }), '13px');

        // Кнопка Инкубатора
        this._makeButton(265, H - 31, 145, 46, '🥚 Инкубатор', '#8e44ad',
            () => this._openIncubatorModal(), '13px');

        this._makeButton(425, H - 31, 145, 46, '🏆 Награды', '#34495e',
            () => spawnFloatingText(this, 425, H - 80, 'Скоро!', '#ffd700'), '13px');

        // Большая красная кнопка В БОЙ
        this._makeButton(W - 115, H - 31, 185, 48, '⚔ В БОЙ!', '#c0392b', () => {
            if (this.mergeField.mobs.length === 0) {
                spawnFloatingText(this, W - 115, H - 80, 'Купите бойцов!', '#ff4444');
                return;
            }
            this._openBattleModal();
        }, '18px');
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

        if (this._giftBtnText) {
            this._giftBtnText.setText(hasUnclaimed ? '🎁 Подарки 🔴' : '🎁 Подарки');
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
                seconds: 600, // 10 минут
                timeLabel: '10 минут',
                desc: `2x ${subMob ? subMob.name : 'Моб'} (Lv.${subMobLevel})`,
                icon: subMob ? subMob.emoji : '🐔',
                claim: () => {
                    this.mergeField.spawnMob(subMobLevel);
                    this.mergeField.spawnMob(subMobLevel);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🎁 Получено 2x ${subMob.name}!`, '#5dff6e');
                }
            },
            {
                seconds: 1800, // 30 минут
                timeLabel: '30 минут',
                coins: getMobCost(maxUnlocked) * 4,
                desc: `💎 Мешок изумрудов (${formatNumber(getMobCost(maxUnlocked) * 4)})`,
                icon: '💰',
                claim: (tier) => {
                    this.economy.addCoins(tier.coins);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `+💎 ${formatNumber(tier.coins)} изумрудов!`, '#5dff6e');
                }
            },
            {
                seconds: 3600, // 1 час
                timeLabel: '1 час',
                desc: `3x ${subMob ? subMob.name : 'Моб'} (Lv.${subMobLevel})`,
                icon: subMob ? subMob.emoji : '🐔',
                claim: () => {
                    for (let i = 0; i < 3; i++) this.mergeField.spawnMob(subMobLevel);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🎁 Получено 3x ${subMob.name}!`, '#5dff6e');
                }
            },
            {
                seconds: 7200, // 2 часа
                timeLabel: '2 часа',
                coins: getMobCost(maxUnlocked) * 10,
                desc: `💎 Сундук изумрудов (${formatNumber(getMobCost(maxUnlocked) * 10)}) + 200 XP`,
                icon: '📦',
                claim: (tier) => {
                    this.economy.addCoins(tier.coins);
                    this.economy.addXP(200);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `+💎 ${formatNumber(tier.coins)} + 200 XP!`, '#5dff6e');
                }
            },
            {
                seconds: 14400, // 4 часа
                timeLabel: '4 часа',
                desc: `2x ${topMob ? topMob.name : 'Топ Моб'} (Lv.${maxUnlocked})`,
                icon: topMob ? topMob.emoji : '⭐',
                claim: () => {
                    this.mergeField.spawnMob(maxUnlocked);
                    this.mergeField.spawnMob(maxUnlocked);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `👑 2x ${topMob.name} получено!`, '#ffd700');
                }
            },
            {
                seconds: 28800, // 8 часов
                timeLabel: '8 часов',
                coins: getMobCost(maxUnlocked) * 20,
                desc: `👑 Королевский клад + 1x ${topMob ? topMob.name : 'Топ'}!`,
                icon: '👑',
                claim: (tier) => {
                    this.mergeField.spawnMob(maxUnlocked);
                    this.economy.addCoins(tier.coins);
                    spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `👑 КОРОЛЕВСКИЙ КЛАД ПОЛУЧЕН!`, '#ffd700');
                }
            },
        ];
    }

    _buildPlaytimeModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._playtimeModal = this.add.container(W / 2, H / 2).setDepth(450).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -300, -200, 600, 400, 18, 0x16213e, 0.98, 0xffd700, 3);

        const title = this.add.text(0, -165, '🎁 НАГРАДЫ ЗА ВРЕМЯ В ИГРЕ', {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._playtimeTimeHeader = this.add.text(0, -138, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#5dff6e', fontStyle: 'bold'
        }).setOrigin(0.5);

        this._playtimeListContainer = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 168, 170, 42, 'ЗАКРЫТЬ', '#747d8c', () => {
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
        const startY = -106;
        const cardH  = 42;

        tiers.forEach((tier, idx) => {
            const y = startY + idx * (cardH + 6);
            const isClaimed = !!this.state.playtime.claimed[idx];
            const isReady   = curSeconds >= tier.seconds && !isClaimed;

            const bg = this.add.graphics();
            drawRoundRect(bg, -270, y, 540, cardH, 8,
                isReady ? 0x1b4332 : (isClaimed ? 0x242d38 : 0x1a233a), 0.9,
                isReady ? 0x5dff6e : 0x4a5568, 1.5);

            const icon = this.add.text(-250, y + cardH / 2, tier.icon, { fontSize: '24px' }).setOrigin(0.5);

            const timeTxt = this.add.text(-222, y + 10, tier.timeLabel, {
                fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
            });

            const descTxt = this.add.text(-222, y + 24, tier.desc, {
                fontSize: '11px', fontFamily: 'monospace', color: '#dddddd'
            });

            this._playtimeListContainer.add([bg, icon, timeTxt, descTxt]);

            if (isClaimed) {
                const claimBadge = this.add.text(210, y + cardH / 2, 'Получено ✅', {
                    fontSize: '12px', fontFamily: 'monospace', color: '#8892b0', fontStyle: 'bold'
                }).setOrigin(0.5);
                this._playtimeListContainer.add(claimBadge);
            } else if (isReady) {
                const [cBg, cTxt, cHit] = this._makeButton(210, y + cardH / 2, 108, 30, 'ЗАБРАТЬ 🎁', '#2ed573', () => {
                    this.state.playtime.claimed[idx] = true;
                    tier.claim(tier);
                    this._renderPlaytimeCards();
                    this._updateLeftStatusCard();
                    this._save();
                }, '12px');
                this._playtimeListContainer.add([cBg, cTxt, cHit]);
            } else {
                const left = tier.seconds - curSeconds;
                const lm = Math.floor(left / 60);
                const ls = left % 60;
                const timerTxt = this.add.text(210, y + cardH / 2, `⏱ ${pad(lm)}:${pad(ls)}`, {
                    fontSize: '12px', fontFamily: 'monospace', color: '#a0aec0', fontStyle: 'bold'
                }).setOrigin(0.5);
                this._playtimeListContainer.add(timerTxt);
            }
        });
    }

    // ============================================================
    // ИНКУБАТОР (Открывается на 5, 10, 15 уровне)
    // ============================================================

    _buildIncubatorModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._incubatorModal = this.add.container(W / 2, H / 2).setDepth(450).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -310, -210, 620, 420, 20, 0x16213e, 0.98, 0x8e44ad, 3);

        const title = this.add.text(0, -175, '🥚 ИНКУБАТОР МОБОВ', {
            fontSize: '22px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        const sub = this.add.text(0, -145, 'Слоты открываются на 5, 10 и 15 уровнях игрока!', {
            fontSize: '12px', fontFamily: 'monospace', color: '#b388ff'
        }).setOrigin(0.5);

        this._incubatorSlotsContainer = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 180, 170, 42, 'ЗАКРЫТЬ', '#747d8c', () => {
            this._incubatorModal.setVisible(false);
        }, '14px');

        this._incubatorModal.add([overlay, bg, title, sub, this._incubatorSlotsContainer, ...closeBtn]);
    }

    _openIncubatorModal() {
        this._renderIncubatorSlots();
        this._incubatorModal.setScale(0.7);
        this._incubatorModal.setVisible(true);
        this.tweens.add({ targets: this._incubatorModal, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out' });
    }

    _renderIncubatorSlots() {
        this._incubatorSlotsContainer.removeAll(true);

        const slotW = 180;
        const slotH = 265;
        const startX = -195;
        const y = -10;

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);

        this.state.incubatorSlots.forEach((slot, idx) => {
            const x = startX + idx * 195;
            const isUnlocked = this.economy.level >= slot.unlockLevel;

            const bg = this.add.graphics();
            drawRoundRect(bg, x - slotW / 2, y - slotH / 2, slotW, slotH, 14,
                isUnlocked ? 0x221738 : 0x151824, 0.92,
                isUnlocked ? 0x8e44ad : 0x4a5568, 2);

            const slotTitle = this.add.text(x, y - slotH / 2 + 16, `СЛОТ ${idx + 1}`, {
                fontSize: '14px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
            }).setOrigin(0.5);

            this._incubatorSlotsContainer.add([bg, slotTitle]);

            if (!isUnlocked) {
                // Заблокированный слот
                const lockIcon = this.add.text(x, y - 20, '🔒', { fontSize: '44px' }).setOrigin(0.5);
                const lockText = this.add.text(x, y + 35, `Откроется\nна ${slot.unlockLevel} уровне!`, {
                    fontSize: '13px', fontFamily: 'monospace', color: '#a0aec0', align: 'center', fontStyle: 'bold'
                }).setOrigin(0.5);

                this._incubatorSlotsContainer.add([lockIcon, lockText]);
            } else {
                // Разблокированный слот
                if (slot.active) {
                    // ИДЁТ ИНКУБАЦИЯ
                    const now = Date.now();
                    const isReady = now >= slot.endTime;

                    const eggEmoji = this.add.text(x, y - 45, '🥚', { fontSize: '48px' }).setOrigin(0.5);
                    const mobInfo = getMobByLevel(slot.mobLevel);

                    const batchInfo = this.add.text(x, y + 5, `${slot.mobCount}x ${mobInfo ? mobInfo.name : 'Мобов'}\n(Ур. ${slot.mobLevel})`, {
                        fontSize: '12px', fontFamily: 'monospace', color: '#ffffff', align: 'center', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    this._incubatorSlotsContainer.add([eggEmoji, batchInfo]);

                    if (isReady) {
                        const readyTxt = this.add.text(x, y + 42, 'ГОТОВО! 🎉', {
                            fontSize: '13px', fontFamily: 'monospace', color: '#5dff6e', fontStyle: 'bold'
                        }).setOrigin(0.5);

                        const [cBg, cTxt, cHit] = this._makeButton(x, y + 80, 155, 38, 'ЗАБРАТЬ 🎁', '#2ed573', () => {
                            // Спавним всех приготовленных мобов на поле
                            for (let i = 0; i < slot.mobCount; i++) {
                                this.mergeField.spawnMob(slot.mobLevel);
                            }
                            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🥚 +${slot.mobCount}x мобов из инкубатора!`, '#5dff6e');

                            slot.active = false;
                            this._renderIncubatorSlots();
                            this._updateLeftStatusCard();
                            this._save();
                        }, '13px');

                        this._incubatorSlotsContainer.add([readyTxt, cBg, cTxt, cHit]);
                    } else {
                        const leftSec = Math.ceil((slot.endTime - now) / 1000);
                        const lm = Math.floor(leftSec / 60);
                        const ls = leftSec % 60;
                        const pad = (n) => String(n).padStart(2, '0');

                        const timerTxt = this.add.text(x, y + 48, `⏱ ${pad(lm)}:${pad(ls)}`, {
                            fontSize: '15px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
                        }).setOrigin(0.5);

                        const statusTxt = this.add.text(x, y + 80, 'Варится в яйце...', {
                            fontSize: '11px', fontFamily: 'monospace', color: '#b388ff'
                        }).setOrigin(0.5);

                        this._incubatorSlotsContainer.add([timerTxt, statusTxt]);
                    }
                } else {
                    // СЛОТ СВОБОДЕН — ВЫБОР ПАЧКИ
                    const freeTxt = this.add.text(x, y - slotH / 2 + 36, 'Свободен. Выберите:', {
                        fontSize: '11px', fontFamily: 'monospace', color: '#b388ff'
                    }).setOrigin(0.5);
                    this._incubatorSlotsContainer.add(freeTxt);

                    // Рецепты:
                    // 10 мин (5 мобов), 30 мин (10 мобов), 2 часа (15 мобов), 8 часов (25 мобов)
                    const recipes = [
                        { minutes: 10, count: 5,  levelOffset: 2, label: '⏱ 10м → 5 моб.' },
                        { minutes: 30, count: 10, levelOffset: 2, label: '⏱ 30м → 10 моб.' },
                        { minutes: 120, count: 15, levelOffset: 1, label: '⏱ 2ч → 15 моб.' },
                        { minutes: 480, count: 25, levelOffset: 1, label: '⏱ 8ч → 25 моб.' },
                    ];

                    recipes.forEach((rcp, rIdx) => {
                        const ry = y - 48 + rIdx * 38;
                        const [rBg, rTxt, rHit] = this._makeButton(x, ry, 155, 32, rcp.label, '#34495e', () => {
                            const targetLvl = Math.max(1, maxUnlocked - rcp.levelOffset);
                            slot.active = true;
                            slot.endTime = Date.now() + rcp.minutes * 60 * 1000;
                            slot.durationMinutes = rcp.minutes;
                            slot.mobCount = rcp.count;
                            slot.mobLevel = targetLvl;

                            this._renderIncubatorSlots();
                            this._save();
                            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, `🥚 Инкубация началась! (${rcp.label})`, '#ffd700');
                        }, '12px');

                        this._incubatorSlotsContainer.add([rBg, rTxt, rHit]);
                    });
                }
            }
        });
    }

    // ============================================================
    // Модальное окно открытия нового моба
    // ============================================================

    _buildNewMobModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._newMobModal = this.add.container(W / 2, H / 2).setDepth(400).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -270, -165, 540, 330, 20, 0x16213e, 0.98, 0xffd700, 3);

        const title = this.add.text(0, -125, '🎉 НОВЫЙ МОБ ОТКРЫТ! 🎉', {
            fontSize: '22px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._newMobModalContent = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 118, 220, 46, 'КРУТО! 👍', '#2ed573', () => {
            this._newMobModal.setVisible(false);
        }, '16px');

        this._newMobModal.add([overlay, bg, title, this._newMobModalContent, ...closeBtn]);
    }

    _showNewMobUnlockModal(newMob) {
        this._newMobModalContent.removeAll(true);

        const nextMob = getMobByLevel(newMob.level + 1);

        const leftX = -130;
        const leftY = -12;
        const cardW = 160;
        const cardH = 175;

        const leftBg = this.add.graphics();
        drawRoundRect(leftBg, leftX - cardW / 2, leftY - cardH / 2, cardW, cardH, 14, newMob.rarityColor, 0.45, 0x5dff6e, 3);

        const badgeG = this.add.graphics();
        drawRoundRect(badgeG, leftX - 48, leftY - cardH / 2 - 12, 96, 22, 6, 0x2ed573, 1);
        const badgeTxt = this.add.text(leftX, leftY - cardH / 2 - 1, 'ОТКРЫТ!', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const leftEmoji = this.add.text(leftX, leftY - 22, newMob.emoji, { fontSize: '62px' }).setOrigin(0.5);

        this.tweens.add({
            targets: leftEmoji,
            scaleX: 1.15,
            scaleY: 1.15,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });

        const leftName = this.add.text(leftX, leftY + 28, newMob.name, {
            fontSize: '13px', fontFamily: 'monospace', color: '#ffffff',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold', wordWrap: { width: cardW - 10 }
        }).setOrigin(0.5, 0);

        const leftAtk = this.add.text(leftX, leftY + 52, `⚔ ${formatNumber(newMob.atk)}`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#5dff6e', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const leftLvl = this.add.text(leftX - cardW / 2 + 10, leftY - cardH / 2 + 10, `Lv.${newMob.level}`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
        });

        const arrow = this.add.text(0, leftY, '➔', {
            fontSize: '38px', color: '#ffd700', stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: arrow,
            x: 8,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });

        const rightX = 130;
        const rightY = -12;

        const rightBg = this.add.graphics();
        drawRoundRect(rightBg, rightX - cardW / 2, rightY - cardH / 2, cardW, cardH, 14, 0x111625, 0.9, 0x4a5568, 2);

        const nextBadgeG = this.add.graphics();
        drawRoundRect(nextBadgeG, rightX - 54, rightY - cardH / 2 - 12, 108, 22, 6, 0x4a5568, 1);
        const nextBadgeTxt = this.add.text(rightX, rightY - cardH / 2 - 1, 'СЛЕДУЮЩИЙ', {
            fontSize: '11px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(0.5);

        const rightEmoji = this.add.text(rightX, rightY - 22, '❓', { fontSize: '56px' }).setOrigin(0.5);

        const rightName = this.add.text(rightX, rightY + 28, nextMob ? nextMob.name : '???', {
            fontSize: '13px', fontFamily: 'monospace', color: '#8892b0',
            stroke: '#000', strokeThickness: 1, wordWrap: { width: cardW - 10 }
        }).setOrigin(0.5, 0);

        const rightLvl = this.add.text(rightX, rightY + 52, nextMob ? `Lv.${nextMob.level}` : 'МАКСИМУМ', {
            fontSize: '13px', fontFamily: 'monospace', color: '#a0aec0', fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const rightLock = this.add.text(rightX + cardW / 2 - 16, rightY - cardH / 2 + 10, '🔒', { fontSize: '14px' }).setOrigin(0.5);

        this._newMobModalContent.add([
            leftBg, badgeG, badgeTxt, leftEmoji, leftName, leftAtk, leftLvl,
            arrow,
            rightBg, nextBadgeG, nextBadgeTxt, rightEmoji, rightName, rightLvl, rightLock
        ]);

        this._newMobModal.setScale(0.7);
        this._newMobModal.setVisible(true);

        this.tweens.add({
            targets: this._newMobModal,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 220,
            ease: 'Back.Out'
        });
    }

    // ============================================================
    // Модальные окна боев
    // ============================================================

    _buildBattleModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._battleModal = this.add.container(W / 2, H / 2).setDepth(300).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -220, -120, 440, 240, 16, 0x16213e, 0.98, 0xffd700, 2);

        const title = this.add.text(0, -85, 'Вы вызвали на бой игрока:', {
            fontSize: '18px', fontFamily: 'monospace', color: '#ffffff',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this._battleModalName = this.add.text(0, -45, '', {
            fontSize: '26px', fontFamily: 'monospace', color: '#ff4757',
            stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
        }).setOrigin(0.5);

        const runBtn = this._makeButton(-85, 55, 140, 44, 'Убежать', '#747d8c',
            () => { this._battleModal.setVisible(false); }, '14px');
        const fightBtn = this._makeButton(85, 55, 140, 44, 'В бой! ⚔', '#2ed573',
            () => { this._battleModal.setVisible(false); this._openFighterSelect(); }, '14px');

        this._battleModal.add([overlay, bg, title, this._battleModalName, ...runBtn, ...fightBtn]);
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

        this._fighterModal = this.add.container(W / 2, H / 2).setDepth(300).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -300, -200, 600, 400, 16, 0x16213e, 0.98, 0xffd700, 2);

        const title = this.add.text(0, -170, 'Выберите до 3 мобов для боя', {
            fontSize: '19px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._fighterCards = [];
        this._selectedFighters = new Set();

        const runBtn = this._makeButton(-100, 165, 150, 44, 'Убежать', '#747d8c',
            () => { this._fighterModal.setVisible(false); }, '14px');
        const startBtn = this._makeButton(100, 165, 160, 44, 'Начать бой ⚔', '#2ed573',
            () => { this._startBattle(); }, '15px');

        this._fighterModal.add([overlay, bg, title, ...runBtn, ...startBtn]);
    }

    _openFighterSelect() {
        this._selectedFighters = new Set();
        this._fighterCards.forEach(c => c.forEach(o => o.destroy && o.destroy()));
        this._fighterCards = [];

        const availableMobs = this.mergeField.getMobsOnField()
            .sort((a, b) => b.mob.atk - a.mob.atk)
            .slice(0, 9);

        const perRow = 3;
        availableMobs.forEach((entry, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = (col - 1) * 185;
            const y = -120 + row * 115;
            const objs = this._buildFighterCard(x, y, entry, i);
            this._fighterCards.push(objs);
        });

        this._fighterModal.setVisible(true);
    }

    _buildFighterCard(x, y, entry, idx) {
        const { mob } = entry;
        const objs = [];

        const cardW = 160;
        const cardH = 104;

        const bg = this.add.graphics();
        drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, mob.rarityColor, 0.45, 0xffffff, 1.5);
        objs.push(bg);

        const emojiTxt = this.add.text(x, y - 18, mob.emoji, { fontSize: '38px' }).setOrigin(0.5);
        objs.push(emojiTxt);

        const nameTxt = this.add.text(x, y + 14, mob.name, {
            fontSize: '11px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 2,
            fontStyle: 'bold', wordWrap: { width: cardW - 10 }
        }).setOrigin(0.5, 0);
        objs.push(nameTxt);

        const atkTxt = this.add.text(x, y + 30, `⚔ ${formatNumber(mob.atk)}`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#ff8888', fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        objs.push(atkTxt);

        const checkmark = this.add.text(x + cardW / 2 - 16, y - cardH / 2 + 16, '', { fontSize: '20px' }).setOrigin(0.5);
        objs.push(checkmark);

        const hitArea = this.add.rectangle(x, y, cardW, cardH, 0, 0).setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerdown', () => {
            if (this._selectedFighters.has(idx)) {
                this._selectedFighters.delete(idx);
                checkmark.setText('');
                bg.clear();
                drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, mob.rarityColor, 0.45, 0xffffff, 1.5);
            } else if (this._selectedFighters.size < CONFIG.BATTLE_MAX_FIGHTERS) {
                this._selectedFighters.add(idx);
                checkmark.setText('✅');
                bg.clear();
                drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 12, 0xffd700, 0.65, 0xffd700, 2.5);
            }
        });
        objs.push(hitArea);

        this._fighterModal.add(objs);

        this._fighterMobsRef = this._fighterMobsRef || [];
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

        this.scene.start('BattleScene', {
            playerTeam,
            botTeam,
            botName: this._currentBotName,
            economy: this.economy,
        });
    }

    // ============================================================
    // Вспомогательные методы
    // ============================================================

    _setCoinsText(val) {
        if (this._coinsText) this._coinsText.setText(`${formatNumber(val)}`);
    }

    _makeButton(cx, cy, w, h, label, color, callback, fontSize = '13px') {
        const hex = parseInt(color.replace('#', ''), 16);
        const bg = this.add.graphics();
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h, 8, hex, 1);

        const txt = this.add.text(cx, cy, label, {
            fontSize, fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1);

        const hitArea = this.add.rectangle(cx, cy, w, h, 0, 0).setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerdown', () => {
            this.tweens.add({ targets: [bg, txt], scaleX: 0.95, scaleY: 0.95, duration: 60, yoyo: true });
            callback();
        });

        return [bg, txt, hitArea];
    }

    _save() {
        const fieldState = this.mergeField.toState();
        this.state.player         = this.economy.toState();
        this.state.field          = fieldState.field;
        this.state.collection     = fieldState.collection;
        this.state.incubatorSlots = this.state.incubatorSlots;
        this.state.playtime       = this.state.playtime;
        SaveManager.save(this.state);
    }

    shutdown() {
        this._save();
    }
}
