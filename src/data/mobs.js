// ============================================================
// data/mobs.js — Data-driven манифест персонажей Бестиария
// 90 уровней прогрессии: 30 базовых мобов × 3 тира (Обычный, Золотой, Алмазный)
// ============================================================

// Цвета рамки карточки по редкости (каждые 5 уровней — новая редкость)
const MOB_RARITY_COLORS = [
    0x888888, // Lv 1-5:   Обычный (серый)
    0x44aa44, // Lv 6-10:  Необычный (зелёный)
    0x4488ff, // Lv 11-15: Редкий (синий)
    0xaa44ff, // Lv 16-20: Эпический (фиолетовый)
    0xff8800, // Lv 21-25: Легендарный (оранжевый)
    0xff4444, // Lv 26-30: Мифический (красный)
    0xe11d48, // Lv 31-35: Древний (рубиновый)
    0x06b6d4, // Lv 36-40: Астральный (бирюзовый)
    0xf59e0b, // Lv 41-45: Космический (солнечный)
    0xec4899, // Lv 46-50: Божественный (розовый)
    0x8b5cf6, // Lv 51-55: Хаос (индиго)
    0x10b981, // Lv 56-60: Бессмертный (изумрудный)
    0xfbbf24, // Lv 61-65: Сияющий (янтарный)
    0x38bdf8, // Lv 66-70: Эфирный (небесный)
    0xa855f7, // Lv 71-75: Первородный (аметистовый)
    0xf43f5e, // Lv 76-80: Титанический (карминовый)
    0x14b8a6, // Lv 81-85: Бесконечный (бирюза глубин)
    0xffffff, // Lv 86-90: Абсолют (алмазный перламутр)
];

// Тиры персонажей
const MOB_TIERS = {
    1: { id: 1, name: 'Обычный',  prefix: '',          color: 0x94a3b8, auraColor: null },
    2: { id: 2, name: 'Золотой',  prefix: 'Золотой ',  color: 0xffd700, auraColor: 0xffd700 },
    3: { id: 3, name: 'Алмазный', prefix: 'Алмазный ', color: 0x00e6ff, auraColor: 0x00e6ff },
};

// 30 базовых уникальных персонажей
const BASE_MOBS = [
    { baseId: 1,  name: 'Цыпа',             skinFile: 'Chicken.jpg',  hasSkin: true },
    { baseId: 2,  name: 'Хрюша',            skinFile: 'pig.jpg',      hasSkin: true },
    { baseId: 3,  name: 'Бурёнка',          skinFile: 'cow.jpg',      hasSkin: true },
    { baseId: 4,  name: 'Овечка',           skinFile: 'sheep.jpg',    hasSkin: true },
    { baseId: 5,  name: 'Кролик',           skinFile: 'rabbit.jpg',   hasSkin: true },
    { baseId: 6,  name: 'Летучая мышка',    skinFile: 'bat.jpg',      hasSkin: true },
    { baseId: 7,  name: 'Зомбик',           skinFile: 'Zombie.jpg',   hasSkin: true },
    { baseId: 8,  name: 'Скелетик',         skinFile: 'Skeleton.jpg', hasSkin: true },
    { baseId: 9,  name: 'Паучок',           skinFile: 'Spider.jpg',   hasSkin: true },
    { baseId: 10, name: 'Бумик',            skinFile: 'crepper.jpg',  hasSkin: true },
    { baseId: 11, name: 'Колдунья',         skinFile: null,           hasSkin: false },
    { baseId: 12, name: 'Циклоп',           skinFile: null,           hasSkin: false },
    { baseId: 13, name: 'Тёмный рыцарь',    skinFile: null,           hasSkin: false },
    { baseId: 14, name: 'Телепорт',         skinFile: null,           hasSkin: false },
    { baseId: 15, name: 'Огонёк',           skinFile: null,           hasSkin: false },
    { baseId: 16, name: 'Призрак',          skinFile: null,           hasSkin: false },
    { baseId: 17, name: 'Пещерник',         skinFile: null,           hasSkin: false },
    { baseId: 18, name: 'Лавовый куб',      skinFile: null,           hasSkin: false },
    { baseId: 19, name: 'Трёхглавый',       skinFile: null,           hasSkin: false },
    { baseId: 20, name: 'Морской титан',    skinFile: null,           hasSkin: false },
    { baseId: 21, name: 'Громила',          skinFile: null,           hasSkin: false },
    { baseId: 22, name: 'Чародей',          skinFile: null,           hasSkin: false },
    { baseId: 23, name: 'Вепрь',            skinFile: null,           hasSkin: false },
    { baseId: 24, name: 'Разбойник',        skinFile: null,           hasSkin: false },
    { baseId: 25, name: 'Ледяной странник', skinFile: null,           hasSkin: false },
    { baseId: 26, name: 'Ночной крылан',    skinFile: null,           hasSkin: false },
    { baseId: 27, name: 'Желейка',          skinFile: null,           hasSkin: false },
    { baseId: 28, name: 'Железный страж',   skinFile: null,           hasSkin: false },
    { baseId: 29, name: 'Снеговик',         skinFile: null,           hasSkin: false },
    { baseId: 30, name: 'Древний Дракон',   skinFile: null,           hasSkin: false },
];

