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

        // Сетка мобов
        const cols = 6;
        const cardW = 130, cardH = 100;
        const startX = 50, startY = 80;

        MOBS.forEach((mob, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + 10);
            const y = startY + row * (cardH + 10);

            const isUnlocked = this.unlockedSet.has(mob.level);

            const bg = this.add.graphics();
            drawRoundRect(bg, x, y, cardW, cardH, 8,
                isUnlocked ? mob.rarityColor : 0x222222, isUnlocked ? 0.4 : 0.6,
                isUnlocked ? mob.rarityColor : 0x444444, 1);

            if (isUnlocked) {
                // Эмодзи
                this.add.text(x + cardW / 2, y + 26, mob.emoji, { fontSize: '32px' }).setOrigin(0.5);
                // Имя
                this.add.text(x + cardW / 2, y + 54, mob.name, {
                    fontSize: '10px', fontFamily: 'monospace', color: '#fff',
                    stroke: '#000', strokeThickness: 2, fontStyle: 'bold', wordWrap: { width: cardW - 6 }
                }).setOrigin(0.5, 0);
                // АТК
                this.add.text(x + cardW / 2, y + 74, `⚔ ${formatNumber(mob.atk)}`, {
                    fontSize: '10px', fontFamily: 'monospace', color: '#ff8888', fontStyle: 'bold'
                }).setOrigin(0.5, 0);
                // Уровень
                this.add.text(x + 6, y + 5, `Lv${mob.level}`, {
                    fontSize: '10px', fontFamily: 'monospace', color: '#ffd700', fontStyle: 'bold'
                });
            } else {
                // Заблокирован — показываем ?
                this.add.text(x + cardW / 2, y + cardH / 2 - 10, '🔒', { fontSize: '32px' }).setOrigin(0.5);
                this.add.text(x + cardW / 2, y + cardH / 2 + 20, `Lv${mob.level}`, {
                    fontSize: '11px', fontFamily: 'monospace', color: '#777', fontStyle: 'bold'
                }).setOrigin(0.5);
            }
        });

        // Кнопка закрыть
        const [bbg, btxt, bhit] = this._makeBtn(W - 75, 28, 'X Закрыть', () => {
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
