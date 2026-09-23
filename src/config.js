// ============================================================
// config.js — все константы игры в одном месте
// ============================================================

const CONFIG = {
    // --- Phaser ---
    WIDTH: 960,
    HEIGHT: 540,

    // --- Поле мёрджа ---
    FIELD_COLS: 5,
    FIELD_ROWS: 4,
    FIELD_SLOT_SIZE: 96,       // px, размер одного слота
    FIELD_OFFSET_X: 140,       // отступ поля от левого края
    FIELD_OFFSET_Y: 80,        // отступ поля сверху

    // --- Мобы ---
    MOB_LEVELS: 30,            // всего уровней
    MOB_BASE_ATK: 10,          // АТК первого уровня
    MOB_ATK_MULTIPLIER: 2.2,   // рост АТК каждый уровень

    // --- Экономика ---
    MERGE_COIN_MULTIPLIER: 100,    // монет за мёрдж = atk × 100 × multiplier
    XP_PER_MERGE: 50,              // xp за мёрдж
    XP_TO_LEVEL: [0, 200, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000,
                  256000, 512000, 1000000, 2000000, 4000000],
    MULTIPLIER_LEVELS: [1, 5, 10, 15, 20],  // на каком уровне игрока дают x1,x2,x3,x4,x5

    // --- Магазин ---
    SHOP_SLOTS: 2,
    FREE_MOB_COOLDOWN: 5 * 60 * 1000,  // 5 минут в мс
    SHOP_MOB_COST_MULTIPLIER: 500,      // цена = atk моба × 500

    // --- Бои ---
    BATTLE_MAX_FIGHTERS: 3,
    BATTLE_ROUNDS: 20,              // максимум раундов
    BATTLE_ROUND_DELAY: 800,        // мс между атаками
    BATTLE_PRIZE_MULTIPLIER: 50,    // приз = сумма atk всех мобов × 50

    // --- UI Цвета ---
    COLORS: {
        BG:           0x1a1a2e,
        PANEL:        0x16213e,
        PANEL_DARK:   0x0f3460,
        GOLD:         0xffd700,
        EMERALD:      0x5dff6e,
        RED:          0xff4444,
        WHITE:        0xffffff,
        SLOT_EMPTY:   0x2a3a2a,
        SLOT_HOVER:   0x3a5a3a,
    },

    // --- Очередь мобов ---
    QUEUE_SIZE: 4,                  // сколько мобов в очереди
    QUEUE_MAX_LEVEL_OFFSET: 3,      // спавним мобов не выше (max_unlocked - offset)
};
