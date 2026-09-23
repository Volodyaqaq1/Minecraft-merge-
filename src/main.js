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

        // Масштабирование под любой экран (портретный и альбомный)
        scale: {
            mode:           Phaser.Scale.FIT,
            autoCenter:     Phaser.Scale.CENTER_BOTH,
            parent:         'game-container',
        },

        backgroundColor: '#111625',

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

    // Автоматическое мгновенное обновление масштаба при повороте устройства и изменении окна
    window.addEventListener('resize', () => {
        if (window.game && window.game.scale) {
            window.game.scale.refresh();
        }
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (window.game && window.game.scale) {
                window.game.scale.refresh();
            }
        }, 150);
    });
}

startGame();
