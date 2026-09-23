// ============================================================
// scenes/GameScene.js — главный экран: свободное поле, кликер, комбо x1-x5, магазин
// ============================================================

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    init() {
        this.state    = SaveManager.load();
        this.economy  = new Economy(this.state);

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

        // При успешном слиянии обновляем магазин (если открылся новый уровень)
        this.mergeField.onMergeSuccess = () => {
            this._updateShopButton();
            this._updateLeftStatusCard();
        };

        // ─── 3. Верхняя панель (уровень, комбо-шкала x1-x5, монеты) ───
        this._buildTopBar();

        // ─── 4. Правая панель (покупка за монеты и моб за рекламу) ───
        this._buildRightShop();

        // ─── 5. Левая карточка статуса (лучший моб и счетчик) ───
        this._buildLeftStatusCard();

        // ─── 6. Нижняя панель (Коллекция, Инкубатор, Награды, В бой!) ───
        this._buildBottomBar();

        // ─── 7. Модальные окна (вызов на бой и выбор команды) ───
        this._buildBattleModal();
        this._buildFighterSelectModal();

        // ─── 8. Привязка событий экономики к UI ───
        this.economy.onCoinsChange = (val) => this._setCoinsText(val);
        this.economy.onLevelChange = (lvl) => {
            if (this._levelText) this._levelText.setText(`Уровень ${lvl}`);
        };

        // ─── 9. Редкий вызов на бой от ботов (раз в 90 сек) ───
        this.time.addEvent({
            delay: CONFIG.BOT_CHALLENGE_INTERVAL,
            loop: true,
            callback: () => {
                if (this.mergeField.mobs.length > 0 && !this._battleModal.visible && !this._fighterModal.visible) {
                    this._openBattleModal();
                }
            },
        });

        // ─── 10. Автосохранение каждые 30 сек ───
        this.time.addEvent({
            delay: 30000,
            loop: true,
            callback: this._save,
            callbackScope: this,
        });

        // ─── 11. Пауза при сворачивании (для Яндекс Игр) ───
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

        // Небо
        const sky = this.add.graphics();
        sky.fillGradientStyle(0x73c9f7, 0x73c9f7, 0xb8e3fa, 0xb8e3fa, 1);
        sky.fillRect(0, 0, W, H / 2);

        // Зеленые холмы и лесная поляна
        const ground = this.add.graphics();
        ground.fillGradientStyle(0x56a635, 0x56a635, 0x3d7b23, 0x3d7b23, 1);
        ground.fillRect(0, H / 3, W, H * 2 / 3);

        // Стилизованные деревья на заднем плане
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
    // Верхняя панель (Уровень, Комбо-шкала x1-x5, Баланс)
    // ============================================================

    _buildTopBar() {
        const W = CONFIG.WIDTH;

        // 1. Уровень игрока (слева)
        const lvlBg = this.add.graphics();
        drawRoundRect(lvlBg, 16, 12, 140, 42, 10, 0xffffff, 0.9, 0xdddddd, 2);
        this._levelText = this.add.text(86, 33, `Уровень ${this.economy.level}`, {
            fontSize: '15px',
            fontFamily: 'monospace',
            color: '#333333',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // 2. Кнопка "Бесплатные мобы"
        this._freeBtn = this._makeButton(245, 33, 150, 42, '🎁 Бесплатно', '#27ae60', () => {
            this._onFreeSpawn();
        });

        // 3. Комбо-шкала множителя (центр: x1 x2 x3 x4 x5)
        this._buildComboBar(340, 18, 230, 30);

        // 4. Баланс изумрудов (справа)
        const coinBg = this.add.graphics();
        drawRoundRect(coinBg, W - 180, 12, 164, 42, 10, 0xffffff, 0.95, 0xdddddd, 2);

        this.add.text(W - 165, 33, '💎', { fontSize: '20px' }).setOrigin(0.5);
        this._coinsText = this.add.text(W - 25, 33, `${formatNumber(this.economy.coins)}`, {
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#2e7d32',
            fontStyle: 'bold',
        }).setOrigin(1, 0.5);
    }

    _buildComboBar(x, y, w, h) {
        this.comboX = x;
        this.comboY = y;
        this.comboW = w;
        this.comboH = h;

        // Рамка шкалы
        this.comboBg = this.add.graphics();
        drawRoundRect(this.comboBg, x, y, w, h, 8, 0x5a3e1b, 0.9, 0xffd700, 2);

        // Заполнение шкалы
        this.comboFill = this.add.graphics();

        // Подписи множителей: x1, x2, x3, x4, x5
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

        // Вычисляем текущий множитель
        let mul = 1;
        if (this.comboGauge >= 80) mul = 5;
        else if (this.comboGauge >= 60) mul = 4;
        else if (this.comboGauge >= 40) mul = 3;
        else if (this.comboGauge >= 20) mul = 2;
        else mul = 1;

        this.currentMultiplier = mul;

        // Подсвечиваем активный множитель
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

        // 1. Увеличиваем шкалу комбо
        this.comboGauge = Math.min(100, this.comboGauge + CONFIG.COMBO_GAIN_PER_CLICK);
        this._redrawComboBar();

        // 2. Рассчитываем награду от клика с учетом текущего множителя
        const reward = Math.max(1, Math.floor(mob.atk * CONFIG.CLICK_REWARD_RATIO * this.currentMultiplier));
        this.economy.addCoins(reward);

        // 3. Всплывающий текст награды
        const clickX = mobItem.container.x;
        const clickY = mobItem.container.y - 45;
        const mulBadge = this.currentMultiplier > 1 ? ` (x${this.currentMultiplier})` : '';
        spawnFloatingText(this, clickX, clickY, `+${formatNumber(reward)} 💎${mulBadge}`, '#5dff6e');
    }

    // Обновление таймера и затухания комбо-шкалы каждый кадр
    update(time, delta) {
        if (this.comboGauge > 0) {
            const decay = (CONFIG.COMBO_DECAY_PER_SEC * delta) / 1000;
            this.comboGauge = Math.max(0, this.comboGauge - decay);
            this._redrawComboBar();
        }
    }

    // ============================================================
    // Левая карточка статуса
    // ============================================================

    _buildLeftStatusCard() {
        this._leftCardGroup = [];
        this._updateLeftStatusCard();
    }

    _updateLeftStatusCard() {
        this._leftCardGroup.forEach(item => item.destroy && item.destroy());
        this._leftCardGroup = [];

        const x = 50;
        const y = 110;
        const w = 90;
        const h = 100;

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const topMob = getMobByLevel(maxUnlocked);

        const bg = this.add.graphics();
        drawRoundRect(bg, x - w / 2, y - h / 2, w, h, 12, 0xffffff, 0.9, 0xffd700, 2);
        this._leftCardGroup.push(bg);

        if (topMob) {
            const emoji = this.add.text(x, y - 10, topMob.emoji, { fontSize: '42px' }).setOrigin(0.5);
            const countBadge = this.add.graphics();
            drawRoundRect(countBadge, x - 35, y + 25, 70, 18, 6, 0xffd700, 0.9);
            const countText = this.add.text(x, y + 34, `${this.mergeField.mobs.length} шт`, {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#333333',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            this._leftCardGroup.push(emoji, countBadge, countText);
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

        const cardX = W - 75;
        const cardY = 135;
        const cardSize = 110;

        const bg1 = this.add.graphics();
        drawRoundRect(bg1, cardX - cardSize / 2, cardY - cardSize / 2, cardSize, cardSize, 16, 0xffffff, 0.92, 0x4aa3df, 3);
        this._shopUiGroup.push(bg1);

        if (buyMob) {
            const mobImg = this.add.text(cardX, cardY - 14, buyMob.emoji, {
                fontSize: '46px',
            }).setOrigin(0.5);

            // Кнопка с ценой снизу
            const priceBg = this.add.graphics();
            drawRoundRect(priceBg, cardX - cardSize / 2 + 6, cardY + cardSize / 2 - 28, cardSize - 12, 22, 6, 0xffd700, 1);

            const priceText = this.add.text(cardX, cardY + cardSize / 2 - 17, `💎 ${formatNumber(cost)}`, {
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#333333',
                fontStyle: 'bold',
            }).setOrigin(0.5);

            const hitArea1 = this.add.rectangle(cardX, cardY, cardSize, cardSize, 0, 0)
                .setInteractive({ cursor: 'pointer' });

            hitArea1.on('pointerdown', () => this._onBuyMob(buyMob, cost));

            this._shopUiGroup.push(mobImg, priceBg, priceText, hitArea1);
        }

        // 2. Слот 2: Моб за рекламу — ПО ТРЕБОВАНИЮ: на 1 уровень ниже максимального!
        const adMobLevel = Math.max(1, maxUnlocked - CONFIG.AD_LEVEL_OFFSET);
        const adMob      = getMobByLevel(adMobLevel);

        const cardY2 = 265;
        const bg2 = this.add.graphics();
        drawRoundRect(bg2, cardX - cardSize / 2, cardY2 - cardSize / 2, cardSize, cardSize, 16, 0xffffff, 0.92, 0x4aa3df, 3);
        this._shopUiGroup.push(bg2);

        if (adMob) {
            const mobImg2 = this.add.text(cardX, cardY2 - 14, adMob.emoji, {
                fontSize: '46px',
            }).setOrigin(0.5);

            const adBg = this.add.graphics();
            drawRoundRect(adBg, cardX - cardSize / 2 + 6, cardY2 + cardSize / 2 - 28, cardSize - 12, 22, 6, 0x8e44ad, 1);

            const adText = this.add.text(cardX, cardY2 + cardSize / 2 - 17, '📺 Реклама', {
                fontSize: '10px',
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
        // Выдаем моба на 1 уровень ниже максимального
        const spawned = this.mergeField.spawnMob(mob.level);
        if (spawned) {
            spawnFloatingText(this, spawned.x, spawned.y - 40, `🎁 +${mob.emoji} ${mob.name}!`, '#ffd700');
        }
        this._updateLeftStatusCard();
    }

    _onFreeSpawn() {
        const now = Date.now();
        if (this.state.freeSpawnTime > now) {
            const leftSec = Math.ceil((this.state.freeSpawnTime - now) / 1000);
            spawnFloatingText(this, 245, 65, `Подождите ${leftSec}с`, '#ff4444');
            return;
        }

        const maxUnlocked = Math.max(...this.mergeField.collection, 1);
        const freeLevel = Math.max(1, maxUnlocked - 2);

        this.mergeField.spawnMob(freeLevel);
        this.state.freeSpawnTime = now + CONFIG.FREE_MOB_COOLDOWN;

        spawnFloatingText(this, 245, 65, '🎁 Моб получен!', '#5dff6e');
        this._updateLeftStatusCard();
    }

    // ============================================================
    // Нижняя панель
    // ============================================================

    _buildBottomBar() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const g = this.add.graphics();
        drawRoundRect(g, 0, H - 58, W, 58, 0, 0x16213e, 0.95);

        this._makeButton(110, H - 29, 150, 40, '📖 Коллекция', '#34495e',
            () => this.scene.launch('CollectionScene', { collection: [...this.mergeField.collection] }));

        this._makeButton(280, H - 29, 150, 40, '🥚 Инкубатор', '#34495e',
            () => spawnFloatingText(this, 280, H - 80, 'Скоро!', '#ffd700'));

        this._makeButton(450, H - 29, 150, 40, '🏆 Награды', '#34495e',
            () => spawnFloatingText(this, 450, H - 80, 'Скоро!', '#ffd700'));

        // Большая красная кнопка В БОЙ
        this._makeButton(W - 110, H - 29, 170, 44, '⚔ В БОЙ!', '#c0392b', () => {
            if (this.mergeField.mobs.length === 0) {
                spawnFloatingText(this, W - 110, H - 80, 'Купите бойцов!', '#ff4444');
                return;
            }
            this._openBattleModal();
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

        const runBtn = this._makeButton(-80, 55, 130, 42, 'Убежать', '#747d8c',
            () => { this._battleModal.setVisible(false); });
        const fightBtn = this._makeButton(80, 55, 130, 42, 'В бой!', '#2ed573',
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

    _buildFighterSelectModal() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        this._fighterModal = this.add.container(W / 2, H / 2).setDepth(300).setVisible(false);

        const overlay = this.add.rectangle(0, 0, W, H, 0x000000, 0.65).setInteractive();
        const bg = this.add.graphics();
        drawRoundRect(bg, -300, -200, 600, 400, 16, 0x16213e, 0.98, 0xffd700, 2);

        const title = this.add.text(0, -170, 'Выберите до 3 мобов для боя', {
            fontSize: '18px', fontFamily: 'monospace', color: '#ffd700',
            stroke: '#000', strokeThickness: 2, fontStyle: 'bold',
        }).setOrigin(0.5);

        this._fighterCards = [];
        this._selectedFighters = new Set();

        const runBtn = this._makeButton(-100, 165, 150, 42, 'Убежать', '#747d8c',
            () => { this._fighterModal.setVisible(false); });
        const startBtn = this._makeButton(100, 165, 150, 42, 'Начать бой', '#2ed573',
            () => { this._startBattle(); });

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
            const x = (col - 1) * 180;
            const y = -120 + row * 115;
            const objs = this._buildFighterCard(x, y, entry, i);
            this._fighterCards.push(objs);
        });

        this._fighterModal.setVisible(true);
    }

    _buildFighterCard(x, y, entry, idx) {
        const { mob } = entry;
        const objs = [];

        const bg = this.add.graphics();
        drawRoundRect(bg, x - 75, y - 50, 150, 100, 10, mob.rarityColor, 0.4, 0xffffff, 1);
        objs.push(bg);

        const emojiTxt = this.add.text(x, y - 18, mob.emoji, { fontSize: '32px' }).setOrigin(0.5);
        objs.push(emojiTxt);

        const nameTxt = this.add.text(x, y + 12, mob.name, {
            fontSize: '9px', fontFamily: 'monospace', color: '#fff', stroke: '#000', strokeThickness: 1,
            wordWrap: { width: 140 }
        }).setOrigin(0.5, 0);
        objs.push(nameTxt);

        const atkTxt = this.add.text(x, y + 26, `⚔ ${formatNumber(mob.atk)}`, {
            fontSize: '9px', fontFamily: 'monospace', color: '#ff8888', fontStyle: 'bold'
        }).setOrigin(0.5, 0);
        objs.push(atkTxt);

        const checkmark = this.add.text(x + 65, y - 45, '', { fontSize: '16px' }).setOrigin(0.5);
        objs.push(checkmark);

        const hitArea = this.add.rectangle(x, y, 150, 100, 0, 0).setInteractive({ cursor: 'pointer' });
        hitArea.on('pointerdown', () => {
            if (this._selectedFighters.has(idx)) {
                this._selectedFighters.delete(idx);
                checkmark.setText('');
                bg.clear();
                drawRoundRect(bg, x - 75, y - 50, 150, 100, 10, mob.rarityColor, 0.4, 0xffffff, 1);
            } else if (this._selectedFighters.size < CONFIG.BATTLE_MAX_FIGHTERS) {
                this._selectedFighters.add(idx);
                checkmark.setText('✅');
                bg.clear();
                drawRoundRect(bg, x - 75, y - 50, 150, 100, 10, 0xffd700, 0.6, 0xffd700, 2);
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

        this.scene.start('BattleScene', {
            playerTeam,
            botTeam: this._currentBotTeam,
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

    _makeButton(cx, cy, w, h, label, color, callback) {
        const hex = parseInt(color.replace('#', ''), 16);
        const bg = this.add.graphics();
        drawRoundRect(bg, cx - w / 2, cy - h / 2, w, h, 8, hex, 1);

        const txt = this.add.text(cx, cy, label, {
            fontSize: '13px', fontFamily: 'monospace',
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
        this.state.player     = this.economy.toState();
        this.state.field      = fieldState.field;
        this.state.collection = fieldState.collection;
        SaveManager.save(this.state);
    }

    shutdown() {
        this._save();
    }
}
