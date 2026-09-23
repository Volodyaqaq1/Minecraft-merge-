// ============================================================
// scenes/GameScene.js — главный экран: мёрдж-поле + HUD
// ============================================================

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    // ── init вызывается при каждом старте сцены ──
    init() {
        this.state    = SaveManager.load();
        this.economy  = new Economy(this.state);
        this._autosaveTimer = 0;
    }

    create() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // ─── Фон ───
        this.add.rectangle(W / 2, H / 2, W, H, 0x2d5a27);
        // Деревья-заглушки (прямоугольники)
        for (let i = 0; i < 6; i++) {
            this.add.rectangle(80 + i * 160, H / 2 - 40, 40, 200, 0x1a3a15, 0.5);
        }

        // ─── Поле мёрджа ───
        this.mergeField = new MergeField(this, this.economy, this.state);
        this.mergeField.onQueueUpdate = (queue) => this._updateQueueUI(queue);

        // ─── Верхняя панель ───
        this._buildTopBar();

        // ─── Правая панель (магазин) ───
        this._buildShopPanel();

        // ─── Левая панель (очередь мобов) ───
        this._buildQueuePanel();

        // ─── Нижняя панель ───
        this._buildBottomBar();

        // ─── Модальные окна (спрятаны) ───
        this._buildBattleModal();
        this._buildFighterSelectModal();

        // ─── Коллбеки экономики → обновление UI ───
        this.economy.onCoinsChange      = (v) => this._setCoinsText(v);
        this.economy.onLevelChange      = (v) => this._setLevelText(v);
        this.economy.onMultiplierChange = (v) => this._setMultiplierText(v);

        // ─── Таймер бесплатного спавна ───
        this._updateFreeSpawnBtn();

        // ─── Периодические боты вызывают на бой ───
        this.time.addEvent({
            delay: 15000,   // каждые 15 сек
            loop: true,
            callback: this._triggerBotChallenge,
            callbackScope: this,
        });

        // ─── Автосохранение каждые 30 сек ───
        this.time.addEvent({
            delay: 30000,
            loop: true,
            callback: this._save,
            callbackScope: this,
        });

        // ─── Пауза при потере фокуса (для ЯИ) ───
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._save();
        });
    }

    // ============================================================
    // Верхняя панель
    // ============================================================

    _buildTopBar() {
        const W = CONFIG.WIDTH;
        const g = this.add.graphics();
        drawRoundRect(g, 0, 0, W, 52, 0, CONFIG.COLORS.PANEL, 0.92);

        // Уровень
        this._levelText = this.add.text(60, 14, `⛏ Уровень ${this.economy.level}`, {
            fontSize: '16px', fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000', strokeThickness: 2,
        });

        // Монеты
        this._coinsText = this.add.text(W - 20, 14,
            `💎 ${formatNumber(this.economy.coins)}`, {
            fontSize: '18px', fontFamily: 'monospace',
            color: '#5dff6e', stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0);

        // Прогресс-бар XP
        this._xpBarBg = this.add.graphics();
        this._xpBarFg = this.add.graphics();
        this._multiplierText = this.add.text(W / 2, 14,
            `x${this.economy.multiplier}`, {
            fontSize: '16px', fontFamily: 'monospace',
            color: '#ffd700', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        this._drawXPBar();

        // Бесплатный спавн
        this._freeBtn = this._makeButton(270, 26, 130, 34, '🎁 Бесплатно', '#27ae60', () => {
            this._onFreeSpawn();
        });
    }

    _drawXPBar() {
        const bx = 420, by = 8, bw = 200, bh = 14;
        this._xpBarBg.clear();
        this._xpBarBg.fillStyle(0x333333, 0.9);
        this._xpBarBg.fillRoundedRect(bx, by, bw, bh, 4);

        const progress = this.economy.getLevelProgress();
        this._xpBarFg.clear();
        this._xpBarFg.fillStyle(0x5dff6e, 1);
        this._xpBarFg.fillRoundedRect(bx, by, Math.floor(bw * progress), bh, 4);
    }

    _setCoinsText(v)      { this._coinsText.setText(`💎 ${formatNumber(v)}`); }
    _setLevelText(v)      { this._levelText.setText(`⛏ Уровень ${v}`); this._drawXPBar(); }
    _setMultiplierText(v) { this._multiplierText.setText(`x${v}`); }

    // ============================================================
    // Левая панель — очередь мобов
    // ============================================================

    _buildQueuePanel() {
        const g = this.add.graphics();
        drawRoundRect(g, 4, 56, 130, 420, 10, CONFIG.COLORS.PANEL, 0.85);

        this.add.text(69, 64, 'ОЧЕРЕДЬ', {
            fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa'
        }).setOrigin(0.5, 0);

        // 4 слота очереди
        this._queueSlots = [];
        for (let i = 0; i < CONFIG.QUEUE_SIZE; i++) {
            const y = 84 + i * 96;
            const qg = this.add.graphics();
            drawRoundRect(qg, 12, y, 110, 88, 8, CONFIG.COLORS.SLOT_EMPTY, 0.6);
            const label = this.add.text(67, y + 44, '?', {
                fontSize: '28px', fontFamily: 'monospace', color: '#555'
            }).setOrigin(0.5);
            this._queueSlots.push({ g: qg, label });
        }
    }

    _updateQueueUI(queue) {
        this._queueSlots.forEach((slot, i) => {
            const mobLevel = queue[i];
            if (mobLevel !== undefined) {
                const mob = getMobByLevel(mobLevel);
                slot.label.setText(mob ? mob.emoji : '?');
            } else {
                slot.label.setText('');
            }
        });
    }

    // ============================================================
    // Правая панель — магазин
    // ============================================================

    _buildShopPanel() {
        const W = CONFIG.WIDTH;
        const g = this.add.graphics();
        drawRoundRect(g, W - 134, 56, 130, 420, 10, CONFIG.COLORS.PANEL, 0.85);

        this.add.text(W - 69, 64, 'МАГАЗИН', {
            fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa'
        }).setOrigin(0.5, 0);

        this._shopCards = [];
        this._refreshShop();
    }

    _refreshShop() {
        // Очистить старые карточки
        this._shopCards.forEach(c => c.forEach(o => o.destroy && o.destroy()));
        this._shopCards = [];

        const W = CONFIG.WIDTH;
        const shopMobs = this._generateShopMobs();
        this.state.shopSlots = shopMobs.map(m => m ? m.level : null);

        shopMobs.forEach((mob, i) => {
            const y = 84 + i * 185;
            const objs = [];

            // Карточка
            const bg = this.add.graphics();
            drawRoundRect(bg, W - 128, y, 120, 170, 8,
                mob ? mob.rarityColor : 0x333333, 0.4, 0xffffff, 1);
            objs.push(bg);

            if (mob) {
                // Эмодзи/арт моба
                const img = this.add.text(W - 68, y + 55, mob.emoji, { fontSize: '40px' }).setOrigin(0.5);
                objs.push(img);

                // Имя
                const nm = this.add.text(W - 68, y + 95, mob.name, {
                    fontSize: '9px', fontFamily: 'monospace', color: '#fff',
                    stroke: '#000', strokeThickness: 1, wordWrap: { width: 110 }
                }).setOrigin(0.5, 0);
                objs.push(nm);

                // АТК
                const atk = this.add.text(W - 68, y + 115, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '8px', fontFamily: 'monospace', color: '#ff8888'
                }).setOrigin(0.5, 0);
                objs.push(atk);

                if (i === 0) {
                    // Кнопка купить
                    const cost = Math.floor(mob.atk * CONFIG.SHOP_MOB_COST_MULTIPLIER);
                    const btn = this._makeButton(W - 68, y + 148, 110, 26,
                        `💎 ${formatNumber(cost)}`, '#27ae60',
                        () => this._buyMob(mob, cost));
                    objs.push(...btn);
                } else {
                    // Бесплатно за рекламу
                    const btn = this._makeButton(W - 68, y + 148, 110, 26,
                        '📺 Реклама', '#2980b9',
                        () => this._adMob(mob));
                    objs.push(...btn);
                }
            }
            this._shopCards.push(objs);
        });
    }

    _generateShopMobs() {
        const maxLevel = Math.max(...this.mergeField.collection, 1);
        const lvl1 = Math.min(CONFIG.MOB_LEVELS, maxLevel + randInt(0, 2));
        const lvl2 = Math.min(CONFIG.MOB_LEVELS, Math.max(1, maxLevel - randInt(0, 3)));
        return [getMobByLevel(lvl1), getMobByLevel(lvl2)];
    }

    _buyMob(mob, cost) {
        if (!this.economy.spendCoins(cost)) {
            spawnFloatingText(this, CONFIG.WIDTH - 68, 300, 'Мало изумрудов!', '#ff4444');
            return;
        }
        if (!this.mergeField.addMobToField(mob.level)) {
            spawnFloatingText(this, CONFIG.WIDTH - 68, 300, 'Поле полное!', '#ff4444');
            this.economy.addCoins(cost); // вернуть деньги
            return;
        }
        spawnFloatingText(this, CONFIG.WIDTH - 68, 300, `+${mob.emoji} ${mob.name}!`, '#5dff6e');
        this._refreshShop();
    }

    _adMob(mob) {
        // Заглушка рекламы — в реальной игре вызывать ЯИ SDK rewarded ad
        // YaGames.adv.showRewardedVideo({ callbacks: { onRewarded: () => {...} } });
        if (!this.mergeField.addMobToField(mob.level)) {
            spawnFloatingText(this, CONFIG.WIDTH - 68, 300, 'Поле полное!', '#ff4444');
            return;
        }
        spawnFloatingText(this, CONFIG.WIDTH - 68, 300, `🎁 ${mob.emoji} ${mob.name}!`, '#ffd700');
        this._refreshShop();
    }

    // ============================================================
    // Бесплатный спавн (таймер)
    // ============================================================

    _buildFreeSpawnBtn() { /* встроен в _buildTopBar */ }

    _updateFreeSpawnBtn() {
        const now  = Date.now();
        const diff = this.state.freeSpawnTime - now;
        if (diff <= 0) {
            // Доступно
            if (this._freeBtn) this._freeBtn.setStyle && null;
            // Кнопка активна
        } else {
            // Таймер
            const sec = Math.ceil(diff / 1000);
            const min = Math.floor(sec / 60);
            const s   = sec % 60;
            // Обновить текст кнопки через 1 сек
            this.time.delayedCall(1000, this._updateFreeSpawnBtn, [], this);
        }
    }

    _onFreeSpawn() {
        const now  = Date.now();
        if (this.state.freeSpawnTime > now) return; // ещё не готово
        const maxLevel = Math.max(...this.mergeField.collection, 1);
        const lvl = Math.max(1, Math.min(maxLevel, randInt(1, maxLevel)));
        if (!this.mergeField.addMobToField(lvl)) {
            spawnFloatingText(this, CONFIG.WIDTH / 2, 200, 'Поле полное!', '#ff4444');
            return;
        }
        this.state.freeSpawnTime = now + CONFIG.FREE_MOB_COOLDOWN;
        spawnFloatingText(this, CONFIG.WIDTH / 2, 200, '🎁 Бесплатный моб!', '#ffd700');
        this._updateFreeSpawnBtn();
    }

    // ============================================================
    // Нижняя панель
    // ============================================================

    _buildBottomBar() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;
        const g = this.add.graphics();
        drawRoundRect(g, 0, H - 58, W, 58, 0, CONFIG.COLORS.PANEL, 0.92);

        this._makeButton(100, H - 29, 160, 38, '📖 Коллекция', '#636e72',
            () => this.scene.launch('CollectionScene', { collection: [...this.mergeField.collection] }));

        this._makeButton(290, H - 29, 160, 38, '🥚 Инкубатор', '#636e72',
            () => spawnFloatingText(this, W / 2, H / 2, 'Скоро!', '#ffd700'));

        this._makeButton(470, H - 29, 160, 38, '🏆 Награды', '#636e72',
            () => spawnFloatingText(this, W / 2, H / 2, 'Скоро!', '#ffd700'));

        this._makeButton(W - 100, H - 29, 160, 42, '⚔ В БОЙ!', '#c0392b',
            () => this._openBattleModal());
    }

    // ============================================================
    // Модальное окно — вызов бота
    // ============================================================

    _buildBattleModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._battleModal = this.add.container(W / 2, H / 2).setDepth(200).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -220, -120, 440, 240, 16, CONFIG.COLORS.PANEL, 0.98, 0xffd700, 2);

        const title = this.add.text(0, -90, 'Вас вызвали на бой!', {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this._battleModalName = this.add.text(0, -50, '', {
            fontSize: '24px', fontFamily: 'monospace', color: '#ff4444',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        const runBtn = this._makeButton(-80, 60, 140, 40, '🏃 Убежать', '#636e72',
            () => { this._battleModal.setVisible(false); });
        const fightBtn = this._makeButton(80, 60, 140, 40, '⚔ В бой!', '#27ae60',
            () => { this._battleModal.setVisible(false); this._openFighterSelect(); });

        this._battleModal.add([overlay, bg, title, this._battleModalName, ...runBtn, ...fightBtn]);
    }

    _openBattleModal() {
        this._currentBotName = getRandomBotName();
        const maxLevel = Math.max(...this.mergeField.collection, 1);
        this._currentBotTeam = generateBotTeam(maxLevel);
        this._battleModalName.setText(this._currentBotName);
        this._battleModal.setVisible(true);
    }

    _triggerBotChallenge() {
        if (this._battleModal.visible) return;
        this._openBattleModal();
    }

    // ============================================================
    // Модальное окно — выбор бойцов
    // ============================================================

    _buildFighterSelectModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._fighterModal = this.add.container(W / 2, H / 2).setDepth(200).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -300, -200, 600, 400, 16, CONFIG.COLORS.PANEL, 0.98, 0xffd700, 2);

        const title = this.add.text(0, -175, 'Выберите до 3 бойцов', {
            fontSize: '18px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5);

        this._fighterCards = [];
        this._selectedFighters = new Set();

        const runBtn = this._makeButton(-100, 160, 160, 44, '🏃 Убежать', '#636e72',
            () => { this._fighterModal.setVisible(false); });
        const startBtn = this._makeButton(100, 160, 160, 44, '⚔ Начать бой', '#27ae60',
            () => { this._startBattle(); });

        this._fighterModal.add([overlay, bg, title, ...runBtn, ...startBtn]);
    }

    _openFighterSelect() {
        this._selectedFighters = new Set();
        // Удалить старые карточки
        this._fighterCards.forEach(c => c.forEach(o => o.destroy && o.destroy()));
        this._fighterCards = [];

        const mobs = this.mergeField.getMobsOnField()
            .sort((a, b) => b.mob.atk - a.mob.atk)
            .slice(0, 9); // показываем до 9 сильнейших

        const perRow = 3;
        mobs.forEach((entry, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const x = (col - 1) * 180;
            const y = -130 + row * 130;
            const objs = this._buildFighterCard(x, y, entry, i);
            this._fighterCards.push(objs);
        });

        this._fighterModal.setVisible(true);
    }

    _buildFighterCard(x, y, entry, idx) {
        const { mob } = entry;
        const objs = [];

        const bg = this.add.graphics();
        drawRoundRect(bg, x - 75, y - 60, 150, 120, 10, mob.rarityColor, 0.35, 0xffffff, 1);
        objs.push(bg);

        const emojiTxt = this.add.text(x, y - 20, mob.emoji, { fontSize: '34px' }).setOrigin(0.5);
        objs.push(emojiTxt);

        const nameTxt = this.add.text(x, y + 15, mob.name, {
            fontSize: '8px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 1,
            wordWrap: { width: 140 }
        }).setOrigin(0.5, 0);
        objs.push(nameTxt);

        const atkTxt = this.add.text(x, y + 30, `⚔ ${formatNumber(mob.atk)}`, {
            fontSize: '9px', fontFamily: 'monospace', color: '#ff8888'
        }).setOrigin(0.5, 0);
        objs.push(atkTxt);

        // Галочка выбора
        const checkmark = this.add.text(x + 65, y - 55, '', {
            fontSize: '16px'
        }).setOrigin(0.5);
        objs.push(checkmark);

        // Интерактивность
        const hitArea = this.add.rectangle(x, y, 150, 120, 0xffffff, 0)
            .setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerdown', () => {
            if (this._selectedFighters.has(idx)) {
                this._selectedFighters.delete(idx);
                checkmark.setText('');
                bg.clear();
                drawRoundRect(bg, x - 75, y - 60, 150, 120, 10, mob.rarityColor, 0.35, 0xffffff, 1);
            } else if (this._selectedFighters.size < CONFIG.BATTLE_MAX_FIGHTERS) {
                this._selectedFighters.add(idx);
                checkmark.setText('✅');
                bg.clear();
                drawRoundRect(bg, x - 75, y - 60, 150, 120, 10, 0xffd700, 0.5, 0xffd700, 2);
            }
        });
        objs.push(hitArea);

        // Добавить в модальный контейнер
        this._fighterModal.add(objs);

        this._fighterMobsRef = this._fighterMobsRef || [];
        while (this._fighterMobsRef.length <= idx) this._fighterMobsRef.push(null);
        this._fighterMobsRef[idx] = entry;

        return objs;
    }

    _startBattle() {
        if (this._selectedFighters.size === 0) {
            spawnFloatingText(this, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, 'Выберите бойцов!', '#ff4444');
            return;
        }
        const playerTeam = [...this._selectedFighters].map(i => this._fighterMobsRef[i].mob);
        this._fighterModal.setVisible(false);
        this.scene.start('BattleScene', {
            playerTeam,
            botTeam:  this._currentBotTeam,
            botName:  this._currentBotName,
            economy:  this.economy,   // передаём ссылку
        });
    }

    // ============================================================
    // Утилита: создать кнопку
    // ============================================================

    _makeButton(cx, cy, w, h, label, color, callback) {
        const hex = parseInt(color.replace('#', ''), 16);
        const bg = this.add.graphics();
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h, 8, hex, 1);
        const txt = this.add.text(cx, cy, label, {
            fontSize: '12px', fontFamily: 'monospace',
            color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(1);

        const hitArea = this.add.rectangle(cx, cy, w, h, 0xffffff, 0).setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerover',  () => { bg.setAlpha(0.8); });
        hitArea.on('pointerout',   () => { bg.setAlpha(1); });
        hitArea.on('pointerdown',  () => { this.tweens.add({ targets: [bg, txt], scaleX: 0.95, scaleY: 0.95, duration: 60, yoyo: true }); callback(); });

        return [bg, txt, hitArea];
    }

    // ============================================================
    // Сохранение
    // ============================================================

    _save() {
        const fieldState = this.mergeField.toState();
        this.state.player     = this.economy.toState();
        this.state.field      = fieldState.field;
        this.state.queue      = fieldState.queue;
        this.state.collection = fieldState.collection;
        SaveManager.save(this.state);
    }

    shutdown() {
        this._save();
    }
}
