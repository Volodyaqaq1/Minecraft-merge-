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
            spawnFloatingText(this, 84, 65, `НОВЫЙ УРОВЕНЬ ${lvl}! 🌟`, '#ffd700');
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

        // 1. Кнопка шестерёнки настроек + бейдж "Уровень X" (как на скриншотах 4 и 5)
        this._buildSettingsAndLevelWidget(12, 10);

        // 2. Кнопка "🎁 Подарки" (открывает меню наград за время в игре)
        const [fBg, fTxt, fHit] = this._makeButton(246, 32, 124, 44, '🎁 Подарки', '#27ae60', () => {
            this._openPlaytimeModal();
        }, '14px');
        this._giftBtnText = fTxt;

        // 3. Комбо-шкала множителя (шкала вверху, числа x1-x5 строго снизу под шкалой)
        this._buildComboBar(328, 12, 222, 16);

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

    _buildSettingsAndLevelWidget(x, y) {
        // Кнопка настроек с шестерёнкой (слева, квадрат со скруглёнными углами как на скриншоте 4)
        const gearSize = 44;
        const gearBg = this.add.graphics();
        drawRoundRect(gearBg, x, y, gearSize, gearSize, 12, 0x81d4fa, 1, 0xb3e5fc, 2.5);

        const gearTxt = this.add.text(x + gearSize / 2, y + gearSize / 2, '⚙', {
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#0288d1',
            strokeThickness: 1,
        }).setOrigin(0.5);

        const gearHit = this.add.rectangle(x + gearSize / 2, y + gearSize / 2, gearSize, gearSize, 0, 0)
            .setInteractive({ cursor: 'pointer' });
        gearHit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') SoundManager.playClick();
            this._openSettingsModal();
        });

        // Бейдж уровня (соединён справа, оранжево-золотой фон без полоски XP)
        const lvlX = x + gearSize + 4;
        const lvlW = 118;
        const lvlH = 44;

        this.levelBadgeBg = this.add.graphics();
        drawRoundRect(this.levelBadgeBg, lvlX, y, lvlW, lvlH, 12, 0xf39c12, 1, 0xd35400, 2);

        this.levelWidgetTitle = this.add.text(lvlX + lvlW / 2, y + lvlH / 2, `Уровень ${this.economy.level}`, {
            fontSize: '15px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#7f4f18',
            strokeThickness: 3,
            fontStyle: 'bold',
        }).setOrigin(0.5);
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

        // Фон шкалы комбо
        this.comboBg = this.add.graphics();
        drawRoundRect(this.comboBg, x, y, w, h, 6, 0x2c1a0e, 0.92, 0x8b5a2b, 2);

        // Разделительные насечки на 5 равных зон внутри полосы
        const step = w / 5;
        this.comboTicks = this.add.graphics();
        this.comboTicks.lineStyle(1.5, 0x8b5a2b, 0.6);
        for (let i = 1; i < 5; i++) {
            this.comboTicks.lineBetween(x + step * i, y + 1, x + step * i, y + h - 1);
        }

        this.comboFill = this.add.graphics();
        this.multiplierTexts = [];
        const mults = [1, 2, 3, 4, 5];

        // Числа x1 x2 x3 x4 x5 расположены СНИЗУ под шкалой (y + h + 11)
        mults.forEach((m, idx) => {
            const tx = x + step * idx + step / 2;
            const txt = this.add.text(tx, y + h + 11, `x${m}`, {
                fontSize: '13px',
                fontFamily: 'monospace',
                color: idx === 0 ? '#5dff6e' : '#a4b0be',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            this.multiplierTexts.push(txt);
        });

        this._redrawComboBar();
    }

    _redrawComboBar() {
        this.comboFill.clear();
        const fillW = Math.floor((this.comboW - 4) * (this.comboGauge / 100));
        if (fillW > 0) {
            this.comboFill.fillStyle(0x5dff6e, 0.95);
            this.comboFill.fillRoundedRect(this.comboX + 2, this.comboY + 2, fillW, this.comboH - 4, 4);
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
                txt.setFontSize('15px');
                txt.setStroke('#000000', 2);
            } else {
                txt.setColor('#a0aec0');
                txt.setFontSize('12px');
                txt.setStroke('#000000', 0);
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
        this._questUiGroup.forEach(item => item && item.destroy && item.destroy());
        this._questUiGroup = [];

        const startX = 76;
        const startY = 105;
        const cardH  = 72;
        const spacing = 82;

        this.quests.forEach((quest, idx) => {
            const mob = getMobByLevel(quest.mobLevel);
            if (!mob) return;

            // Считаем мобов на поле прямо сейчас (если объединил — статус готовности сбрасывается)
            const rawCount = this.mergeField.mobs.filter(m => m.mobLevel === quest.mobLevel).length;
            const isReady = rawCount >= quest.targetCount;
            quest.isCompleted = isReady;

            // Не считаем больше мобов, чем нужно (максимум targetCount)
            const displayCount = Math.min(rawCount, quest.targetCount);

            const cx = startX;
            const cy = startY + idx * spacing;
            const cardW = 134;

            // Фон карточки задания
            const bg = this.add.graphics();
            drawRoundRect(bg, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12,
                isReady ? 0x1b4332 : 0x16213e, 0.95,
                isReady ? 0x2ed573 : 0x3d5a80, isReady ? 2.5 : 1.5);
            this._questUiGroup.push(bg);

            // Эмодзи моба слева (крупный и отцентрированный по вертикали)
            const emoji = this.add.text(cx - 38, cy, mob.emoji, {
                fontSize: '38px',
            }).setOrigin(0.5);

            // Название моба
            const nameText = this.add.text(cx + 14, cy - 20, mob.name, {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#ffffff',
                fontStyle: 'bold',
                wordWrap: { width: 78 }
            }).setOrigin(0.5);

            // Прогресс (например, 1/4 или 3/3 ГОТОВО!)
            const countText = this.add.text(cx + 14, cy - 4,
                isReady ? `🎉 ${displayCount}/${quest.targetCount} ГОТОВО!` : `${displayCount} / ${quest.targetCount}`, {
                fontSize: isReady ? '10px' : '12px',
                fontFamily: 'monospace',
                color: isReady ? '#5dff6e' : '#ffd700',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            // Полоска прогресса
            const barBg = this.add.graphics();
            drawRoundRect(barBg, cx - 22, cy + 9, 72, 6, 3, 0x222222, 0.85);

            const barFill = this.add.graphics();
            const ratio = isReady ? 1.0 : Math.min(1, displayCount / quest.targetCount);
            if (ratio > 0) {
                barFill.fillStyle(isReady ? 0x2ed573 : 0x00c9ff, 1);
                barFill.fillRoundedRect(cx - 22, cy + 9, Math.floor(72 * ratio), 6, 3);
            }

            // Нижняя строка: награда или кнопка "ЗАБРАТЬ"
            let rewardOrClaim;
            if (isReady) {
                const claimBg = this.add.graphics();
                drawRoundRect(claimBg, cx - 18, cy + 18, 64, 18, 5, 0x2ed573, 1);
                const claimTxt = this.add.text(cx + 14, cy + 27, 'ЗАБРАТЬ 🎁', {
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    fontStyle: 'bold',
                }).setOrigin(0.5);
                rewardOrClaim = [claimBg, claimTxt];
            } else {
                const rewText = this.add.text(cx + 14, cy + 25, `💎 ${formatNumber(quest.rewardCoins)}`, {
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#5dff6e',
                    fontStyle: 'bold',
                }).setOrigin(0.5);
                rewardOrClaim = [rewText];
            }

            // Интерактивная зона
            const hitArea = this.add.rectangle(cx, cy, cardW, cardH, 0, 0)
                .setInteractive({ cursor: isReady ? 'pointer' : 'default' });

            hitArea.on('pointerdown', () => {
                if (isReady) {
                    this._claimQuest(idx, cx, cy);
                } else {
                    spawnFloatingText(this, cx + 50, cy - 20, `Соберите ${quest.targetCount}x ${mob.name}!`, '#ffd700');
                }
            });

            this._questUiGroup.push(
                emoji, nameText, countText,
                barBg, barFill, ...rewardOrClaim, hitArea
            );
        });
    }

    _claimQuest(idx, x, y) {
        const quest = this.quests[idx];
        if (!quest) return;

        // Начисляем монеты
        this.economy.addCoins(quest.rewardCoins);

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

        this._onFieldChanged();
    }

    _onAdMob(mob) {
        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `🎁 +${mob.emoji} ${mob.name}!`, '#ffd700');
        }
        this._onFieldChanged();
    }

    // ============================================================
    // Нижняя панель
    // ============================================================

    _buildBottomBar() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const g = this.add.graphics();
        drawRoundRect(g, 0, H - 64, W, 64, 0, 0x16213e, 0.96);

        this._makeButton(110, H - 32, 150, 48, '📖 Коллекция', '#34495e',
            () => this.scene.launch('CollectionScene', { collection: [...this.mergeField.collection] }), '14px');

        // Кнопка Инкубатора
        this._makeButton(275, H - 32, 150, 48, '🥚 Инкубатор', '#8e44ad',
            () => this._openIncubatorModal(), '14px');

        this._makeButton(440, H - 32, 150, 48, '🏆 Награды', '#34495e',
            () => spawnFloatingText(this, 440, H - 80, 'Скоро!', '#ffd700'), '14px');

        // Большая красная кнопка В БОЙ
        this._makeButton(W - 120, H - 32, 190, 50, '⚔ В БОЙ!', '#c0392b', () => {
            if (this.mergeField.mobs.length === 0) {
                spawnFloatingText(this, W - 120, H - 80, 'Купите бойцов!', '#ff4444');
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

        this._playtimeModal = this.add.container(W / 2, H / 2).setDepth(450).setVisible(false);

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

        this._incubatorModal = this.add.container(W / 2, H / 2).setDepth(450).setVisible(false);

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
            this._incubatorSubtitle.setText(`Высиживание: ${shopMob.emoji} ${shopMob.name} (Lv.${shopMobLevel})`);
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

            const slotTitle = this.add.text(x, y - slotH / 2 + 16, `СЛОТ ${idx + 1} (${slot.unlockLevel} УР)`, {
                fontSize: '12px', fontFamily: 'monospace', color: isUnlocked ? '#2c3e50' : '#8395a7', fontStyle: 'bold'
            }).setOrigin(0.5);

            this._incubatorSlotsContainer.add([bg, slotTitle]);

            if (!isUnlocked) {
                // Заблокированный слот
                const lockIcon = this.add.text(x, y - 20, '🔒', { fontSize: '42px' }).setOrigin(0.5);
                const lockText = this.add.text(x, y + 36, `Откроется\nна ${slot.unlockLevel} уровне!`, {
                    fontSize: '13px', fontFamily: 'monospace', color: '#576574', align: 'center', fontStyle: 'bold'
                }).setOrigin(0.5);

                this._incubatorSlotsContainer.add([lockIcon, lockText]);
            } else {
                if (slot.active) {
                    // ИДЁТ ИНКУБАЦИЯ
                    const now = Date.now();
                    const isReady = now >= slot.endTime;

                    const eggEmoji = this.add.text(x, y - 55, '🥚', { fontSize: '50px' }).setOrigin(0.5);
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

                    const batchInfo = this.add.text(x, y - 2, `${mobInfo.emoji} ${mobInfo.name}\n(Lv.${mobInfo.level})`, {
                        fontSize: '12px', fontFamily: 'monospace', color: '#2d3436', align: 'center', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const countInfo = this.add.text(x, y + 26, `Пачка: ${mobCount} шт. (${durLabel})`, {
                        fontSize: '11px', fontFamily: 'monospace', color: '#e67e22', fontStyle: 'bold'
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

                        const timerTxt = this.add.text(x, y + 46, `⏱ ${timeStr}`, {
                            fontSize: '15px', fontFamily: 'monospace', color: '#d35400', fontStyle: 'bold'
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
                    const mobEmoji = this.add.text(x, y - 52, shopMob.emoji, { fontSize: '38px' }).setOrigin(0.5);

                    const mobName = this.add.text(x, y - 18, `${shopMob.name} (Lv.${shopMob.level})`, {
                        fontSize: '11px', fontFamily: 'monospace', color: '#2d3436', align: 'center', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const selTitle = this.add.text(x, y + 3, 'Время инкубации:', {
                        fontSize: '10px', fontFamily: 'monospace', color: '#7f8c8d', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    // Плашка переключателя времени и количества
                    const selBox = this.add.graphics();
                    drawRoundRect(selBox, x - 72, y + 15, 144, 38, 8, 0xede7f6, 0.95, 0xd1c4e9, 1.5);

                    const leftArrow = this.add.text(x - 56, y + 34, '◀', {
                        fontSize: '18px', color: '#8e44ad', fontStyle: 'bold'
                    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

                    leftArrow.on('pointerdown', () => {
                        slot.selectedTierIndex = (currentTierIdx - 1 + tierConfigs.length) % tierConfigs.length;
                        if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                        this._renderIncubatorSlots();
                    });

                    const rightArrow = this.add.text(x + 56, y + 34, '▶', {
                        fontSize: '18px', color: '#8e44ad', fontStyle: 'bold'
                    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

                    rightArrow.on('pointerdown', () => {
                        slot.selectedTierIndex = (currentTierIdx + 1) % tierConfigs.length;
                        if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                        this._renderIncubatorSlots();
                    });

                    const timeInfo = this.add.text(x, y + 26, `⏱ ${currentTier.labelTime}`, {
                        fontSize: '12px', fontFamily: 'monospace', color: '#2c3e50', fontStyle: 'bold'
                    }).setOrigin(0.5);

                    const countInfo = this.add.text(x, y + 42, `${currentTier.labelCount}`, {
                        fontSize: '11px', fontFamily: 'monospace', color: '#27ae60', fontStyle: 'bold'
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

        const title = this.add.text(0, -170, '✨ NEW! ✨', {
            fontSize: '32px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000000', strokeThickness: 5, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._newMobModalContent = this.add.container(0, 0);

        const closeBtn = this._makeButton(0, 168, 220, 46, 'КРУТО! 👍', '#2ed573', () => {
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

            // Огромный моб посередине с пульсацией
            const centerEmoji = this.add.text(0, -50, newMob.emoji, { fontSize: '88px' }).setOrigin(0.5);
            centerEmoji.setScale(0.1);

            this.tweens.add({
                targets: centerEmoji,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 250,
                ease: 'Back.Out',
                onComplete: () => {
                    this.tweens.add({
                        targets: centerEmoji,
                        scaleX: 1.05,
                        scaleY: 1.05,
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
            const nameText = this.add.text(0, 14, newMob.name.toUpperCase(), {
                fontSize: '22px', fontFamily: 'monospace', color: '#ffffff',
                stroke: '#000000', strokeThickness: 3, fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            // Уровень и АТК
            const statsText = this.add.text(0, 42, `LV.${newMob.level}   ⚔ ${formatNumber(newMob.atk)}`, {
                fontSize: '16px', fontFamily: 'monospace', color: '#5dff6e',
                stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            // Прирост урона к предыдущему (+X%)
            let diffPct = 120;
            if (prevMob && prevMob.atk > 0) {
                diffPct = Math.round(((newMob.atk - prevMob.atk) / prevMob.atk) * 100);
            }
            const bumpText = this.add.text(0, 68, `+${diffPct}% к предыдущему! 🔥`, {
                fontSize: '13px', fontFamily: 'monospace', color: '#ff9f43',
                stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            // Следующий моб: стрелка и ??? с силуэтом
            const nextBg = this.add.graphics();
            drawRoundRect(nextBg, -150, 94, 300, 42, 8, 0x111625, 0.95, 0xffd700, 1.5);
            nextBg.setAlpha(0);

            const nextTxt = this.add.text(0, 115, `➔ Следующий: ??? 🔒 (Lv.${newMob.level + 1})`, {
                fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
            }).setOrigin(0.5).setAlpha(0);

            this._newMobModalContent.add([
                centerEmoji, nameText, statsText, bumpText, nextBg, nextTxt
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
            const leftMob = this.add.text(-150, -50, prevMob.emoji, { fontSize: '52px' }).setOrigin(0.5);
            const rightMob = this.add.text(150, -50, prevMob.emoji, { fontSize: '52px' }).setOrigin(0.5);
            const mergeLabel = this.add.text(0, -115, 'СЛИЯНИЕ... ⚡', {
                fontSize: '17px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
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

        this._battleModal = this.add.container(W / 2, H / 2).setDepth(300).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -220, -120, 440, 240, 16, 0xfffdf0, 0.98, 0x8b5a2b, 3);

        const title = this.add.text(0, -75, 'Вы вызвали на бой игрока:', {
            fontSize: '17px', fontFamily: 'monospace', color: '#2c3e50',
            stroke: '#ffffff', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._battleModalName = this.add.text(0, -35, '', {
            fontSize: '25px', fontFamily: 'monospace', color: '#c0392b',
            stroke: '#ffffff', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        const runBtn = this._makeButton(-85, 50, 140, 44, 'Убежать', '#576574',
            () => { this._battleModal.setVisible(false); }, '14px');
        const fightBtn = this._makeButton(85, 50, 140, 44, 'В бой! ⚔', '#2ed573',
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
        // Светлая кремовая карточка модалки (как на скриншоте 2)
        drawRoundRect(bg, -385, -215, 770, 430, 20, 0xfffdf0, 0.98, 0x8b5a2b, 3);

        const title = this.add.text(0, -182, 'Выберите до 3 мобов для боя', {
            fontSize: '20px', fontFamily: 'monospace', color: '#2c3e50',
            stroke: '#ffffff', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._fighterCountText = this.add.text(0, -156, 'Выбрано: 0 / 3', {
            fontSize: '13px', fontFamily: 'monospace', color: '#27ae60', fontStyle: 'bold'
        }).setOrigin(0.5);

        this._fighterCards = [];
        this._selectedFighters = new Set();
        this._fighterGridContainer = this.add.container(0, 0);

        const runBtn = this._makeButton(-110, 172, 160, 44, 'Убежать', '#576574',
            () => { this._fighterModal.setVisible(false); }, '14px');
        const startBtn = this._makeButton(110, 172, 180, 44, 'Начать бой ⚔', '#2ed573',
            () => { this._startBattle(); }, '15px');

        this._fighterModal.add([overlay, bg, title, this._fighterCountText, this._fighterGridContainer, ...runBtn, ...startBtn]);
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
        const cardW = 104;
        const cardH = 104;

        if (!entry) {
            // Пустой слот
            const bg = this.add.graphics();
            drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 10, 0xf5f6fa, 0.95, 0xdcdde1, 1.5);
            objs.push(bg);

            const plusTxt = this.add.text(x, y, '＋', { fontSize: '26px', color: '#c8d6e5' }).setOrigin(0.5);
            objs.push(plusTxt);

            this._fighterGridContainer.add(objs);
            return objs;
        }

        const { mob } = entry;
        const isSelected = this._selectedFighters.has(idx);

        const bg = this.add.graphics();
        objs.push(bg);

        // Круглый чекбокс в правом верхнем углу (как на скриншоте 2)
        const checkCircle = this.add.graphics();
        objs.push(checkCircle);

        const checkMarkTxt = this.add.text(x + cardW / 2 - 13, y - cardH / 2 + 13, isSelected ? '✓' : '', {
            fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        objs.push(checkMarkTxt);

        const drawCardState = (selected) => {
            bg.clear();
            drawRoundRect(bg, x - cardW / 2, y - cardH / 2, cardW, cardH, 10,
                selected ? 0xeafaf1 : 0xffffff, 0.98,
                selected ? 0x2ed573 : 0xd2c4b0,
                selected ? 2.5 : 1.5);

            checkCircle.clear();
            if (selected) {
                checkCircle.fillStyle(0x2ed573, 1);
                checkCircle.fillCircle(x + cardW / 2 - 13, y - cardH / 2 + 13, 8);
                checkCircle.lineStyle(1.5, 0xffffff, 1);
                checkCircle.strokeCircle(x + cardW / 2 - 13, y - cardH / 2 + 13, 8);
                checkMarkTxt.setText('✓');
            } else {
                checkCircle.fillStyle(0xffffff, 1);
                checkCircle.fillCircle(x + cardW / 2 - 13, y - cardH / 2 + 13, 8);
                checkCircle.lineStyle(1.5, 0xa4b0be, 1);
                checkCircle.strokeCircle(x + cardW / 2 - 13, y - cardH / 2 + 13, 8);
                checkMarkTxt.setText('');
            }
        };

        drawCardState(isSelected);

        const emojiTxt = this.add.text(x, y - 18, mob.emoji, { fontSize: '36px' }).setOrigin(0.5);
        objs.push(emojiTxt);

        const nameTxt = this.add.text(x, y + 15, mob.name, {
            fontSize: '10.5px', fontFamily: 'monospace', color: '#2d3436', fontStyle: 'bold',
            align: 'center', wordWrap: { width: cardW - 8 }
        }).setOrigin(0.5);
        objs.push(nameTxt);

        const atkTxt = this.add.text(x, y + 31, `⚔ ${formatNumber(mob.atk)}`, {
            fontSize: '11px', fontFamily: 'monospace', color: '#e74c3c', fontStyle: 'bold'
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
        SaveManager.reset();
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playPop();
        }
        this.scene.restart();
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
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playClick();
            }
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
        this.state.shownModals    = fieldState.shownModals;
        this.state.incubatorSlots = this.state.incubatorSlots;
        this.state.playtime       = this.state.playtime;
        this.state.quests         = this.quests;
        SaveManager.save(this.state);
    }

    shutdown() {
        this._save();
    }
}
