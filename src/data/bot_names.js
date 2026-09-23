// ============================================================
// data/bot_names.js — имена ботов и генератор команд со случайным балансом
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

/**
 * Сгенерировать команду бота:
 * Случайный подбор:
 * - могут выпасть слабее твоих (легкая победа)
 * - могут выпасть ровно такие же (шанс 50 на 50)
 * - могут выпасть сильнее твоих (опасный бой)
 */
function generateBotTeam(playerFightersOrLevel) {
    let avgLevel = 1;
    let teamCount = CONFIG.BATTLE_MAX_FIGHTERS;

    if (Array.isArray(playerFightersOrLevel) && playerFightersOrLevel.length > 0) {
        teamCount = playerFightersOrLevel.length;
        const sum = playerFightersOrLevel.reduce((s, m) => s + (m.level || 1), 0);
        avgLevel = Math.round(sum / playerFightersOrLevel.length);
    } else if (typeof playerFightersOrLevel === 'number') {
        avgLevel = playerFightersOrLevel;
    }

    // Случайность подбора бота:
    const roll = Math.random();
    let levelShift = 0;

    if (roll < 0.35) {
        // 35% шанс: бот слабее (-1 или -2 уровня)
        levelShift = -randInt(1, 2);
    } else if (roll < 0.70) {
        // 35% шанс: бот точно такой же (0 сдвиг -> честный шанс 50/50!)
        levelShift = 0;
    } else {
        // 30% шанс: бот сильнее (+1 или +2 уровня)
        levelShift = randInt(1, 2);
    }

    const team = [];
    for (let i = 0; i < teamCount; i++) {
        // Небольшой разброс внутри команды бота (-1..+1)
        let lvl = avgLevel + levelShift + randInt(-1, 1);
        lvl = Math.max(1, Math.min(CONFIG.MOB_LEVELS, lvl));
        team.push(getMobByLevel(lvl));
    }

    return team.sort((a, b) => b.atk - a.atk);
}
