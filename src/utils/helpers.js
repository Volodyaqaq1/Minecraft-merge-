// ============================================================
// utils/helpers.js — вспомогательные функции
// ============================================================

/**
 * Форматировать большое число: 1234 → "1.23K", 1234567 → "1.23M"
 */
function formatNumber(n) {
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1_000_000_000_000_000) return (n / 1_000_000_000_000_000).toFixed(2) + 'Q';
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
 * Единый UI helper для создания четкого HD текста с учетом devicePixelRatio и RENDER_SCALE
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} text
 * @param {object} style
 * @returns {Phaser.GameObjects.Text}
 */
function createHDText(scene, x, y, text, style = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderScale = (typeof CONFIG !== 'undefined' && CONFIG.RENDER_SCALE) ? CONFIG.RENDER_SCALE : 2;
    const defaultRes = Math.min(2, Math.max(dpr, renderScale));
    const targetRes = style.resolution !== undefined ? style.resolution : defaultRes;
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
 * Настроить камеру сцены для True HiDPI рендеринга.
 * Масштабирует камеру под физический backing buffer, центрируя логический вьюпорт 960x540.
 */
function setupSceneHiDPICamera(scene) {
    if (!scene || !scene.cameras || !scene.cameras.main) return;
    const cam = scene.cameras.main;
    const logicalW = (typeof CONFIG !== 'undefined' && CONFIG.WIDTH) || 960;
    const logicalH = (typeof CONFIG !== 'undefined' && CONFIG.HEIGHT) || 540;
    const renderScale = (scene.game && scene.game.config && scene.game.config.width)
        ? (scene.game.config.width / logicalW)
        : ((typeof CONFIG !== 'undefined' && CONFIG.RENDER_SCALE) || 1);
    cam.setZoom(renderScale);
    cam.centerOn(logicalW / 2, logicalH / 2);
    // Сразу вычисляем матрицы камеры до первого кадра рендера
    cam.preRender();
}

/**
 * Преобразовать координаты указателя в логические координаты игры (960x540).
 */
function getLogicalPointer(pointer, scene) {
    if (!pointer) return { x: 0, y: 0 };
    const cam = (scene && scene.cameras && scene.cameras.main) || (pointer && pointer.camera);
    if (cam) {
        return cam.getWorldPoint(pointer.x, pointer.y);
    }
    return {
        x: pointer.worldX !== undefined ? pointer.worldX : pointer.x,
        y: pointer.worldY !== undefined ? pointer.worldY : pointer.y
    };
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

/**
 * Затенить цвет на заданный процент
 */
function darkenColor(col, factor = 0.35) {
    const hex = typeof col === 'string' ? parseInt(col.replace('#', ''), 16) : col;
    const r = Math.max(0, Math.floor(((hex >> 16) & 0xff) * (1 - factor)));
    const g = Math.max(0, Math.floor(((hex >> 8) & 0xff) * (1 - factor)));
    const b = Math.max(0, Math.floor((hex & 0xff) * (1 - factor)));
    return (r << 16) | (g << 8) | b;
}

/**
 * Осветлить цвет на заданный процент
 */
function lightenColor(col, factor = 0.25) {
    const hex = typeof col === 'string' ? parseInt(col.replace('#', ''), 16) : col;
    const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) + (255 - ((hex >> 16) & 0xff)) * factor));
    const g = Math.min(255, Math.floor(((hex >> 8) & 0xff) + (255 - ((hex >> 8) & 0xff)) * factor));
    const b = Math.min(255, Math.floor((hex & 0xff) + (255 - (hex & 0xff)) * factor));
    return (r << 16) | (g << 8) | b;
}

/**
 * Создать объемную казуальную 3D-кнопку с тактильным эффектом нажатия
 * @param {Phaser.Scene} scene
 * @param {number} x - центр X
 * @param {number} y - центр Y
 * @param {number} w - ширина
 * @param {number} h - высота
 * @param {string} text - текст кнопки
 * @param {object} options - { topColor, bottomColor, strokeColor, fontSize, icon, pulse, radius, lip }
 * @param {function} onClick - обработчик клика
 */
