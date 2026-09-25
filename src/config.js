// ============================================================
// config.js — все константы игры в одном месте
// ============================================================

const CONFIG = {
    // --- Phaser (Logical Coordinates & HiDPI Backing Buffer) ---
    LOGICAL_WIDTH: 960,
    LOGICAL_HEIGHT: 540,
    WIDTH: 960,
    HEIGHT: 540,
    // HiDPI backing buffer: 2.0x (1920x1080) on Full HD / 1366x768 / Retina screens to eliminate CSS upscaling blur.
    RENDER_SCALE: (function() {
        if (typeof window === 'undefined') return 2.0;
        const dpr = window.devicePixelRatio || 1;
        const w = (window.innerWidth || 960) * dpr;
        const h = (window.innerHeight || 540) * dpr;
        const scaleFactor = Math.min(w / 960, h / 540);
        return Math.min(2.0, Math.max(1.0, scaleFactor >= 1.2 ? 2.0 : 1.0));
    })(),

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
    MOB_LEVELS: 90,            // всего уровней (30 базы x 3 тира)
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
    MULTIPLIER_LEVELS: [1, 5, 10, 15, 20], // пороги уровней для множителя
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

    // --- Шрифты и UI ---
    FONT_FAMILY: "'Nunito', sans-serif",

    // --- UI Цвета (Пастельная казуальная палитра) ---
    COLORS: {
        BG:           0x7bc638,
        BG_LIGHT:     0x9de64e,
        SKY_TOP:      0x64b8f5,
        SKY_BOTTOM:   0xc0e8ff,
        PANEL:        0x16213e,
        PANEL_LIGHT:  0x3b82f6,
        PANEL_DARK:   0x0f3460,
        GOLD:         0xffd700,
        EMERALD:      0x2ed573,
        RED:          0xef4444,
        WHITE:        0xffffff,
    },
};

// ============================================================
// Таблица экономики: Клик, Стоимость в магазине, АТК для всех 30 мобов
// Сбалансированная кривая прогрессии:
// Ур. 14: клик 8,000, покупка 100,000, соотношение 12.5 тапов
// Ур. 15: клик 16,000, покупка 240,000, соотношение 15.0 тапов
// Награда за поражение в бою (ур. 15) = 1.48M, за победу = 3.70M
// ============================================================
const MOB_ECONOMY_TABLE = [
    null, // 0-индекс не используется
    { level: 1,  click: 4,         cost: 50,          atk: 15 },
    { level: 2,  click: 7,         cost: 90,          atk: 25 },
    { level: 3,  click: 13,        cost: 165,         atk: 50 },
    { level: 4,  click: 24,        cost: 310,         atk: 90 },
    { level: 5,  click: 45,        cost: 580,         atk: 170 },
    { level: 6,  click: 85,        cost: 1100,        atk: 320 },
    { level: 7,  click: 160,       cost: 2100,        atk: 600 },
    { level: 8,  click: 300,       cost: 4000,        atk: 1100 },
    { level: 9,  click: 550,       cost: 7500,        atk: 2100 },
    { level: 10, click: 1000,      cost: 14000,       atk: 3800 },
    { level: 11, click: 1900,      cost: 26000,       atk: 7200 },
    { level: 12, click: 3500,      cost: 48000,       atk: 13500 },
    { level: 13, click: 5300,      cost: 70000,       atk: 21000 },
    { level: 14, click: 8000,      cost: 100000,      atk: 32000 },
    { level: 15, click: 16000,     cost: 240000,      atk: 64000 },
    { level: 16, click: 30000,     cost: 460000,      atk: 120000 },
    { level: 17, click: 55000,     cost: 850000,      atk: 220000 },
    { level: 18, click: 100000,    cost: 1550000,     atk: 400000 },
    { level: 19, click: 180000,    cost: 2800000,     atk: 720000 },
    { level: 20, click: 320000,    cost: 5000000,     atk: 1300000 },
    { level: 21, click: 580000,    cost: 9000000,     atk: 2300000 },
    { level: 22, click: 1000000,   cost: 16000000,    atk: 4000000 },
    { level: 23, click: 1800000,   cost: 28000000,    atk: 7200000 },
    { level: 24, click: 3200000,   cost: 50000000,    atk: 13000000 },
    { level: 25, click: 5800000,   cost: 90000000,    atk: 23000000 },
    { level: 26, click: 10000000,  cost: 160000000,   atk: 40000000 },
    { level: 27, click: 18000000,  cost: 280000000,   atk: 72000000 },
    { level: 28, click: 32000000,  cost: 500000000,   atk: 130000000 },
    { level: 29, click: 58000000,  cost: 900000000,   atk: 230000000 },
    { level: 30, click: 100000000, cost: 1600000000,  atk: 400000000 },
];

/**
 * Расчет цены покупки моба заданного уровня (с поддержкой до 90 мобов)
 */
function getMobCost(level) {
    const lvl = Math.max(1, Math.floor(level));
    if (lvl < MOB_ECONOMY_TABLE.length && MOB_ECONOMY_TABLE[lvl]) {
        return MOB_ECONOMY_TABLE[lvl].cost;
    }
    const base = MOB_ECONOMY_TABLE[30].cost;
    return Math.floor(base * Math.pow(1.75, lvl - 30));
}

/**
 * Базовый доход за клик по мобу заданного уровня
 */
function getMobClickReward(level) {
    const lvl = Math.max(1, Math.floor(level));
    if (lvl < MOB_ECONOMY_TABLE.length && MOB_ECONOMY_TABLE[lvl]) {
        return MOB_ECONOMY_TABLE[lvl].click;
    }
    const base = MOB_ECONOMY_TABLE[30].click;
    return Math.floor(base * Math.pow(1.75, lvl - 30));
}

/**
 * Урон моба в бою
 */
function getMobAtk(level) {
    const lvl = Math.max(1, Math.floor(level));
    if (lvl < MOB_ECONOMY_TABLE.length && MOB_ECONOMY_TABLE[lvl]) {
        return MOB_ECONOMY_TABLE[lvl].atk;
    }
    const base = MOB_ECONOMY_TABLE[30].atk;
    return Math.floor(base * Math.pow(1.75, lvl - 30));
}

/**
 * Стоимость покупки моба в магазине для текущего прогресса игрока
 */
function getShopMobCost(playerMaxLevel) {
    return getMobCost(playerMaxLevel);
}

/**
 * Награда за поражение в бою (Defeat reward)
 * На ур. 15 = ровно 1.48M (1,480,000)
 */
function getBattleLossReward(level) {
    const lvl = Math.max(1, Math.floor(level));
    const cost = getMobCost(lvl);
    return Math.round(cost * (1480000 / 240000));
}

/**
 * Награда за победу в бою (Victory reward)
 * Победа в 2.5 раза ценнее поражения (на ур. 15 = 3.70M)
 */
function getBattleWinReward(level) {
    const loss = getBattleLossReward(level);
    return Math.round(loss * 2.5);
}
