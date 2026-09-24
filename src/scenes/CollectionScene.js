// ============================================================
// scenes/CollectionScene.js — Бестиарий (коллекция всех мобов)
// Casual UI Redesign: Rarity borders, collection progress bar,
// 3D casual cards, mysterious locked states, tactile scroll.
// ============================================================

class CollectionScene extends Phaser.Scene {
    constructor() { super({ key: 'CollectionScene' }); }

    init(data) {
        this.unlockedSet = new Set(data && data.collection ? data.collection : []);
    }

    create() {
        setupSceneHiDPICamera(this);
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Полупрозрачный темный фон
        this.add.rectangle(W / 2, H / 2, W, H, 0x090d16, 0.90);

        // Основное окно
        const bgG = this.add.graphics();
        // Внешняя тень окна
        drawRoundRect(bgG, 18, 10, W - 36, H - 20, 18, 0x020617, 0.65);
        // Основа панели
        drawRoundRect(bgG, 18, 10, W - 36, H - 20, 18, 0x0f172a, 0.98, 0x334155, 2);

        // Верхняя плашка шапки
        bgG.fillStyle(0x090d16, 0.55);
        bgG.fillRoundedRect(20, 12, W - 40, 58, { tl: 16, tr: 16, bl: 0, br: 0 });
        bgG.lineStyle(1.5, 0x1e293b, 0.8);
        bgG.lineBetween(20, 70, W - 20, 70);

        // 1. Заголовок
        createHDText(this, 42, 33, '📖 БЕСТИАРИЙ', {
            fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#0f172a', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0, 0.5);

        createHDText(this, 42, 51, 'Коллекция персонажей', {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#94a3b8', fontStyle: '800',
        }).setOrigin(0, 0.5);

        // 2. Прогресс-бар коллекции
        const totalMobs = (typeof MOBS !== 'undefined' && MOBS.length) ? MOBS.length : (CONFIG.MOB_LEVELS || 90);
        const unlockedCount = this.unlockedSet.size;
        const progressRatio = totalMobs > 0 ? Phaser.Math.Clamp(unlockedCount / totalMobs, 0, 1) : 0;
        const pct = Math.round(progressRatio * 100);

        const barX = 260;
        const barY = 30;
        const barW = 400;
        const barH = 22;

        // drawCasualProgressBar: (graphics, x, y, w, h, r, progress, bgColor, fillColor, borderColor)
        drawCasualProgressBar(bgG, barX, barY, barW, barH, 11, progressRatio, 0x090d16, 0x10b981, 0x059669);

        // Текст на прогресс-баре
        createHDText(this, barX + barW / 2, barY + barH / 2, `✨ Открыто: ${unlockedCount} / ${totalMobs} (${pct}%) ✨`, {
            fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffffff', stroke: '#052e16', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0.5, 0.5);

        // 3. Тактильная 3D кнопка Закрыть
        createCasualButton(this, W - 80, 41, 104, 32, '✕ Закрыть', {
            topColor: 0xef4444,
            bottomColor: 0x991b1b,
            strokeColor: 0xfca5a5,
            fontSize: '13px',
            textColor: '#ffffff',
        }, () => {
            this.scene.stop();
        });

        // 4. Область прокрутки карточек
        const viewY = 76;
        const viewH = H - 94;
        const viewW = W - 40;

        const maskShape = this.make.graphics();
        maskShape.fillRect(20, viewY, viewW, viewH);
        const mask = maskShape.createGeometryMask();

        this.cardsContainer = this.add.container(0, 0);
        this.cardsContainer.setMask(mask);

        // Сетка мобов: 5 колонок × 18 рядов (90 мобов)
        const cols = 5;
        const cardW = 164;
        const cardH = 102;
        const startX = 43;
        const startY = viewY + 10;
        const gapX = 14;
        const gapY = 12;
        let totalContentH = 0;

        const mobList = (typeof MOBS !== 'undefined' && MOBS.length) ? MOBS : [];

        mobList.forEach((mob, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);
            totalContentH = Math.max(totalContentH, y + cardH + 16);

            const isUnlocked = this.unlockedSet.has(mob.level);
            // Если серый (0x888888), делаем благородный серебристый 0x94a3b8
            const rColor = (mob.rarityColor === 0x888888) ? 0x94a3b8 : (mob.rarityColor || 0x64748b);

            const cardG = this.add.graphics();

            if (isUnlocked) {
                // Тень карточки
                drawRoundRect(cardG, x, y + 3, cardW, cardH, 12, 0x020617, 0.45);
                // Тело карточки с обводкой в цвет редкости
                drawRoundRect(cardG, x, y, cardW, cardH, 12, 0x1e293b, 0.95, rColor, 2.2);

                // Верхний мягкий блик редкости
                cardG.fillStyle(rColor, 0.12);
                cardG.fillRoundedRect(x + 2, y + 2, cardW - 4, 34, { tl: 10, tr: 10, bl: 0, br: 0 });

                // Круглый постамент под аватар
                const avX = x + cardW / 2;
                const avY = y + 32;
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
                const lvl = createHDText(this, x + 26, y + 13, `Lv.${mob.level}`, {
                    fontSize: '10px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#facc15', fontStyle: '900', stroke: '#0f172a', strokeThickness: 2,
                }).setOrigin(0.5, 0.5);

                // Бейдж тира (справа вверху, если Золотой или Алмазный)
                let tierTextObj = null;
                if (mob.tier === 2) {
                    drawRoundRect(cardG, x + cardW - 43, y + 5, 38, 16, 6, 0x78350f, 0.85, 0xf59e0b, 1.2);
                    tierTextObj = createHDText(this, x + cardW - 24, y + 13, '⭐ GOLD', {
                        fontSize: '9px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                        color: '#fef08a', fontStyle: '900',
                    }).setOrigin(0.5, 0.5);
                } else if (mob.tier === 3) {
                    drawRoundRect(cardG, x + cardW - 47, y + 5, 42, 16, 6, 0x164e63, 0.85, 0x06b6d4, 1.2);
                    tierTextObj = createHDText(this, x + cardW - 26, y + 13, '💎 DIA', {
                        fontSize: '9px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                        color: '#67e8f9', fontStyle: '900',
                    }).setOrigin(0.5, 0.5);
                }

                // Имя моба
                const name = createHDText(this, avX, y + 63, mob.name, {
                    fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#ffffff', stroke: '#0f172a', strokeThickness: 3, fontStyle: '800',
                    wordWrap: { width: cardW - 10 }
                }).setOrigin(0.5, 0.5);

                // Бейдж урона
                drawRoundRect(cardG, avX - 38, y + 78, 76, 17, 7, 0x14532d, 0.8, 0x22c55e, 1.2);
                const atk = createHDText(this, avX, y + 86, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#4ade80', stroke: '#052e16', strokeThickness: 2, fontStyle: '900',
                }).setOrigin(0.5, 0.5);

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
                        onComplete: () => {
                            if (avatar) avatar.setScale(1.0);
                        }
                    });
                });

                const cardElements = [cardG, avatar, lvl, name, atk, cardHit];
                if (tierTextObj) cardElements.push(tierTextObj);
                this.cardsContainer.add(cardElements);
            } else {
                // Заблокированная карточка (Mysterious silhouette)
                drawRoundRect(cardG, x, y + 2, cardW, cardH, 12, 0x020617, 0.35);
                drawRoundRect(cardG, x, y, cardW, cardH, 12, 0x090d16, 0.85, 0x1e293b, 1.5);

                // Круглая темная подложка
                const avX = x + cardW / 2;
                const avY = y + 36;
                cardG.fillStyle(0x050811, 0.9);
                cardG.fillCircle(avX, avY, 22);
                cardG.lineStyle(1.5, 0x334155, 0.6);
                cardG.strokeCircle(avX, avY, 22);

                // Иконка замка
                const lock = createHDText(this, avX, avY, '🔒', { fontSize: '20px' }).setOrigin(0.5, 0.5);

                // Загадочное имя
                const mystery = createHDText(this, avX, y + 66, '???', {
                    fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#64748b', stroke: '#020617', strokeThickness: 2, fontStyle: '800',
                }).setOrigin(0.5, 0.5);

                // Требуемый уровень
                drawRoundRect(cardG, avX - 30, y + 78, 60, 16, 6, 0x1e293b, 0.6, 0x334155, 1);
                const reqLvl = createHDText(this, avX, y + 86, `Lv.${mob.level}`, {
                    fontSize: '10px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
                    color: '#94a3b8', fontStyle: '800',
                }).setOrigin(0.5, 0.5);

                this.cardsContainer.add([cardG, lock, mystery, reqLvl]);
            }
        });

        // 5. Логика скролла и казуальный индикатор (скроллбар)
        const minScrollY = Math.min(0, viewH - (totalContentH - viewY));
        let scrollY = 0;
        let isDragging = false;
        let startDragY = 0;
        let startContainerY = 0;

        // Полоса трека скроллбара
        const sbTrackX = W - 28;
        const sbTrackY = viewY + 6;
        const sbTrackW = 5;
        const sbTrackH = viewH - 12;

        const sbG = this.add.graphics();
        sbG.fillStyle(0x1e293b, 0.5);
        sbG.fillRoundedRect(sbTrackX, sbTrackY, sbTrackW, sbTrackH, 2.5);

        // Бегунок скроллбара
        const thumbH = Math.max(32, Math.round((viewH / Math.max(viewH, totalContentH - viewY)) * sbTrackH));
        const thumbMaxTravel = sbTrackH - thumbH;

        const thumbG = this.add.graphics();
        const drawThumb = (scrollVal) => {
            thumbG.clear();
            const ratio = minScrollY < 0 ? Phaser.Math.Clamp(scrollVal / minScrollY, 0, 1) : 0;
            const thumbY = sbTrackY + ratio * thumbMaxTravel;
            thumbG.fillStyle(0x38bdf8, 0.75);
            thumbG.fillRoundedRect(sbTrackX, thumbY, sbTrackW, thumbH, 2.5);
        };
        drawThumb(0);

        const updateScroll = (newY) => {
            scrollY = Phaser.Math.Clamp(newY, minScrollY, 0);
            this.cardsContainer.y = scrollY;
            drawThumb(scrollY);
        };

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            updateScroll(scrollY - deltaY * 0.7);
        });

        this.input.on('pointerdown', (pointer) => {
            const py = (pointer.worldY !== undefined) ? pointer.worldY : pointer.y;
            if (py >= viewY && py <= viewY + viewH) {
                isDragging = true;
                startDragY = py;
                startContainerY = scrollY;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (isDragging) {
                const py = (pointer.worldY !== undefined) ? pointer.worldY : pointer.y;
                const delta = py - startDragY;
                updateScroll(startContainerY + delta);
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
        });

        this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
    }
}