function createCasualButton(scene, x, y, w, h, text, options = {}, onClick = null) {
    const r = options.radius !== undefined ? options.radius : Math.min(14, h / 2);
    const topHex = typeof options.topColor === 'string'
        ? parseInt(options.topColor.replace('#', ''), 16)
        : (options.topColor !== undefined ? options.topColor : 0x22c55e);
    const botHex = options.bottomColor !== undefined
        ? (typeof options.bottomColor === 'string' ? parseInt(options.bottomColor.replace('#', ''), 16) : options.bottomColor)
        : darkenColor(topHex, 0.38);
    const strokeHex = options.strokeColor !== undefined
        ? (typeof options.strokeColor === 'string' ? parseInt(options.strokeColor.replace('#', ''), 16) : options.strokeColor)
        : 0xffffff;
    const fontCol = options.textColor || '#ffffff';
    const fontSz = options.fontSize || '15px';
    const lip = options.lip !== undefined ? options.lip : 4;

    const container = scene.add.container(x, y);

    // 1. Нижняя 3D фаска (тень кнопки)
    const baseG = scene.add.graphics();
    baseG.fillStyle(botHex, 1);
    baseG.fillRoundedRect(-w / 2, -h / 2 + lip, w, h, r);
    container.add(baseG);

    // 2. Лицевая часть кнопки (сдвигается при нажатии)
    const faceContainer = scene.add.container(0, 0);

    const faceG = scene.add.graphics();
    faceG.fillStyle(topHex, 1);
    faceG.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    // Верхний внутренний световой блик
    faceG.fillStyle(0xffffff, 0.24);
    faceG.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, Math.max(4, h * 0.38), { tl: r - 2, tr: r - 2, bl: 4, br: 4 });
    // Тонкая обводка
    faceG.lineStyle(1.5, strokeHex, 0.55);
    faceG.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    faceContainer.add(faceG);

    // Текст
    const label = createHDText(scene, options.icon ? 10 : 0, 0, text, {
        fontSize: fontSz,
        fontFamily: CONFIG.FONT_FAMILY || "'Nunito', sans-serif",
        fontStyle: '900',
        color: fontCol,
        stroke: '#0f172a',
        strokeThickness: 3,
    }).setOrigin(0.5);
    faceContainer.add(label);

    // Опциональная иконка
    let iconObj = null;
    if (options.icon) {
        iconObj = scene.add.image(-label.width / 2 - 8, 0, options.icon);
        if (options.iconSize) {
            iconObj.setDisplaySize(options.iconSize, options.iconSize);
        }
        faceContainer.add(iconObj);
    }

    container.add(faceContainer);

    // Интерактивная зона
    const hitArea = scene.add.rectangle(0, lip / 2, w, h + lip, 0x000000, 0)
        .setInteractive({ cursor: 'pointer' });
    container.add(hitArea);

    let isDown = false;
    hitArea.on('pointerdown', () => {
        isDown = true;
        faceContainer.y = lip - 1;
        if (typeof SoundManager !== 'undefined' && SoundManager.playClick) {
            SoundManager.playClick();
        }
    });

    const release = () => {
        if (!isDown) return;
        isDown = false;
        faceContainer.y = 0;
    };

    hitArea.on('pointerup', () => {
        if (isDown) {
            release();
            if (onClick) onClick();
        }
    });
    hitArea.on('pointerout', release);

    if (options.pulse) {
        scene.tweens.add({
            targets: container,
            scaleX: options.pulseScale !== undefined ? options.pulseScale : 1.04,
            scaleY: options.pulseScale !== undefined ? options.pulseScale : 1.04,
            duration: options.pulseDuration !== undefined ? options.pulseDuration : 750,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    container.buttonFace = faceContainer;
    container.label = label;
    container.setText = (newText) => {
        label.setText(newText);
        if (iconObj) {
            iconObj.x = -label.width / 2 - 8;
        }
    };
    return container;
}

/**
 * Нарисовать стильную казуальную карточку с мягкой тенью и деликатной обводкой
 */
function drawCasualCard(graphics, x, y, w, h, r = 16, bgColor = 0x162032, borderColor = 0x38bdf8, borderAlpha = 0.8) {
    // 1. Мягкая внешняя тень
    graphics.fillStyle(0x000000, 0.25);
    graphics.fillRoundedRect(x + 1, y + 4, w, h, r);
    // 2. Тело карточки
    graphics.fillStyle(bgColor, 0.96);
    graphics.fillRoundedRect(x, y, w, h, r);
    // 3. Обводка
    if (borderColor !== null) {
        graphics.lineStyle(1.8, borderColor, borderAlpha);
        graphics.strokeRoundedRect(x, y, w, h, r);
    }
}

/**
 * Нарисовать полосу прогресса с мягким углублением и скругленным заполнением
 */
function drawCasualProgressBar(graphics, x, y, w, h, r = 6, progress = 0, bgColor = 0x0f172a, fillColor = 0x22c55e, borderColor = 0x334155) {
    const p = Phaser.Math.Clamp(progress, 0, 1);
    // 1. Фон-желобок
    graphics.fillStyle(bgColor, 0.95);
    graphics.fillRoundedRect(x, y, w, h, r);
    if (borderColor !== null) {
        graphics.lineStyle(1, borderColor, 0.8);
        graphics.strokeRoundedRect(x, y, w, h, r);
    }
    // 2. Заполнение
    if (p > 0.02) {
        const fillW = Math.max(r * 2, (w - 2) * p);
        graphics.fillStyle(fillColor, 1);
        graphics.fillRoundedRect(x + 1, y + 1, fillW, h - 2, r - 1);
        // Верхний световой блик
        graphics.fillStyle(0xffffff, 0.25);
        graphics.fillRoundedRect(x + 2, y + 2, fillW - 2, Math.max(2, (h - 4) * 0.4), r - 2);
    }
}
