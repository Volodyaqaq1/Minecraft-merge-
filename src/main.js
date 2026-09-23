// ============================================================
// main.js — инициализация Phaser и Yandex SDK
// ============================================================

// Инициализация Яндекс SDK (если доступен)
async function initYandex() {
    if (typeof YaGames !== 'undefined') {
        try {
            window.ysdk = await YaGames.init();
            console.log('Yandex SDK инициализирован');
        } catch (e) {
            console.warn('Yandex SDK недоступен:', e);
            window.ysdk = null;
        }
    } else {
        window.ysdk = null;
    }
}

// Запустить игру
async function startGame() {
    await initYandex();

    const config = {
        type: Phaser.AUTO,
        width:  CONFIG.WIDTH,
        height: CONFIG.HEIGHT,

        // Масштабирование под любой экран
        scale: {
            mode:           Phaser.Scale.FIT,
            autoCenter:     Phaser.Scale.CENTER_BOTH,
            parent:         document.body,
        },

        backgroundColor: '#1a1a2e',

        // Антиалиасинг выключен для пиксель-арта
        render: {
            pixelArt: false,
            antialias: true,
        },

        input: {
            activePointers: 3,  // поддержка multi-touch
        },

        scene: [
            BootScene,
            GameScene,
            BattleScene,
            CollectionScene,
        ],
    };

    window.game = new Phaser.Game(config);
}

startGame();
