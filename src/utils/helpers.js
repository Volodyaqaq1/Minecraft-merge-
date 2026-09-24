// ============================================================
// utils/helpers.js — вспомогательные функции
// ============================================================

/**
 * Форматировать большое число: 1234 → "1.23K", 1234567 → "1.23M"
 */
function formatNumber(n) {
    if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T';
    if (n >= 1_000_000_000)     return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000)         return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000)             return (n / 1_000).toFixed(2) + 'K';
    return Math.floor(n).toString();
}

/**
 * Линейная интерполяция
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Случайное целое в диапазоне [min, max]
 */
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Перемешать массив (Fisher-Yates)
 */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Получить уровень игрока по XP
 */
function getLevelFromXP(xp) {
    const table = CONFIG.XP_TO_LEVEL;
    for (let i = table.length - 1; i >= 0; i--) {
        if (xp >= table[i]) return i + 1;
    }
    return 1;
}

/**
 * Получить множитель монет по уровню игрока
 */
function getMultiplier(playerLevel) {
    const levels = (typeof CONFIG !== 'undefined' && CONFIG.MULTIPLIER_LEVELS) || [1, 5, 10, 15, 20];
    let mul = 1;
    for (let i = 0; i < levels.length; i++) {
        if (playerLevel >= levels[i]) mul = i + 1;
    }
    return mul;
}

/**
 * Единый UI helper для создания четкого HD текста с учетом devicePixelRatio
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {object} style
 * @returns {Phaser.GameObjects.Text}
 */
function createHDText(scene, x, y, text, style = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetRes = style.resolution !== undefined ? style.resolution : dpr;
    const hdStyle = {
        fontFamily: (typeof CONFIG !== 'undefined' && CONFIG.FONT_FAMILY) || "'Nunito', sans-serif",
        ...style,
        resolution: targetRes,
    };
    const t = scene.add.text(x, y, text, hdStyle);
    if (t.frame && t.frame.source) {
        t.frame.source.resolution = targetRes;
    }
    Object.defineProperty(t, 'resolution', {
        get() { return this.style ? this.style.resolution : targetRes; },
        set(val) {
            if (this.style) this.style.setResolution(val);
            if (this.frame && this.frame.source) this.frame.source.resolution = val;
        },
        configurable: true
    });
    return t;
}

/**
 * Анимация всплывающего текста (урон / мёрдж)
 * scene: Phaser.Scene, x, y: координаты, text: строка, color: hex string
 */
function spawnFloatingText(scene, x, y, text, color = '#ffffff') {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const t = createHDText(scene, x, y, text, {
        fontSize: '22px',
        fontStyle: '900',
        color: color,
        stroke: '#111625',
        strokeThickness: 3.5,
        shadow: { blur: 6, color: '#000', fill: true },
        resolution: dpr,
    }).setOrigin(0.5, 1).setDepth(100);

    scene.tweens.add({
        targets: t,
        y: y - 60,
        alpha: 0,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 900,
        ease: 'Power2',
        onComplete: () => t.destroy(),
    });
}

/**
 * Shake-анимация объекта (при получении урона)
 * Предотвращает накопление сдвига координат при частых ударах
 */
function shakeObject(scene, obj, offset = 6) {
    if (!obj || !scene) return;
    if (obj._shakeBaseX === undefined) {
        obj._shakeBaseX = obj.x;
    }
    scene.tweens.killTweensOf(obj);
    obj.x = obj._shakeBaseX;

    scene.tweens.add({
        targets: obj,
        x: obj._shakeBaseX + offset,
        duration: 50,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.InOut',
        onComplete: () => {
            if (obj && obj._shakeBaseX !== undefined) {
                obj.x = obj._shakeBaseX;
            }
        }
    });
}

/**
 * Нарисовать скруглённый прямоугольник (Phaser Graphics)
 */
function drawRoundRect(graphics, x, y, w, h, r, fillColor, alpha = 1, strokeColor = null, strokeWidth = 0) {
    graphics.fillStyle(fillColor, alpha);
    graphics.fillRoundedRect(x, y, w, h, r);
    if (strokeColor !== null) {
        graphics.lineStyle(strokeWidth, strokeColor, 1);
        graphics.strokeRoundedRect(x, y, w, h, r);
    }
}