// Генерация 90 уровней прогрессии
const MOBS = [];

for (let lvl = 1; lvl <= 90; lvl++) {
    const baseMobId = ((lvl - 1) % 30) + 1;
    const tierId = Math.floor((lvl - 1) / 30) + 1;
    const tier = MOB_TIERS[tierId];
    const base = BASE_MOBS[baseMobId - 1];
    
    // Формирование имени с учетом рода и тира
    let fullName = base.name;
    if (tierId === 2) {
        if (base.name.endsWith('а') || base.name.endsWith('я')) {
            fullName = 'Золотая ' + base.name;
        } else {
            fullName = 'Золотой ' + base.name;
        }
    } else if (tierId === 3) {
        if (base.name.endsWith('а') || base.name.endsWith('я')) {
            fullName = 'Алмазная ' + base.name;
        } else {
            fullName = 'Алмазный ' + base.name;
        }
    }

    const rarityIdx = Math.min(MOB_RARITY_COLORS.length - 1, Math.floor((lvl - 1) / 5));
    
    // Ключи текстур
    const padBase = String(baseMobId).padStart(2, '0');
    const padLvl = String(lvl).padStart(2, '0');
    
    // Sprite: прозрачный полный персонаж для поля/боя
    const spriteKey = base.hasSkin ? `mob_sprite_${padBase}` : 'mob_sprite_placeholder';
    // Portrait: оформленный круглый портрет для магазина/квестов/коллекции
    const portraitKey = `mob_portrait_${padLvl}`;
    
    // Legacy textureKey для обратной совместимости
    const legacyKey = base.hasSkin ? `mob_${padBase}` : 'mob_placeholder';

    MOBS.push({
        id: lvl,
        level: lvl,
        baseMobId,
        tier: tierId,
        tierName: tier.name,
        tierColor: tier.color,
        auraColor: tier.auraColor,
        name: fullName,
        baseName: base.name,
        hasSkin: base.hasSkin,
        skinFile: base.skinFile,
        // Специфические HD ключи
        spriteKey,
        portraitKey,
        // Совместимость
        texture: spriteKey,
        key: spriteKey,
        legacyKey,
        rarity: rarityIdx,
        rarityColor: MOB_RARITY_COLORS[rarityIdx],
        clickReward: typeof getMobClickReward === 'function' ? getMobClickReward(lvl) : 10,
        atk: typeof getMobAtk === 'function' ? getMobAtk(lvl) : 10,
        cost: typeof getMobCost === 'function' ? getMobCost(lvl) : 50,
    });
}

// Манифест мобов (для BootScene и внешних потребителей)
const MOB_MANIFEST = MOBS;

/**
 * Получить данные моба по уровню (1-90)
 */
function getMobByLevel(level) {
    if (!level || level < 1) return null;
    const lvl = Math.min(90, Math.floor(level));
    return MOBS[lvl - 1] || null;
}

/**
 * Получить следующего моба
 */
function getNextMob(level) {
    return getMobByLevel(level + 1);
}

/**
 * Ленивая загрузка 512px HD текстуры для окна открытия моба или детального просмотра
 * Предотвращает переполнение VRAM
 */
function ensureMob512Loaded(scene, level, callback) {
    const mob = getMobByLevel(level);
    if (!mob || !mob.hasSkin) {
        if (callback) callback('mob_sprite_placeholder');
        return;
    }
    
    const padBase = String(mob.baseMobId).padStart(2, '0');
    const key512 = `mob_sprite_512_${padBase}`;
    
    if (scene.textures.exists(key512)) {
        if (callback) callback(key512);
        return;
    }
    
    scene.load.image(key512, `assets/mobs/sprites/512/mob_${padBase}.png`);
    scene.load.once('complete', () => {
        if (callback) callback(key512);
    });
    scene.load.start();
}
