// ============================================================
// config.js — все константы игры в одном месте
// ============================================================

const CONFIG = {
    // --- Phaser ---
    WIDTH: 960,
    HEIGHT: 540,

    // --- Свободное поле мёрджа (увеличенный масштаб под мобильные) ---
    FIELD_BOUNDS: {
        minX: 175,
        maxX: 785,
        minY: 95,
        maxY: 445,
    },
    MERGE_RADIUS: 95,          // px, комфортная дистанция слияния под пальцы
    MOB_SIZE: 110,             // px, крупный размер моба для читаемости на экранах телефонов

    // --- Мобы ---
    MOB_LEVELS: 30,            // всего уровней
    MOB_BASE_ATK: 10,          // АТК первого уровня
    MOB_ATK_MULTIPLIER: 2.2,   // рост АТК каждый уровень

    // --- Экономика ---
    STARTING_COINS: 100,           // ровно на 2 курицы по 50
    BASE_MOB_COST: 50,             // стоимость курицы (уровень 1)
    COST_GROWTH: 2.15,             // множитель цены мобов
    XP_PER_MERGE: 50,              // базовый XP за мёрдж
    XP_PER_CLICK: 2,               // XP за каждый клик по мобу
    XP_TO_LEVEL: [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000,
                  128000, 256000, 512000, 1000000, 2000000],

    // --- Кликер и Комбо (множитель 1x-5x) ---
    COMBO_DECAY_PER_SEC: 5.0,       // % падения шкалы в секунду (падает медленнее)
    COMBO_GAIN_PER_CLICK: 4.5,      // % прироста шкалы за клик (набирается дольше)
    CLICK_REWARD_RATIO: 0.25,      // монет за клик = max(1, atk * 0.25 * multiplier)

    // --- Магазин ---
    BUY_LEVEL_OFFSET: 5,           // моб за монеты = max(1, maxUnlocked - 5)
    AD_LEVEL_OFFSET: 2,            // моб за рекламу = max(1, maxUnlocked - 2)
    FREE_MOB_COOLDOWN: 5 * 60 * 1000, // 5 минут в мс

    // --- Бои (Гонка по разрушению стенки) ---
    BATTLE_MAX_FIGHTERS: 3,
    BATTLE_WALL_HP_FACTOR: 11.5,   // Здоровье стенки для длительности боя ~7-8 сек
    BATTLE_ATTACK_SPEED: 700,      // интервал атак мобов (мс)
    BATTLE_PRIZE_MULTIPLIER: 60,   // приз = сумма atk всех мобов × 60
    BOT_CHALLENGE_INTERVAL: 90000, // вызов на бой раз в 90 сек

    // --- UI Цвета ---
    COLORS: {
        BG:           0x2d5a27,
        PANEL:        0x16213e,
        PANEL_DARK:   0x0f3460,
        GOLD:         0xffd700,
        EMERALD:      0x5dff6e,
        RED:          0xff4444,
        WHITE:        0xffffff,
    },
};

/**
 * Расчет цены покупки моба заданного уровня
 */
function getMobCost(level) {
    if (level <= 1) return CONFIG.BASE_MOB_COST; // ровно 50
    return Math.round(CONFIG.BASE_MOB_COST * Math.pow(CONFIG.COST_GROWTH, level - 1));
}
