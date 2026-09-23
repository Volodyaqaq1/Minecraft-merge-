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
        this.add.rectangle(W / 2, H / 2, W, H, 0x0f1a10);

        // Панель
        const g = this.add.graphics();
        drawRoundRect(g, 20, 10, W - 40, H - 20, 16, CONFIG.COLORS.PANEL, 0.95, 0xffd700, 2);

        // Заголовок
        this.add.text(W / 2, 28, '📖 Бестиарий Майнкрафт', {
            fontSize: '20px', fontFamily: 'monospace',
            color: '#ffd700', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0);

        // Счётчик
        const unlocked = this.unlockedSet.size;
        this.add.text(W / 2, 54, `Открыто: ${unlocked} / ${CONFIG.MOB_LEVELS}`, {
            fontSize: '13px', fontFamily: 'monospace', color: '#aaa',
        }).setOrigin(0.5, 0);

        // Контейнер с маской для плавной вертикальной прокрутки
        const viewY = 80;
        const viewH = H - 95;
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
            drawRoundRect(bg, x, y, cardW, cardH, 10,
                isUnlocked ? mob.rarityColor : 0x222222, isUnlocked ? 0.35 : 0.6,
                isUnlocked ? mob.rarityColor : 0x444444, 1.5);

            if (isUnlocked) {
                const emoji = this.add.text(x + cardW / 2, y + 26, mob.emoji, { fontSize: '32px' }).setOrigin(0.5);
                const name = this.add.text(x + cardW / 2, y + 54, mob.name, {
                    fontSize: '11px', fontFamily: 'monospace', color: '#fff',
                    stroke: '#000', strokeThickness: 2, fontStyle: 'bold', wordWrap: { width: cardW - 8 }
                }).setOrigin(0.5, 0);
                const atk = this.add.text(x + cardW / 2, y + 72, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '11px', fontFamily: 'monospace', color: '#5dff6e', fontStyle: 'bold'
                }).setOrigin(0.5, 0);
                const lvl = this.add.text(x + 8, y + 6, `Lv.${mob.level}`, {
                    fontSize: '10px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
                });
                this.cardsContainer.add([bg, emoji, name, atk, lvl]);
            } else {
                const lock = this.add.text(x + cardW / 2, y + cardH / 2 - 10, '🔒', { fontSize: '30px' }).setOrigin(0.5);
                const lvl = this.add.text(x + cardW / 2, y + cardH / 2 + 18, `Lv.${mob.level}`, {
                    fontSize: '11px', fontFamily: 'monospace', color: '#777', fontStyle: 'bold'
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
        drawRoundRect(bg, cx - 65, cy - 18, 130, 36, 8, 0x636e72, 1);
        const txt = this.add.text(cx, cy, label, {
            fontSize: '13px', fontFamily: 'monospace', color: '#fff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(1);
        const hit = this.add.rectangle(cx, cy, 130, 36, 0, 0).setInteractive({ cursor: 'pointer' });
        hit.on('pointerdown', () => {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playClick();
            }
            cb();
        });
        return [bg, txt, hit];
    }
}
