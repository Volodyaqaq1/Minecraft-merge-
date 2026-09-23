// ============================================================
// scenes/BootScene.js — загрузка всех ассетов
// ============================================================

class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'BootScene' }); }

    preload() {
        // Обновляем прогресс-бар на html-экране загрузки
        this.load.on('progress', (value) => {
            const bar = document.getElementById('loadBar');
            if (bar) bar.style.width = `${Math.floor(value * 100)}%`;
        });

        // ─── Фоны ───
        // Используем заглушки-цвета пока нет арта.
        // Потом заменить на: this.load.image('bg_game', 'assets/bg/forest.jpg');
        this._createColorTexture('bg_game',   0x2d5a27, 960, 540);
        this._createColorTexture('bg_battle', 0x1a1a2e, 960, 540);

        // ─── UI элементы ───
        this._createColorTexture('ui_panel',  0x16213e, 10, 10);
        this._createColorTexture('ui_btn_green', 0x27ae60, 10, 10);
        this._createColorTexture('ui_btn_red',   0xc0392b, 10, 10);
        this._createColorTexture('ui_btn_blue',  0x2980b9, 10, 10);
        this._createColorTexture('ui_btn_gray',  0x636e72, 10, 10);

        // ─── Мобы — эмодзи-заглушки ───
        // Когда появится арт, заменить на:
        // for (let i = 1; i <= 30; i++) {
        //     const key = `mob_${String(i).padStart(2,'0')}`;
        //     this.load.image(key, `assets/mobs/${key}.png`);
        // }

        // ─── Иконки ───
        this._createColorTexture('icon_emerald', 0x27ae60, 24, 24);
        this._createColorTexture('icon_chest',   0xf39c12, 48, 48);
    }

    /**
     * Создать одноцветную текстуру прямо в памяти (без файла)
     */
    _createColorTexture(key, color, w, h) {
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(color, 1);
        g.fillRect(0, 0, w, h);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    create() {
        // Скрыть html-загрузчик
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => { loading.style.display = 'none'; }, 500);
        }
        this.scene.start('GameScene');
    }
}
