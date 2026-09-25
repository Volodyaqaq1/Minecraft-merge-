// ============================================================
// data/bot_names.js — имена ботов и генератор команд со случайным балансом
// ============================================================

const BOT_NAMES = [
    'SquishyChamp', 'CubeMaster',   'MergeHero',    'DragonRider',
    'ShadowKnight', 'FrostMage',    'BeastMaster',  'MegaMerger',
    'StarGamer',    'TitanLord',    'PixelPro',     'GoldenSpark',
    'StormBringer', 'IronClaw',     'CrystalKing',  'GigaMerge',
    'SuperSlime',   'FireKnight',   'VoidSeeker',   'NightRanger',
    'SwiftHunter',  'AncientKeeper','MagicCaster',  'EpicBattler',
    'ThunderStrike','FlameHeart',   'FrostBite',    'ShadowFang',
    'ApexPredator', 'MythicBeast',  'CosmicMerger', 'UltraGamer',
    'BraveWarrior', 'OmegaStrike',  'NovaBurst',    'HyperMerge',
    'RuneMaster',   'DarkSoul',     'SolarFlare',   'AstralVoyager',
    'ChronoKnight', 'VortexMage',   'EchoHunter',   'PhantomStriker',
    'TitanSlayer',  'PrismLord',    'EmberSpirit',  'SkyRider',
    'AbyssWalker',  'InfinityKing',
];

// Получить случайный ник бота
function getRandomBotName() {
    return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}

/**
 * Сгенерировать команду бота из 3 бойцов на основе суммарной силы игрока:
 * - 1 боец игрока -> targetBotPower = playerPower * random(1.15, 1.35) [заметно сложнее]
 * - 2 бойца игрока -> targetBotPower = playerPower * random(1.05, 1.20) [слегка сложный / равный]
 * - 3 бойца игрока -> targetBotPower = playerPower * random(0.95, 1.10) [примерно равный]
 * Под бюджет подбираются 3 моба логичных уровней вокруг прогресса игрока.
 */
function generateBotTeam(playerFightersOrLevel) {
    let playerPower = 0;
    let avgLevel = 1;
    let fighterCount = 3;

    if (Array.isArray(playerFightersOrLevel) && playerFightersOrLevel.length > 0) {
        fighterCount = playerFightersOrLevel.length;
        playerPower = playerFightersOrLevel.reduce((sum, m) => {
            const atk = m.atk || (typeof getMobAtk === 'function' ? getMobAtk(m.level) : 12);
            return sum + atk;
        }, 0);
        const sumLevels = playerFightersOrLevel.reduce((sum, m) => sum + (m.level || 1), 0);
        avgLevel = Math.max(1, Math.round(sumLevels / fighterCount));
    } else if (typeof playerFightersOrLevel === 'number') {
        avgLevel = Math.max(1, Math.min(CONFIG.MOB_LEVELS, Math.round(playerFightersOrLevel)));
        const mob = getMobByLevel(avgLevel);
        const baseAtk = mob ? mob.atk : (typeof getMobAtk === 'function' ? getMobAtk(avgLevel) : 12);
        fighterCount = 3;
        playerPower = baseAtk * 3;
    } else {
        avgLevel = 1;
        playerPower = 36;
        fighterCount = 3;
    }

    // Определение диапазона множителя силы в зависимости от числа бойцов игрока
    let minMult = 0.95;
    let maxMult = 1.10;
    if (fighterCount === 1) {
        minMult = 1.15;
        maxMult = 1.35;
    } else if (fighterCount === 2) {
        minMult = 1.05;
        maxMult = 1.20;
    } else {
        minMult = 0.95;
        maxMult = 1.10;
    }

    const multiplier = minMult + Math.random() * (maxMult - minMult);
    const targetBotPower = Math.round(playerPower * multiplier);
    const lowAllowed = Math.round(playerPower * minMult);
    const highAllowed = Math.round(playerPower * maxMult);

    // Диапазон уровней мобов для перебора троек вокруг уровня игрока
    let minLvl = Math.max(1, avgLevel - 3);
    let maxLvl = Math.min(CONFIG.MOB_LEVELS, avgLevel + 2);

    // Расширяем диапазон при необходимости, чтобы гарантированно покрыть бюджет
    while (minLvl > 1 && (getMobByLevel(minLvl)?.atk || 12) * 3 > targetBotPower) {
        minLvl--;
    }
    while (maxLvl < CONFIG.MOB_LEVELS && (getMobByLevel(maxLvl)?.atk || 12) * 3 < targetBotPower) {
        maxLvl++;
    }

    const combos = [];
    for (let l1 = minLvl; l1 <= maxLvl; l1++) {
        const a1 = getMobByLevel(l1)?.atk || 12;
        for (let l2 = minLvl; l2 <= l1; l2++) {
            const a2 = getMobByLevel(l2)?.atk || 12;
            for (let l3 = minLvl; l3 <= l2; l3++) {
                const a3 = getMobByLevel(l3)?.atk || 12;
                const tot = a1 + a2 + a3;
                const diff = Math.abs(tot - targetBotPower);
                combos.push({ diff, tot, levels: [l1, l2, l3] });
            }
        }
    }

    // Предпочитаем комбинации, попадающие строго в допустимый диапазон бюджета
    const inRangeCombos = combos.filter(c => c.tot >= lowAllowed && c.tot <= highAllowed);
    let chosen = null;

    if (inRangeCombos.length > 0) {
        inRangeCombos.sort((a, b) => a.diff - b.diff);
        const bestDiff = inRangeCombos[0].diff;
        // Берём среди лучших кандидатов (в пределах небольшой вариации) для разнообразия
        const topPool = inRangeCombos.filter(c => c.diff <= bestDiff + 20);
        chosen = topPool[Math.floor(Math.random() * topPool.length)];
    } else if (combos.length > 0) {
        combos.sort((a, b) => a.diff - b.diff);
        chosen = combos[0];
    }

    const chosenLevels = chosen ? chosen.levels : [avgLevel, avgLevel, avgLevel];
    const team = chosenLevels.map(lvl => getMobByLevel(lvl)).filter(Boolean);

    // Гарантируем ровно 3 моба
    while (team.length < CONFIG.BATTLE_MAX_FIGHTERS) {
        team.push(getMobByLevel(avgLevel) || getMobByLevel(1));
    }

    return team.sort((a, b) => b.atk - a.atk);
}
