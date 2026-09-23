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
    BATTLE_PRIZE_MULTIPLIER: 2.0,  // базовый приз = сумма atk всех мобов × 2.0
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

// ============================================================
// Таблица экономики: Клик, Стоимость в магазине, АТК для всех 30 мобов
// Рассчитано по формуле пользователя:
// Ур. 23: клик 1 млн, покупка 27 млн
// Ур. 24: клик 2 млн, покупка 60 млн
// Ур. 25: клик 4 млн, покупка 132 млн
// и плавный перерасчет для уровней до 23 (ур. 1 = 50 монет)
// ============================================================
const MOB_ECONOMY_TABLE = [
    null, // 0-индекс не используется
    { level: 1,  click: 3,         cost: 50,          atk: 12 },
    { level: 2,  click: 5,         cost: 85,          atk: 20 },
    { level: 3,  click: 10,        cost: 175,         atk: 40 },
    { level: 4,  click: 18,        cost: 320,         atk: 75 },
    { level: 5,  click: 30,        cost: 550,         atk: 130 },
    { level: 6,  click: 55,        cost: 1000,        atk: 240 },
    { level: 7,  click: 100,       cost: 1900,        atk: 450 },
    { level: 8,  click: 175,       cost: 3500,        atk: 800 },
    { level: 9,  click: 300,       cost: 6200,        atk: 1500 },
    { level: 10, click: 550,       cost: 11500,       atk: 2800 },
    { level: 11, click: 1000,      cost: 21000,       atk: 5200 },
    { level: 12, click: 1800,      cost: 39000,       atk: 9500 },
    { level: 13, click: 3200,      cost: 70000,       atk: 17500 },
    { level: 14, click: 5600,      cost: 125000,      atk: 32000 },
    { level: 15, click: 10000,     cost: 230000,      atk: 60000 },
    { level: 16, click: 18000,     cost: 420000,      atk: 110000 },
    { level: 17, click: 32000,     cost: 760000,      atk: 200000 },
    { level: 18, click: 56000,     cost: 1380000,     atk: 370000 },
    { level: 19, click: 100000,    cost: 2500000,     atk: 680000 },
    { level: 20, click: 180000,    cost: 4600000,     atk: 1250000 },
    { level: 21, click: 320000,    cost: 8300000,     atk: 2300000 },
    { level: 22, click: 560000,    cost: 15000000,    atk: 4200000 },
    { level: 23, click: 1000000,   cost: 27000000,    atk: 7800000 },
    { level: 24, click: 2000000,   cost: 60000000,    atk: 15600000 },
    { level: 25, click: 4000000,   cost: 132000000,   atk: 31200000 },
    { level: 26, click: 8000000,   cost: 288000000,   atk: 62400000 },
    { level: 27, click: 16000000,  cost: 624000000,   atk: 125000000 },
    { level: 28, click: 32000000,  cost: 1344000000,  atk: 250000000 },
    { level: 29, click: 64000000,  cost: 2880000000,  atk: 500000000 },
    { level: 30, click: 128000000, cost: 6144000000,  atk: 1000000000 },
];

/**
 * Расчет цены покупки моба заданного уровня
 */
function getMobCost(level) {
    const lvl = Math.max(1, Math.min(30, Math.floor(level)));
    return MOB_ECONOMY_TABLE[lvl]?.cost || 50;
}

/**
 * Базовый доход за клик по мобу заданного уровня
 */
function getMobClickReward(level) {
    const lvl = Math.max(1, Math.min(30, Math.floor(level)));
    return MOB_ECONOMY_TABLE[lvl]?.click || 3;
}

/**
 * Урон моба в бою
 */
function getMobAtk(level) {
    const lvl = Math.max(1, Math.min(30, Math.floor(level)));
    return MOB_ECONOMY_TABLE[lvl]?.atk || 12;
}
