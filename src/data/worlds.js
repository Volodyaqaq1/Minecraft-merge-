// ============================================================
// data/worlds.js — Косметические скины игрового мира (фоны)
// Открываются по Уровню Игрока (Player Level), сохраняются в save
// ============================================================

const WORLDS = [
    {
        id: 'green_hills',
        name: 'Зелёные Холмы',
        unlockLevel: 1,
        desc: 'Спокойные зеленые луга и пушистые облака',
        icon: '🌿',
        skyTop: 0x5cbcf6, skyBottom: 0xc8eeff,
        hillsColor: 0x82ce42,
        lawnTop: 0x9ee54f, lawnBottom: 0x6dbf2b,
        treeTrunk: 0x785332, treeCrown: 0x4e9c2b,
        sunbeamAlpha: 0.10,
        foliageColor: 0x438622,
        hasStars: false,
    },
    {
        id: 'sunset_valley',
        name: 'Закатная Долина',
        unlockLevel: 5,
        desc: 'Золотистый закат над теплыми холмами',
        icon: '🌅',
        skyTop: 0xf97316, skyBottom: 0xfde047,
        hillsColor: 0xc2410c,
        lawnTop: 0xca8a04, lawnBottom: 0x854d0e,
        treeTrunk: 0x573412, treeCrown: 0xb45309,
        sunbeamAlpha: 0.16,
        foliageColor: 0x9a3412,
        hasStars: false,
    },
    {
        id: 'night_meadow',
        name: 'Ночной Луг',
        unlockLevel: 10,
        desc: 'Таинственная звездная ночь и светящаяся трава',
        icon: '🌙',
        skyTop: 0x090d16, skyBottom: 0x1e1b4b,
        hillsColor: 0x1e293b,
        lawnTop: 0x0f766e, lawnBottom: 0x134e4a,
        treeTrunk: 0x0f172a, treeCrown: 0x115e59,
        sunbeamAlpha: 0.05,
        foliageColor: 0x0f172a,
        hasStars: true,
    },
    {
        id: 'ice_world',
        name: 'Ледяной Мир',
        unlockLevel: 15,
        desc: 'Хрустальные ледники и снежные шапки',
        icon: '❄️',
        skyTop: 0x38bdf8, skyBottom: 0xe0f2fe,
        hillsColor: 0xbae6fd,
        lawnTop: 0xf0f9ff, lawnBottom: 0x7dd3fc,
        treeTrunk: 0x0369a1, treeCrown: 0x38bdf8,
        sunbeamAlpha: 0.12,
        foliageColor: 0x0284c7,
        hasStars: false,
    },
    {
        id: 'fire_world',
        name: 'Огненный Мир',
        unlockLevel: 20,
        desc: 'Базальтовые скалы и раскаленная лава',
        icon: '🔥',
        skyTop: 0x7f1d1d, skyBottom: 0x450a0a,
        hillsColor: 0x991b1b,
        lawnTop: 0x78350f, lawnBottom: 0x451a03,
        treeTrunk: 0x271005, treeCrown: 0xb91c1c,
        sunbeamAlpha: 0.18,
        foliageColor: 0x991b1b,
        hasStars: false,
    },
    {
        id: 'end_world',
        name: 'Мир Края',
        unlockLevel: 25,
        desc: 'Парящие острова в космической пустоте',
        icon: '🔮',
        skyTop: 0x18181b, skyBottom: 0x2e1065,
        hillsColor: 0x581c87,
        lawnTop: 0xfef08a, lawnBottom: 0xca8a04,
        treeTrunk: 0x3b0764, treeCrown: 0x7c3aed,
        sunbeamAlpha: 0.08,
        foliageColor: 0x4c1d95,
        hasStars: true,
    },
    {
        id: 'golden_world',
        name: 'Золотой Мир',
        unlockLevel: 30,
        desc: 'Царство сияющего золота и абсолютного триумфа',
        icon: '👑',
        skyTop: 0xfef08a, skyBottom: 0xffedd5,
        hillsColor: 0xf59e0b,
        lawnTop: 0xfbbf24, lawnBottom: 0xd97706,
        treeTrunk: 0x78350f, treeCrown: 0xfcd34d,
        sunbeamAlpha: 0.22,
        foliageColor: 0xb45309,
        hasStars: false,
    },
];

function getWorldById(id) {
    return WORLDS.find(w => w.id === id) || WORLDS[0];
}

function getAvailableWorlds(playerLevel) {
    const lvl = Math.max(1, playerLevel || 1);
    return WORLDS.filter(w => lvl >= w.unlockLevel);
}
