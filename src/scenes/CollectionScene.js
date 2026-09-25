// ============================================================
// scenes/CollectionScene.js — Бестиарий с 3 Эрами Эволюций
// Вкладки: 1. ОБЫЧНЫЕ | 2. СТИХИЙНЫЕ | 3. ЗОЛОТЫЕ
// Замки, счётчики X/90 и X/30, статус завершения (30/30 ✓)
// ============================================================

class CollectionScene extends Phaser.Scene {
    constructor() { super({ key: 'CollectionScene' }); }

    init(data) {
        this.unlockedSet = new Set(data && data.collection ? data.collection : []);
        this.elementalUnlocked = !!(data && (data.elementalUnlocked || data.elementalEvolutionUnlocked || [...this.unlockedSet].some(lvl => lvl >= 30)));
        this.goldenUnlocked = !!(data && (data.goldenUnlocked || data.goldenEvolutionUnlocked || [...this.unlockedSet].some(lvl => lvl >= 60)));
        this.currentTab = (data && data.initialTab !== undefined) ? data.initialTab : 0; // 0: Ordinary, 1: Elemental, 2: Golden
    }

    create() {
        setupSceneHiDPICamera(this);
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Полупрозрачный темный оверлей
        this.add.rectangle(W / 2, H / 2, W, H, 0x090d16, 0.92);

        // Основная подложка Бестиария
        const bgG = this.add.graphics();
        drawRoundRect(bgG, 18, 10, W - 36, H - 20, 18, 0x020617, 0.70);
        drawRoundRect(bgG, 18, 10, W - 36, H - 20, 18, 0x0f172a, 0.98, 0x334155, 2);

        // Верхняя плашка шапки
        bgG.fillStyle(0x090d16, 0.65);
        bgG.fillRoundedRect(20, 12, W - 40, 58, { tl: 16, tr: 16, bl: 0, br: 0 });
        bgG.lineStyle(1.5, 0x1e293b, 0.85);
        bgG.lineBetween(20, 70, W - 20, 70);

        // 1. Заголовок Бестиария
        createHDText(this, 38, 30, '📖 КУБИЧЕСКИЙ БЕСТИАРИЙ', {
            fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0, 0.5);

        // 2. Глобальный счётчик коллекции (X / 90)
        const totalMobs = 90;
        const totalUnlocked = this.unlockedSet.size;
        const globalProgress = Phaser.Math.Clamp(totalUnlocked / totalMobs, 0, 1);
        const globalPct = Math.round(globalProgress * 100);

        const barX = 330;
        const barY = 22;
        const barW = 340;
        const barH = 20;

        drawCasualProgressBar(bgG, barX, barY, barW, barH, 10, globalProgress, 0x090d16, 0x10b981, 0x059669);

        createHDText(this, barX + barW / 2, barY + barH / 2, `Коллекция: ${totalUnlocked} / ${totalMobs} (${globalPct}%)`, {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#052e16', strokeThickness: 2.5, fontStyle: '900',
        }).setOrigin(0.5, 0.5);

        // 3. Кнопка "✕ Закрыть"
        createCasualButton(this, W - 76, 38, 96, 32, '✕ Закрыть', {
            topColor: 0xef4444,
            bottomColor: 0x991b1b,
            strokeColor: 0xfca5a5,
            fontSize: '12px',
            textColor: '#ffffff',
            radius: 8,
            lip: 3,
        }, () => {
            this.scene.stop();
        });

        // 4. Полоса 3 вкладок эволюций (ОБЫЧНЫЕ, СТИХИЙНЫЕ, ЗОЛОТЫЕ)
        this.tabContainer = this.add.container(0, 0);
        this._buildEvolutionTabs();

        // 5. Контейнер контента карточек с геометрической маской
        const viewY = 114;
        const viewH = H - 128;
        const viewW = W - 40;

        const maskShape = this.make.graphics();
        maskShape.fillRect(20, viewY, viewW, viewH);
        this.contentMask = maskShape.createGeometryMask();

        this.cardsContainer = this.add.container(0, 0);
        this.cardsContainer.setMask(this.contentMask);

        // Интерактивная прокрутка
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            this._scrollBy(deltaY * 0.7);
        });

