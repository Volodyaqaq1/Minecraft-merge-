// ============================================================
// data/mobs.js — Data-driven манифест персонажей Бестиария
// Архитектура рассчитана на масштабирование до 85+ мобов.
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
    0xf59e0b, // Lv 41+:   Космический (солнечный)
];

// Data-driven манифест мобов (с поддержкой ручного добавления новых скинов)
const MOB_MANIFEST = [
    { id: 1,  level: 1,  name: 'Цыпа',             skinFile: 'Chicken.jpg',  hasSkin: true },
    { id: 2,  level: 2,  name: 'Хрюша',            skinFile: 'pig.jpg',      hasSkin: true },
    { id: 3,  level: 3,  name: 'Бурёнка',          skinFile: 'cow.jpg',      hasSkin: true },
    { id: 4,  level: 4,  name: 'Овечка',           skinFile: 'sheep.jpg',    hasSkin: true },
    { id: 5,  level: 5,  name: 'Кролик',           skinFile: 'rabbit.jpg',   hasSkin: true },
    { id: 6,  level: 6,  name: 'Летучая мышка',    skinFile: 'bat.jpg',      hasSkin: true },
    { id: 7,  level: 7,  name: 'Зомбик',           skinFile: 'Zombie.jpg',   hasSkin: true },
    { id: 8,  level: 8,  name: 'Скелетик',         skinFile: 'Skeleton.jpg', hasSkin: true },
    { id: 9,  level: 9,  name: 'Паучок',           skinFile: 'Spider.jpg',   hasSkin: true },
    { id: 10, level: 10, name: 'Бумик',            skinFile: 'crepper.jpg',  hasSkin: true },
    { id: 11, level: 11, name: 'Колдунья',         skinFile: null,           hasSkin: false },
    { id: 12, level: 12, name: 'Циклоп',           skinFile: null,           hasSkin: false },
    { id: 13, level: 13, name: 'Тёмный рыцарь',    skinFile: null,           hasSkin: false },
    { id: 14, level: 14, name: 'Телепорт',         skinFile: null,           hasSkin: false },
    { id: 15, level: 15, name: 'Огонёк',           skinFile: null,           hasSkin: false },
    { id: 16, level: 16, name: 'Призрак',          skinFile: null,           hasSkin: false },
    { id: 17, level: 17, name: 'Пещерник',         skinFile: null,           hasSkin: false },
    { id: 18, level: 18, name: 'Лавовый куб',      skinFile: null,           hasSkin: false },
    { id: 19, level: 19, name: 'Трёхглавый',       skinFile: null,           hasSkin: false },
    { id: 20, level: 20, name: 'Морской титан',    skinFile: null,           hasSkin: false },
    { id: 21, level: 21, name: 'Громила',          skinFile: null,           hasSkin: false },
    { id: 22, level: 22, name: 'Чародей',          skinFile: null,           hasSkin: false },
    { id: 23, level: 23, name: 'Вепрь',            skinFile: null,           hasSkin: false },
    { id: 24, level: 24, name: 'Разбойник',        skinFile: null,           hasSkin: false },
    { id: 25, level: 25, name: 'Ледяной странник', skinFile: null,           hasSkin: false },
    { id: 26, level: 26, name: 'Ночной крылан',    skinFile: null,           hasSkin: false },
    { id: 27, level: 27, name: 'Желейка',          skinFile: null,           hasSkin: false },
    { id: 28, level: 28, name: 'Железный страж',   skinFile: null,           hasSkin: false },
    { id: 29, level: 29, name: 'Снеговик',         skinFile: null,           hasSkin: false },
    { id: 30, level: 30, name: 'Древний Дракон',   skinFile: null,           hasSkin: false },
];

const MOBS = MOB_MANIFEST.map(item => {
    const level = item.level;
    const rarityIdx = Math.min(MOB_RARITY_COLORS.length - 1, Math.floor((level - 1) / 5));
    const textureKey = item.hasSkin ? `mob_${String(level).padStart(2, '0')}` : 'mob_placeholder';
    return {
        id: item.id,
        level,
        name: item.name,
        hasSkin: item.hasSkin,
        skinFile: item.skinFile,
        texture: textureKey,
        key: textureKey,
        rarity: rarityIdx,
        rarityColor: MOB_RARITY_COLORS[rarityIdx],
        clickReward: getMobClickReward(level),
        atk: getMobAtk(level),
        cost: getMobCost(level),
    };
});

// Получить моба по уровню (1-85+)
function getMobByLevel(level) {
    if (!level || level < 1) return null;
    let found = MOBS.find(m => m.level === level);
    if (!found && level <= 85) {
        // Динамический моб для уровней выше 30
        const rarityIdx = Math.min(MOB_RARITY_COLORS.length - 1, Math.floor((level - 1) / 5));
        return {
            id: level,
            level,
            name: `Сквиш #${level}`,
            hasSkin: false,
            skinFile: null,
            texture: 'mob_placeholder',
            key: 'mob_placeholder',
            rarity: rarityIdx,
            rarityColor: MOB_RARITY_COLORS[rarityIdx],
            clickReward: getMobClickReward(level),
            atk: getMobAtk(level),
            cost: getMobCost(level),
        };
    }
    return found || null;
}

// Получить следующего моба
function getNextMob(level) {
    return getMobByLevel(level + 1);
}
