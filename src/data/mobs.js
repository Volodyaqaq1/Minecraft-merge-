// ============================================================
// data/mobs.js — Data-driven манифест персонажей Бестиария
// 90 уровней прогрессии: 30 базовых мобов × 3 эволюции
// 1. Обычная (Lv. 1–30)
// 2. Стихийная (Lv. 31–60)
// 3. Золотая (Lv. 61–90)
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

// 3 Эры Эволюции
const EVOLUTIONS = {
    ordinary: {
        id: 'ordinary',
        tier: 1,
        index: 0,
        name: 'Обычная',
        tabName: 'ОБЫЧНЫЕ',
        levelRange: [1, 30],
        prefix: '',
        color: 0x94a3b8,
        auraColor: null,
    },
    elemental: {
        id: 'elemental',
        tier: 2,
        index: 1,
        name: 'Стихийная',
        tabName: 'СТИХИЙНЫЕ',
        levelRange: [31, 60],
        prefix: 'Стихийная ',
        color: 0x38bdf8,
        auraColor: 0x38bdf8,
    },
    golden: {
        id: 'golden',
        tier: 3,
        index: 2,
        name: 'Золотая',
        tabName: 'ЗОЛОТЫЕ',
        levelRange: [61, 90],
        prefix: 'Золотая ',
        color: 0xffd700,
        auraColor: 0xffd700,
    },
};

const EVOLUTION_LIST = [
    EVOLUTIONS.ordinary,
    EVOLUTIONS.elemental,
    EVOLUTIONS.golden
];

// Обратная совместимость для компонентов, ожидающих MOB_TIERS
const MOB_TIERS = {
    1: EVOLUTIONS.ordinary,
    2: EVOLUTIONS.elemental,
    3: EVOLUTIONS.golden,
};

// 30 базовых уникальных персонажей в каноническом порядке
const BASE_MOBS = [
    { baseId: 1,  name: 'Цыпа',             skinFile: 'Chicken.jpg',        hasSkin: true },
    { baseId: 2,  name: 'Кролик',           skinFile: 'rabbit.jpg',         hasSkin: true },
    { baseId: 3,  name: 'Хрюша',            skinFile: 'pig.jpg',            hasSkin: true },
    { baseId: 4,  name: 'Бурёнка',          skinFile: 'cow.jpg',            hasSkin: true },
    { baseId: 5,  name: 'Овечка',           skinFile: 'sheep.jpg',          hasSkin: true },
    { baseId: 6,  name: 'Летучая мышка',    skinFile: 'bat.jpg',            hasSkin: true },
    { baseId: 7,  name: 'Желейка',          skinFile: 'Slime.jpg',          hasSkin: true },
    { baseId: 8,  name: 'Паучок',           skinFile: 'Spider.jpg',         hasSkin: true },
    { baseId: 9,  name: 'Пещерник',         skinFile: 'CaveSpider.jpg',     hasSkin: true },
    { baseId: 10, name: 'Бумик',            skinFile: 'crepper.jpg',        hasSkin: true },
    { baseId: 11, name: 'Зомбик',           skinFile: 'Zombie.jpg',         hasSkin: true },
    { baseId: 12, name: 'Скелетик',         skinFile: 'Skeleton.jpg',       hasSkin: true },
    { baseId: 13, name: 'Ледяной странник', skinFile: 'Stray.jpg',          hasSkin: true },
    { baseId: 14, name: 'Снеговик',         skinFile: 'Snow Golem.jpg',     hasSkin: true },
    { baseId: 15, name: 'Колдунья',         skinFile: 'Witch.jpg',          hasSkin: true },
    { baseId: 16, name: 'Разбойник',        skinFile: 'Pillager.jpg',       hasSkin: true },
    { baseId: 17, name: 'Громила',          skinFile: 'PiglinBrute.jpg',    hasSkin: true },
    { baseId: 18, name: 'Вепрь',            skinFile: 'Hoglin.jpg',         hasSkin: true },
    { baseId: 19, name: 'Лавовый куб',      skinFile: 'Magma Cube.jpg',     hasSkin: true },
    { baseId: 20, name: 'Огонёк',           skinFile: 'Blaze.jpg',          hasSkin: true },
    { baseId: 21, name: 'Призрак',          skinFile: 'Ghast.jpg',          hasSkin: true },
    { baseId: 22, name: 'Чародей',          skinFile: 'Evoker.jpg',         hasSkin: true },
    { baseId: 23, name: 'Циклоп',           skinFile: 'Guardian.jpg',       hasSkin: true },
    { baseId: 24, name: 'Морской титан',    skinFile: 'ElderGuardian.jpg',  hasSkin: true },
    { baseId: 25, name: 'Ночной крылан',    skinFile: 'Phantom.jpg',        hasSkin: true },
    { baseId: 26, name: 'Телепорт',         skinFile: 'EnderMan.jpg',       hasSkin: true },
    { baseId: 27, name: 'Тёмный рыцарь',    skinFile: 'WitherSkeleton.jpg', hasSkin: true },
    { baseId: 28, name: 'Железный страж',   skinFile: 'Iron Golem.jpg',     hasSkin: true },
    { baseId: 29, name: 'Трёхглавый',       skinFile: 'Wither.jpg',         hasSkin: true },
    { baseId: 30, name: 'Древний Дракон',   skinFile: 'EnderDragon.jpg',    hasSkin: true },
];

