// ============================================================
// scenes/CollectionScene.js — Бестиарий (коллекция всех мобов)
// ============================================================

class CollectionScene extends Phaser.Scene {
    constructor() { super({ key: 'CollectionScene' }); }

    init(data) {
        this.unlockedSet = new Set(data.collection || []);
    }

    create() {
        const W = CONFIG.WIDTH;
        const H = CONFIG.HEIGHT;

        // Фон
        this.add.rectangle(W / 2, H / 2, W, H, 0x090d16, 0.92);

        // Панель
        const g = this.add.graphics();
        drawRoundRect(g, 20, 10, W - 40, H - 20, 16, 0x162032, 0.98, 0x38bdf8, 2);

        // Заголовок
        createHDText(this, W / 2, 26, '📖 Кубический Бестиарий', {
            fontSize: '22px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#ffd700', stroke: '#111625', strokeThickness: 3, fontStyle: '900',
        }).setOrigin(0.5, 0);

        // Счётчик
        const unlocked = this.unlockedSet.size;
        createHDText(this, W / 2, 54, `Открыто: ${unlocked} / ${CONFIG.MOB_LEVELS}`, {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#94a3b8', fontStyle: '800',
        }).setOrigin(0.5, 0);

        // Контейнер с маской для плавной вертикальной прокрутки
        const viewY = 82;
        const viewH = H - 98;
        const viewW = W - 40;

        const maskShape = this.make.graphics();
        maskShape.fillRect(20, viewY, viewW, viewH);
        const mask = maskShape.createGeometryMask();

        this.cardsContainer = this.add.container(0, 0);
        this.cardsContainer.setMask(mask);

        // Сетка мобов (5 колонок × 6 рядов, удобно под прокрутку)
        const cols = 5;
        const cardW = 160, cardH = 95;
        const startX = 55, startY = viewY + 10;
        let totalContentH = 0;

        MOBS.forEach((mob, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + 12);
            const y = startY + row * (cardH + 12);
            totalContentH = Math.max(totalContentH, y + cardH + 20);

            const isUnlocked = this.unlockedSet.has(mob.level);

            const bg = this.add.graphics();
            drawRoundRect(bg, x, y, cardW, cardH, 12,
                isUnlocked ? mob.rarityColor : 0x1e293b, isUnlocked ? 0.35 : 0.6,
                isUnlocked ? mob.rarityColor : 0x334155, 1.5);

            if (isUnlocked) {
                const mobTex = (mob.portraitKey && this.textures.exists(mob.portraitKey))
                    ? mob.portraitKey
                    : (mob.texture || 'mob_portrait_placeholder');
                const avatar = this.add.image(x + cardW / 2, y + 26, mobTex).setDisplaySize(48, 48);
                const name = createHDText(this, x + cardW / 2, y + 54, mob.name, {
                    fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#fff',
                    stroke: '#111625', strokeThickness: 2, fontStyle: '800', wordWrap: { width: cardW - 8 }
                }).setOrigin(0.5, 0);
                const atk = createHDText(this, x + cardW / 2, y + 72, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#4ade80', fontStyle: '800'
                }).setOrigin(0.5, 0);
                const lvl = createHDText(this, x + 8, y + 6, `Lv.${mob.level}`, {
                    fontSize: '11px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#facc15', fontStyle: '900'
                });
                this.cardsContainer.add([bg, avatar, name, atk, lvl]);
            } else {
                const lock = createHDText(this, x + cardW / 2, y + cardH / 2 - 10, '🔒', { fontSize: '28px' }).setOrigin(0.5);
                const lvl = createHDText(this, x + cardW / 2, y + cardH / 2 + 18, `Lv.${mob.level}`, {
                    fontSize: '12px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif", color: '#64748b', fontStyle: '800'
                }).setOrigin(0.5);
                this.cardsContainer.add([bg, lock, lvl]);
            }
        });

        // Логика прокрутки (колёсико мыши + свайп/перетаскивание пальцем)
        const minScrollY = Math.min(0, viewH - (totalContentH - viewY));
        let scrollY = 0;
        let isDragging = false;
        let startDragY = 0;
        let startContainerY = 0;

        const updateScroll = (newY) => {
            scrollY = Phaser.Math.Clamp(newY, minScrollY, 0);
            this.cardsContainer.y = scrollY;
        };

        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            updateScroll(scrollY - deltaY * 0.7);
        });

        this.input.on('pointerdown', (pointer) => {
            if (pointer.y >= viewY && pointer.y <= viewY + viewH) {
                isDragging = true;
                startDragY = pointer.y;
                startContainerY = scrollY;
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (isDragging) {
                const delta = pointer.y - startDragY;
                updateScroll(startContainerY + delta);
            }
        });

        this.input.on('pointerup', () => {
            isDragging = false;
        });

        // Кнопка закрыть
        const [bbg, btxt, bhit] = this._makeBtn(W - 85, 28, '✕ Закрыть', () => {
            this.scene.stop();
        });

        this.input.keyboard.on('keydown-ESC', () => this.scene.stop());
    }

    _makeBtn(cx, cy, label, cb) {
        const bg = this.add.graphics();
        // 3D bottom shadow
        drawRoundRect(bg, cx - 60, cy - 16 + 3, 120, 32, 10, 0x334155, 1);
        // Face
        drawRoundRect(bg, cx - 60, cy - 16, 120, 30, 10, 0x64748b, 1);
        // Gloss
        bg.fillStyle(0xffffff, 0.2);
        bg.fillRoundedRect(cx - 56, cy - 14, 112, 12, 4);

        const txt = createHDText(this, cx, cy - 1, label, {
            fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
            color: '#fff', stroke: '#111625', strokeThickness: 2, fontStyle: '800',
        }).setOrigin(0.5).setDepth(1);

        const hit = this.add.rectangle(cx, cy, 120, 32, 0, 0).setInteractive({ cursor: 'pointer' });
        hit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playClick();
            }
            cb();
        });
        return [bg, txt, hit];
    }
}
