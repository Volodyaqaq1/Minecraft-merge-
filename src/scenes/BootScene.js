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

        // ─── Мобы: 256px Sprites и Portraits для максимальной четкости без раздувания VRAM ───
        for (let baseId = 1; baseId <= 10; baseId++) {
            const pad = String(baseId).padStart(2, '0');
            const spritePath = `assets/mobs/sprites/256/mob_${pad}.png`;
            // HD Спрайт (прозрачный персонаж для поля и арены)
            this.load.image(`mob_sprite_${pad}`, spritePath);
            // Обратная совместимость с легаси-ключами
            this.load.image(`mob_${pad}`, spritePath);
            this.load.image(`mob_${pad}_sm`, spritePath);
        }

        // Портреты для всех 90 уровней (для квестов, магазина, коллекции)
        for (let lvl = 1; lvl <= 90; lvl++) {
            const pad = String(lvl).padStart(2, '0');
            this.load.image(`mob_portrait_${pad}`, `assets/mobs/portraits/256/mob_${pad}.png`);
        }

        // Плейсхолдеры
        this.load.image('mob_sprite_placeholder',   'assets/mobs/sprites/256/placeholder.png');
        this.load.image('mob_portrait_placeholder', 'assets/mobs/portraits/256/mob_11.png');
        this.load.image('mob_placeholder',          'assets/mobs/sprites/256/placeholder.png');

        // ─── UI Иконки (128x128 HD) ───
        this.load.image('icon_gem',   'assets/icons/gem.png');
        this.load.image('icon_sword', 'assets/icons/sword.png');
        this.load.image('icon_chest', 'assets/icons/chest.png');
        this.load.image('icon_egg',   'assets/icons/egg.png');
        this.load.image('icon_gear',  'assets/icons/gear.png');
        this.load.image('icon_emerald', 'assets/icons/gem.png');
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