        let isDragging = false;
        let dragStartY = 0;
        let containerStartY = 0;

        const scrollHitArea = this.add.rectangle(20 + viewW / 2, viewY + viewH / 2, viewW, viewH, 0x000000, 0)
            .setInteractive({ cursor: 'grab' });

        scrollHitArea.on('pointerdown', (ptr) => {
            isDragging = true;
            dragStartY = ptr.y;
            containerStartY = this.cardsContainer.y;
        });

        this.input.on('pointermove', (ptr) => {
            if (!isDragging) return;
            const dy = ptr.y - dragStartY;
            this.cardsContainer.y = containerStartY + dy;
            this._clampScroll();
        });

        this.input.on('pointerup', () => { isDragging = false; });
        this.input.on('pointerout', () => { isDragging = false; });

        // Первоначальный рендер выбранной вкладки
        this._renderCurrentTab();
    }

    _buildEvolutionTabs() {
        this.tabContainer.removeAll(true);
        const W = CONFIG.WIDTH;

        // Подсчёт мобов по каждой эволюции
        let ordCount = 0;
        let elCount = 0;
        let goCount = 0;

        for (let lvl = 1; lvl <= 30; lvl++) {
            if (this.unlockedSet.has(lvl)) ordCount++;
        }
        for (let lvl = 31; lvl <= 60; lvl++) {
            if (this.unlockedSet.has(lvl)) elCount++;
        }
        for (let lvl = 61; lvl <= 90; lvl++) {
            if (this.unlockedSet.has(lvl)) goCount++;
        }

        const tabsConfig = [
            {
                id: 0,
                key: 'ordinary',
                name: 'ОБЫЧНЫЕ',
                count: ordCount,
                total: 30,
                isUnlocked: true,
                color: 0x64748b,
                activeColor: 0x3b82f6,
                label: `1. ОБЫЧНЫЕ ${ordCount}/30${ordCount >= 30 ? ' ✓' : ''}`,
            },
            {
                id: 1,
                key: 'elemental',
                name: 'СТИХИЙНЫЕ',
                count: elCount,
                total: 30,
                isUnlocked: this.elementalUnlocked,
                color: 0x0284c7,
                activeColor: 0x06b6d4,
                label: this.elementalUnlocked
                    ? `2. СТИХИЙНЫЕ ${elCount}/30${elCount >= 30 ? ' ✓' : ''}`
                    : '🔒 2. СТИХИЙНЫЕ',
            },
            {
                id: 2,
                key: 'golden',
                name: 'ЗОЛОТЫЕ',
                count: goCount,
                total: 30,
                isUnlocked: this.goldenUnlocked,
                color: 0xd97706,
                activeColor: 0xf59e0b,
                label: this.goldenUnlocked
                    ? `3. ЗОЛОТЫЕ ${goCount}/30${goCount >= 30 ? ' ✓' : ''}`
                    : '🔒 3. ЗОЛОТЫЕ',
            },
        ];

        const tabW = 270;
        const tabH = 34;
        const startX = (W - (tabsConfig.length * tabW + (tabsConfig.length - 1) * 12)) / 2 + tabW / 2;
        const tabY = 90;

        tabsConfig.forEach((cfg, idx) => {
            const tx = startX + idx * (tabW + 12);
            const isActive = (this.currentTab === cfg.id);

            const tabBg = this.add.graphics();
            const topCol = isActive ? cfg.activeColor : (cfg.isUnlocked ? 0x1e293b : 0x0f172a);
            const botCol = isActive ? darkenColor(cfg.activeColor, 0.35) : 0x090d16;
            const strokeCol = isActive ? 0xffffff : (cfg.isUnlocked ? 0x334155 : 0x1e293b);

            // Тень таба
            tabBg.fillStyle(0x000000, 0.35);
            tabBg.fillRoundedRect(tx - tabW / 2, tabY - tabH / 2 + 2, tabW, tabH, 9);
            // Тело таба
            tabBg.fillStyle(topCol, 0.95);
            tabBg.fillRoundedRect(tx - tabW / 2, tabY - tabH / 2, tabW, tabH, 9);
            tabBg.lineStyle(isActive ? 2 : 1, strokeCol, isActive ? 1 : 0.6);
            tabBg.strokeRoundedRect(tx - tabW / 2, tabY - tabH / 2, tabW, tabH, 9);

            // Текст таба
            const textColor = isActive ? '#ffffff' : (cfg.isUnlocked ? '#94a3b8' : '#64748b');
            const txt = createHDText(this, tx, tabY, cfg.label, {
                fontSize: '13px',
                fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: textColor,
                stroke: '#0f172a',
                strokeThickness: isActive ? 2.5 : 1.5,
                fontStyle: isActive ? '900' : '800',
            }).setOrigin(0.5);

            // Интерактивность таба
            const hit = this.add.rectangle(tx, tabY, tabW, tabH, 0x000000, 0)
                .setInteractive({ cursor: 'pointer' });

            hit.on('pointerdown', () => {
                if (typeof SoundManager !== 'undefined') SoundManager.playClick();
                this.currentTab = cfg.id;
                this._buildEvolutionTabs();
                this._renderCurrentTab();
            });

            this.tabContainer.add([tabBg, txt, hit]);
        });
    }

    _renderCurrentTab() {
        this.cardsContainer.removeAll(true);
        this.cardsContainer.y = 0;
        this.maxScrollY = 0;

        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Проверяем статус блокировки для выбранной вкладки
        if (this.currentTab === 1 && !this.elementalUnlocked) {
            this._renderLockedTabState(
                '⚡ СТИХИЙНАЯ ЭВОЛЮЦИЯ',
                'Дойди до Стихийной эволюции, чтобы открыть эту коллекцию',
                'Получи Древнего Дракона в обычной эволюции (Ур. 30)',
                0x0284c7
            );
            return;
        }

        if (this.currentTab === 2 && !this.goldenUnlocked) {
            this._renderLockedTabState(
                '👑 ЗОЛОТАЯ ЭВОЛЮЦИЯ',
                'Дойди до Золотой эволюции, чтобы открыть эту коллекцию',
                'Заверши Стихийную эволюцию (Ур. 60)',
                0xd97706
            );
            return;
        }

        // Рендерим 30 карточек соответствующей эволюции
        const startLevel = this.currentTab * 30 + 1;
        const endLevel   = startLevel + 29;

        const cols = 5;
        const cardW = 164;
        const cardH = 104;
        const startX = 43;
        const startY = 120;
        const gapX = 14;
        const gapY = 12;

        let totalContentH = startY;

        // Проверяем 100% завершение таба
        let tabUnlockedCount = 0;
        for (let l = startLevel; l <= endLevel; l++) {
            if (this.unlockedSet.has(l)) tabUnlockedCount++;
        }

        if (tabUnlockedCount >= 30) {
            // Баннер завершения эволюции
            const bannerG = this.add.graphics();
            drawRoundRect(bannerG, 43, startY - 4, W - 86, 28, 8, 0x14532d, 0.9, 0x22c55e, 1.5);
            const bannerTxt = createHDText(this, W / 2, startY + 10, '✓ ЭВОЛЮЦИЯ ПОЛНОСТЬЮ СОБРАНА! 30 / 30', {
                fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                color: '#86efac', fontStyle: '900', stroke: '#052e16', strokeThickness: 2
            }).setOrigin(0.5);
            this.cardsContainer.add([bannerG, bannerTxt]);
        }

        const effectiveStartY = (tabUnlockedCount >= 30) ? startY + 34 : startY;

        for (let lvl = startLevel; lvl <= endLevel; lvl++) {
            const mob = getMobByLevel(lvl);
            if (!mob) continue;

            const idx = lvl - startLevel;
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = startX + col * (cardW + gapX);
            const y = effectiveStartY + row * (cardH + gapY);

            totalContentH = Math.max(totalContentH, y + cardH + 16);

            const isUnlocked = this.unlockedSet.has(lvl);
            const rColor = (mob.rarityColor === 0x888888) ? 0x94a3b8 : (mob.rarityColor || 0x64748b);
            const cardG = this.add.graphics();

            if (isUnlocked) {
                // Разблокированная карточка
                drawRoundRect(cardG, x, y + 3, cardW, cardH, 12, 0x020617, 0.45);
                drawRoundRect(cardG, x, y, cardW, cardH, 12, 0x1e293b, 0.95, rColor, 2.2);

                // Верхний мягкий блик редкости
                cardG.fillStyle(rColor, 0.12);
                cardG.fillRoundedRect(x + 2, y + 2, cardW - 4, 34, { tl: 10, tr: 10, bl: 0, br: 0 });

                // Круглый постамент под аватар
                const avX = x + cardW / 2;
                const avY = y + 33;
                cardG.fillStyle(0x0f172a, 0.7);
                cardG.fillCircle(avX, avY, 25);
                cardG.lineStyle(1.5, rColor, 0.75);
                cardG.strokeCircle(avX, avY, 25);

                // Аватарка
                const mobTex = (mob.portraitKey && this.textures.exists(mob.portraitKey))
                    ? mob.portraitKey
                    : ((mob.texture && this.textures.exists(mob.texture)) ? mob.texture : 'mob_portrait_placeholder');
                const avatar = this.add.image(avX, avY, mobTex).setDisplaySize(48, 48);

                // Бейдж уровня (слева вверху)
                drawRoundRect(cardG, x + 5, y + 5, 42, 16, 6, 0x0f172a, 0.85, rColor, 1.2);
                const lvlTxt = createHDText(this, x + 26, y + 13, `Lv.${mob.level}`, {
                    fontSize: '10px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#facc15', fontStyle: '900', stroke: '#0f172a', strokeThickness: 2,
                }).setOrigin(0.5, 0.5);

                // Бейдж эволюции (справа вверху)
                let evoBadgeObj = null;
                if (mob.evolutionTier === 2) {
                    drawRoundRect(cardG, x + cardW - 46, y + 5, 41, 16, 6, 0x082f49, 0.9, 0x38bdf8, 1.2);
                    evoBadgeObj = createHDText(this, x + cardW - 25, y + 13, '✨ ЭЛЕМ', {
                        fontSize: '9px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                        color: '#7dd3fc', fontStyle: '900',
                    }).setOrigin(0.5, 0.5);
                } else if (mob.evolutionTier === 3) {
                    drawRoundRect(cardG, x + cardW - 46, y + 5, 41, 16, 6, 0x451a03, 0.9, 0xf59e0b, 1.2);
                    evoBadgeObj = createHDText(this, x + cardW - 25, y + 13, '👑 GOLD', {
                        fontSize: '9px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                        color: '#fde047', fontStyle: '900',
                    }).setOrigin(0.5, 0.5);
                }

                // Имя моба
                const nameTxt = createHDText(this, avX, y + 65, mob.name, {
                    fontSize: '11.5px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#ffffff', stroke: '#0f172a', strokeThickness: 3, fontStyle: '800',
                    wordWrap: { width: cardW - 10 }
                }).setOrigin(0.5, 0.5);

                // Бейдж урона
                drawRoundRect(cardG, avX - 38, y + 80, 76, 17, 7, 0x14532d, 0.85, 0x22c55e, 1.2);
                const atkTxt = createHDText(this, avX, y + 88, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#4ade80', stroke: '#052e16', strokeThickness: 2, fontStyle: '900',
                }).setOrigin(0.5, 0.5);

                // Интерактивный клик с упругим сочным сквишем
                const cardHit = this.add.rectangle(avX, y + cardH / 2, cardW, cardH, 0, 0).setInteractive({ cursor: 'pointer' });
                cardHit.on('pointerdown', () => {
                    if (typeof SoundManager !== 'undefined') SoundManager.playClink();
                    this.tweens.add({
                        targets: avatar,
                        scaleX: 1.22,
                        scaleY: 0.82,
                        duration: 75,
                        yoyo: true,
                        ease: 'Quad.Out',
                        onComplete: () => { if (avatar) avatar.setScale(1.0); }
                    });
                });

                const elements = [cardG, avatar, lvlTxt, nameTxt, atkTxt, cardHit];
                if (evoBadgeObj) elements.push(evoBadgeObj);
                this.cardsContainer.add(elements);

            } else {
                // Заблокированная карточка в открытой эволюции
                drawRoundRect(cardG, x, y + 2, cardW, cardH, 12, 0x020617, 0.35);
                drawRoundRect(cardG, x, y, cardW, cardH, 12, 0x090d16, 0.85, 0x1e293b, 1.5);

                const avX = x + cardW / 2;
                const avY = y + 33;
                cardG.fillStyle(0x020617, 0.85);
                cardG.fillCircle(avX, avY, 25);
                cardG.lineStyle(1.5, 0x334155, 0.4);
                cardG.strokeCircle(avX, avY, 25);

                const lockIcon = createHDText(this, avX, avY, '🔒', { fontSize: '20px' }).setOrigin(0.5, 0.5);

                drawRoundRect(cardG, x + 5, y + 5, 42, 16, 6, 0x090d16, 0.9, 0x334155, 1);
                const lvlTxt = createHDText(this, x + 26, y + 13, `Lv.${mob.level}`, {
                    fontSize: '10px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#64748b', fontStyle: '800',
                }).setOrigin(0.5, 0.5);

                const unknownTxt = createHDText(this, avX, y + 68, '???', {
                    fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#475569', fontStyle: '900',
                }).setOrigin(0.5, 0.5);

                this.cardsContainer.add([cardG, lockIcon, lvlTxt, unknownTxt]);
            }
        }

        const viewH = H - 128;
        const maxScroll = Math.max(0, totalContentH - (114 + viewH));
        this.maxScrollY = -maxScroll;
    }

    _renderLockedTabState(title, desc1, desc2, themeColor) {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        const cardW = 460;
        const cardH = 220;
        const cx = W / 2;
        const cy = 114 + (H - 128) / 2;

        const lockCard = this.add.graphics();
        // Внешняя тень
        drawRoundRect(lockCard, cx - cardW / 2, cy - cardH / 2 + 4, cardW, cardH, 16, 0x020617, 0.5);
        // Основа
        drawRoundRect(lockCard, cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16, 0x0f172a, 0.98, themeColor, 2);

        // Иконка замка
        const lockIcon = createHDText(this, cx, cy - 50, '🔒', { fontSize: '38px' }).setOrigin(0.5);

        // Заголовок
        const titleTxt = createHDText(this, cx, cy - 6, title, {
            fontSize: '17px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#f8fafc', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900'
        }).setOrigin(0.5);

        // Описание требования
        const d1Txt = createHDText(this, cx, cy + 28, desc1, {
            fontSize: '12.5px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#94a3b8', fontStyle: '800', align: 'center'
        }).setOrigin(0.5);

        const d2Txt = createHDText(this, cx, cy + 54, `🎯 ${desc2}`, {
            fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#38bdf8', fontStyle: '900', align: 'center'
        }).setOrigin(0.5);

        this.cardsContainer.add([lockCard, lockIcon, titleTxt, d1Txt, d2Txt]);
    }

    _scrollBy(delta) {
        this.cardsContainer.y = Phaser.Math.Clamp(this.cardsContainer.y - delta, this.maxScrollY, 0);
    }

    _clampScroll() {
        this.cardsContainer.y = Phaser.Math.Clamp(this.cardsContainer.y, this.maxScrollY, 0);
    }
}