// Генерация 90 уровней прогрессии
const MOBS = [];

for (let lvl = 1; lvl <= 90; lvl++) {
    const baseMobId = ((lvl - 1) % 30) + 1;
    const localLevel = baseMobId;
    const evolutionIndex = Math.floor((lvl - 1) / 30);
    const evolutionTier = evolutionIndex + 1;
    const evolution = EVOLUTION_LIST[evolutionIndex];
    const base = BASE_MOBS[baseMobId - 1];

    // Формирование имени с учетом рода и эволюции
    const isFeminine = base.name.endsWith('а') || base.name.endsWith('я');
    let fullName = base.name;
    if (evolutionIndex === 1) {
        fullName = (isFeminine ? 'Стихийная ' : 'Стихийный ') + base.name;
    } else if (evolutionIndex === 2) {
        fullName = (isFeminine ? 'Золотая ' : 'Золотой ') + base.name;
    }

    const rarityIdx = Math.min(MOB_RARITY_COLORS.length - 1, Math.floor((lvl - 1) / 5));

    // Ключи текстур
    const padBase = String(baseMobId).padStart(2, '0');
    const padLvl = String(lvl).padStart(2, '0');

    // Sprite: эволюционный прозрачный спрайт
    const spriteKey = `mob_${evolution.id}_${padBase}`;
    // Portrait: оформленный круглый портрет
    const portraitKey = `mob_portrait_${padLvl}`;
    // Legacy textureKey для совместимости
    const legacyKey = `mob_${padBase}`;

    MOBS.push({
        id: lvl,
        level: lvl,
        globalLevel: lvl,
        localLevel,
        baseMobId,
        baseName: base.name,
        evolutionTier,
        evolutionId: evolution.id,
        evolutionName: evolution.name,
        evolutionIndex,
        tier: evolutionTier,
        tierName: evolution.name,
        tierColor: evolution.color,
        auraColor: evolution.auraColor,
        name: fullName,
        hasSkin: true,
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
 * Получить эволюцию по уровню (1-90)
 */
function getEvolutionByLevel(level) {
    const lvl = Math.max(1, Math.min(90, Math.floor(level || 1)));
    const idx = Math.floor((lvl - 1) / 30);
    return EVOLUTION_LIST[idx] || EVOLUTIONS.ordinary;
}

/**
 * Получить эволюцию по ID
 */
function getEvolutionById(id) {
    return EVOLUTIONS[id] || EVOLUTIONS.ordinary;
}

/**
 * Получить следующего моба
 */
function getNextMob(level) {
    return getMobByLevel(level + 1);
}

/**
 * Ленивая загрузка 512px HD текстуры для окна открытия моба или детального просмотра
 */
function ensureMob512Loaded(scene, level, callback) {
    const mob = getMobByLevel(level);
    if (!mob) {
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
