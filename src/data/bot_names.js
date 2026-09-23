// ============================================================
// data/bot_names.js — имена ботов для системы боёв
// ============================================================

const BOT_NAMES = [
    'SteveKing',    'CreeperBoy',   'DiamondMiner', 'EnderDragon99',
    'ZombieLord',   'SkeletonPro',  'NetherWalker', 'CraftMaster',
    'BlockBreaker', 'SpiderQueen',  'WitchHunter',  'IronGolemX',
    'PhantomGhost', 'BlazeRunner',  'GhastSlayer',  'SlimeKing',
    'MagmaJumper',  'WitherBoss',   'GuardianEye',  'PillagerX',
    'RavagerZ',     'IllusionMage', 'ZoglinRoar',   'WandererSoul',
    'SnowGolemPro', 'CaveSpider7',  'EndermanDark', 'SkeleWither',
    'DragonRider',  'EmeraldKing',  'HerobrineX',   'MinerSteve',
    'NightCrawler', 'SwampWitch',   'LavaWalker',   'IceGolem',
    'TnTmaster',    'ObsidianKing', 'GoldHunter',   'DiamondSword',
    'RedstoneGod',  'PistonPro',    'MossyRock',    'SandDragon',
    'DungeonBoss',  'NetherKing',   'EndPortal99',  'CraftingTable',
    'AnvilKing',    'FurnaceFire',
];

// Получить случайный ник бота
function getRandomBotName() {
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

// Сгенерировать команду бота (до 3 мобов, соразмерных уровню игрока)
function generateBotTeam(playerMaxLevel) {
    const team = [];
    const count = CONFIG.BATTLE_MAX_FIGHTERS;
    // Уровни бота: случайные вокруг уровня игрока (±2)
    for (let i = 0; i < count; i++) {
        let lvl = playerMaxLevel + Math.floor(Math.random() * 5) - 2;
        lvl = Math.max(1, Math.min(CONFIG.MOB_LEVELS, lvl));
        team.push(getMobByLevel(lvl));
    }
    // Сортируем по АТК убывающей (как у игрока)
    return team.sort((a, b) => b.atk - a.atk);
}
