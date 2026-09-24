// ============================================================
// components/MergeField.js — свободное поле без сетки и логика слияния
// Stage 3 Step 1: Premium drag/merge/spawn feel
// ============================================================

class MergeField {
    /**
     * @param {Phaser.Scene} scene
     * @param {Economy} economy
     * @param {object} state  — сохранённое состояние { field:[], collection:[] }
     */
    constructor(scene, economy, state) {
        this.scene    = scene;
        this.economy  = economy;
        this.bounds   = CONFIG.FIELD_BOUNDS;
        this.mobSize  = CONFIG.MOB_SIZE;

        // Коллекция открытых мобов (числа уровней)
        this.collection = new Set();
        if (Array.isArray(state.collection) && state.collection.length > 0) {
            state.collection.forEach(lvl => this.collection.add(Number(lvl)));
        } else {
            this.collection.add(1);
        }

        // Уровни мобов, модалка для которых уже показывалась
        this.shownModals = new Set();
        if (Array.isArray(state.shownModals) && state.shownModals.length > 0) {
            state.shownModals.forEach(lvl => this.shownModals.add(Number(lvl)));
        } else {
            this.shownModals.add(1);
        }

        // Список всех активных мобов на поле: [{ id, mobLevel, container, x, y }]
        this.mobs = [];
        this._nextId = 1;

        // Коллбеки наружу (для GameScene)
        this.onMobClick          = null; // fn(mobData) -> кликер
        this.onMergeSuccess      = null; // fn(newMob, isNew) -> обновить магазин и показать модалку
        this.onNewMobDiscovered  = null; // fn(newMob) -> открытие нового моба из любого источника
        this.onMergeCombo        = null; // fn(comboCount) -> быстрое комбо слияний

        // Система комбо слияний
        this.lastMergeTime = 0;
        this.mergeCombo = 0;

        // Загрузить мобов из сохранения без ложных модалок открытия
        this._isLoading = true;
        this._loadFromState(state.field || []);
        this._isLoading = false;
    }

    // ============================================================
    // Создание моба на свободном поле
    // ============================================================

    spawnMob(mobLevel, targetX, targetY) {
        const mob = getMobByLevel(mobLevel);
        if (!mob) return null;

        // Если координаты не переданы, выбираем свободную позицию
        let x = targetX;
        let y = targetY;
        if (x === undefined || y === undefined) {
            let bestX = randInt(this.bounds.minX + 45, this.bounds.maxX - 45);
            let bestY = randInt(this.bounds.minY + 45, this.bounds.maxY - 45);
            let maxMinDist = -1;

            for (let attempt = 0; attempt < 24; attempt++) {
                const candX = randInt(this.bounds.minX + 45, this.bounds.maxX - 45);
                const candY = randInt(this.bounds.minY + 45, this.bounds.maxY - 45);
                if (this.mobs.length === 0) {
                    bestX = candX;
                    bestY = candY;
                    break;
                }
                let minDist = 999999;
                for (const m of this.mobs) {
                    const mx = m.container ? m.container.x : m.x;
                    const my = m.container ? m.container.y : m.y;
                    const d = Phaser.Math.Distance.Between(candX, candY, mx, my);
                    if (d < minDist) minDist = d;
                }
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestX = candX;
                    bestY = candY;
                }
                if (minDist >= 96) {
                    bestX = candX;
                    bestY = candY;
                    break;
                }
            }
            x = bestX;
            y = bestY;
        }

        const mobItem = {
            id: this._nextId++,
            mobLevel: mob.level,
            x: x,
            y: y,
            container: null,
        };

        mobItem.container = this._buildMobContainer(mobItem);
        mobItem.container.setScale(1.0);
        this.mobs.push(mobItem);

        // Проверяем, открыт ли этот уровень впервые
        const isNew = !this.collection.has(mob.level) || !this.shownModals.has(mob.level);
        this.collection.add(mob.level);

        if (isNew && !this._isLoading) {
            this.shownModals.add(mob.level);
            if (this.onNewMobDiscovered) {
                this.onNewMobDiscovered(mob);
            }
        }

        // Анимация появления
        if (this._isLoading) {
            mobItem.container.setScale(1.0);
            this._startMobWobble(mobItem);
        } else {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playPop();
            }
            this._playSpawnAnimation(mobItem);
        }

        return mobItem;
    }

    // ============================================================
    // Stage 3: Staggered bulk spawn for incubator / reward systems
    // ============================================================

    /**
     * Spawn multiple mobs with atomic state registration and staggered visual appearance.
     * All N mobs are added to this.mobs synchronously, guaranteeing transactional save safety.
     * The visual pop-in animation is staggered (75ms apart).
     */
    spawnMobsStaggered(mobLevel, count, onAllDone) {
        const mob = getMobByLevel(mobLevel);
        if (!mob || count <= 0) {
            if (onAllDone) onAllDone([]);
            return [];
        }

        const allocatedMobs = [];

        // 1. Synchronously allocate and register all mobs into this.mobs
        // This guarantees that any immediate save() captures the entire batch atomically.
        for (let i = 0; i < count; i++) {
            let bestX = randInt(this.bounds.minX + 45, this.bounds.maxX - 45);
            let bestY = randInt(this.bounds.minY + 45, this.bounds.maxY - 45);
            let maxMinDist = -1;
            for (let attempt = 0; attempt < 24; attempt++) {
                const candX = randInt(this.bounds.minX + 45, this.bounds.maxX - 45);
                const candY = randInt(this.bounds.minY + 45, this.bounds.maxY - 45);
                let minDist = 999999;
                for (const m of this.mobs) {
                    const mx = m.container ? m.container.x : m.x;
                    const my = m.container ? m.container.y : m.y;
                    const d = Phaser.Math.Distance.Between(candX, candY, mx, my);
                    if (d < minDist) minDist = d;
                }
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestX = candX;
                    bestY = candY;
                }
                if (minDist >= 96) { bestX = candX; bestY = candY; break; }
            }

            const mobItem = {
                id: this._nextId++,
                mobLevel: mob.level,
                x: bestX,
                y: bestY,
                container: null,
            };
            mobItem.container = this._buildMobContainer(mobItem);
            mobItem.container.setScale(0); // Initially scaled to 0 until its staggered reveal time
            this.mobs.push(mobItem);
            allocatedMobs.push(mobItem);

            // Collection / discovery check
            const isNew = !this.collection.has(mob.level) || !this.shownModals.has(mob.level);
            this.collection.add(mob.level);
            if (isNew && !this._isLoading) {
                this.shownModals.add(mob.level);
                if (this.onNewMobDiscovered) {
                    this.onNewMobDiscovered(mob);
                }
            }
        }

        // 2. Staggered visual animation (pop-pop-pop)
        let completedCount = 0;
        allocatedMobs.forEach((mobItem, idx) => {
            this.scene.time.delayedCall(idx * 75, () => {
                if (typeof SoundManager !== 'undefined') SoundManager.playPop();
                this._playSpawnAnimation(mobItem, () => {
                    completedCount++;
                    if (completedCount === allocatedMobs.length && onAllDone) {
                        onAllDone(allocatedMobs);
                    }
                });
            });
        });

        return allocatedMobs;
    }

    // ============================================================
    // Stage 3: Spawn animation — scale 0.5 → 1.14 → 1.0 + shadow pop
    // ============================================================

    _playSpawnAnimation(mobItem, onComplete) {
        if (!mobItem || !mobItem.container) return;
        const c = mobItem.container;

        // Find shadow (first child = graphics shadow)
        const shadow = c.list && c.list[0];

        c.setScale(0.5);
        if (shadow) { shadow.setAlpha(0); }

        this.scene.tweens.add({
            targets: c,
            scaleX: 1.14,
            scaleY: 1.14,
            duration: 140,
            ease: 'Back.Out',
            onComplete: () => {
                if (shadow) {
                    this.scene.tweens.add({
                        targets: shadow,
                        alpha: 1,
                        duration: 80,
                        ease: 'Quad.Out',
                    });
                }
                this.scene.tweens.add({
                    targets: c,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 100,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        if (c) {
                            c.setScale(1.0);
                            this._startMobWobble(mobItem);
                        }
                        if (onComplete) onComplete();
                    }
                });
            }
        });
    }

    /**
     * Плавная анимация покачивания/дыхания (idle wobble) для сквишей
     */
    _startMobWobble(mobItem) {
        if (!mobItem || !mobItem.container) return;
        this.scene.tweens.killTweensOf(mobItem.container);
        mobItem.container.setScale(1.0);
        const baseY = mobItem.y;
        mobItem.container.y = baseY;

        mobItem._wobbleTween = this.scene.tweens.add({
            targets: mobItem.container,
            scaleY: 1.035,
            scaleX: 0.985,
            y: baseY - 3,
            duration: 1200 + randInt(0, 400),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: randInt(20, 500),
        });
    }

    _buildMobContainer(mobItem) {
        const { scene, mobSize } = this;
        const mob = getMobByLevel(mobItem.mobLevel);

        const container = scene.add.container(mobItem.x, mobItem.y);
        container.setDepth(20 + Math.floor(mobItem.y));
        container.setScale(1.0);

        // 1. Мягкая тень под ногами персонажа
        const shadow = scene.add.graphics();
        shadow.fillStyle(0x0a2808, 0.28);
        shadow.fillEllipse(0, mobSize / 2 - 8, mobSize * 0.74, 16);
        shadow.fillStyle(0x0a2808, 0.14);
        shadow.fillEllipse(0, mobSize / 2 - 8, mobSize * 0.88, 22);
        container.add(shadow);

        // 2. Аура для повышенных визуальных тиров
        if (mob.tier === 2) {
            const goldAura = scene.add.graphics();
            goldAura.fillStyle(0xffd700, 0.25);
            goldAura.fillCircle(0, -6, mobSize * 0.48);
            container.add(goldAura);
        } else if (mob.tier === 3) {
            const diaAura = scene.add.graphics();
            diaAura.fillStyle(0x00e6ff, 0.25);
            diaAura.fillCircle(0, -6, mobSize * 0.48);
            container.add(diaAura);
        }

        // 3. SPRITE
        const spriteTex = (mob.spriteKey && scene.textures.exists(mob.spriteKey))
            ? mob.spriteKey
            : (scene.textures.exists(mob.texture) ? mob.texture : 'mob_sprite_placeholder');
        const mobImg = scene.add.image(0, -6, spriteTex).setDisplaySize(mobSize * 0.95, mobSize * 0.95);
        container.add(mobImg);

        // 4. Имя моба
        const nameText = createHDText(scene, 0, mobSize / 2 - 10, mob.name, {
            fontSize: '10.5px',
            color: mob.tier === 2 ? '#ffd700' : (mob.tier === 3 ? '#38bdf8' : '#ffffff'),
            stroke: '#0f172a',
            strokeThickness: 2,
            fontStyle: '800',
        }).setOrigin(0.5);

        const nameBadge = scene.add.graphics();
        const badgeW = Math.min(Math.max(42, nameText.width + 12), Math.round(mobSize * 0.76));
        drawRoundRect(nameBadge, -badgeW / 2, mobSize / 2 - 19, badgeW, 18, 9, 0x0f172a, 0.90, mob.tierColor || 0x64748b, 1.2);
        container.add(nameBadge);
        container.add(nameText);

        // 5. Бейдж уровня
        const lvlBadge = scene.add.graphics();
        const badgeBorderColor = mob.tier === 2 ? 0xffd700 : (mob.tier === 3 ? 0x00e6ff : 0x64748b);
        const lvlBadgeX = -Math.round(mobSize * 0.30);
        const lvlBadgeY = -Math.round(mobSize * 0.42);
        const lvlBadgeW = 24;
        const lvlBadgeH = 17;
        drawRoundRect(lvlBadge, lvlBadgeX - lvlBadgeW / 2, lvlBadgeY - lvlBadgeH / 2, lvlBadgeW, lvlBadgeH, 8, 0x0f172a, 0.92, badgeBorderColor, 1.2);
        container.add(lvlBadge);

        const lvlText = createHDText(scene, lvlBadgeX, lvlBadgeY, `${mobItem.mobLevel}`, {
            fontSize: '11px',
            color: mob.tier === 2 ? '#ffd700' : (mob.tier === 3 ? '#38bdf8' : '#ffffff'),
            fontStyle: '900',
            stroke: '#0f172a',
            strokeThickness: 2,
        }).setOrigin(0.5);
        container.add(lvlText);

        // 8. Интерактивность: Drag & Click
        container.setInteractive(
            new Phaser.Geom.Circle(0, -6, mobSize / 2 + 8),
            Phaser.Geom.Circle.Contains
        );
        scene.input.setDraggable(container);

        // Stage 3: drag velocity tracking
        let startPointerPos = { x: 0, y: 0 };
        let hasMoved = false;
        let lastDragX = 0;
        let lastDragPos = { x: 0, y: 0 };
        let dragVelX = 0;
        let dragVelY = 0;
        let currentAngle = 0;
        let dragScaleX = 1.0;
        let dragScaleY = 1.0;

        container.on('pointerdown', (ptr) => {
            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;
            startPointerPos = { x: wx, y: wy };
            lastDragPos = { x: wx, y: wy };
            hasMoved = false;
            dragVelX = 0;
            dragVelY = 0;
        });

        container.on('dragstart', () => {
            scene.tweens.killTweensOf(container);
            container.setDepth(500);

            // Save previous valid coordinates for invalid-drop restoration
            mobItem._prevValidX = mobItem.x;
            mobItem._prevValidY = mobItem.y;

            // Stage 3: shadow element (first child)
            const sh = container.list[0];

            // Lift effect: shadow shrinks and fades
            if (sh) {
                scene.tweens.add({
                    targets: sh,
                    scaleX: 0.72,
                    scaleY: 0.72,
                    alpha: 0.55,
                    duration: 90,
                    ease: 'Quad.Out',
                });
            }

            // Squash pickup: scaleX 1.08, scaleY 0.94 then ease to lifted scale
            container.setScale(1.0);
            scene.tweens.add({
                targets: container,
                scaleX: 1.08,
                scaleY: 0.94,
                duration: 55,
                ease: 'Quad.Out',
                onComplete: () => {
                    scene.tweens.add({
                        targets: container,
                        scaleX: 1.10,
                        scaleY: 1.10,
                        duration: 80,
                        ease: 'Back.Out',
                    });
                }
            });

            dragScaleX = 1.10;
            dragScaleY = 1.10;
            currentAngle = 0;
        });

        container.on('drag', (ptr, dragX, dragY) => {
            container.x = dragX;
            container.y = dragY;

            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;

            if (Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, wx, wy) > 10) {
                hasMoved = true;
            }

            // Stage 3: compute velocity for stretch + lean
            const dvx = wx - lastDragPos.x;
            const dvy = wy - lastDragPos.y;
            // Smooth velocity via lerp (avoids snapping)
            dragVelX = lerp(dragVelX, dvx * 60, 0.28); // approx px/sec
            dragVelY = lerp(dragVelY, dvy * 60, 0.28);
            lastDragPos = { x: wx, y: wy };

            // Stretch based on speed — max ±12% deformation
            const speed = Math.sqrt(dragVelX * dragVelX + dragVelY * dragVelY);
            const maxDeform = 0.12;
            const stretchAmount = Math.min(maxDeform, speed * 0.00018);

            // Stretch along primary axis: fast horizontal → wider, fast vertical → taller
            const horizDom = Math.abs(dragVelX) > Math.abs(dragVelY);
            const targetScaleX = horizDom
                ? 1.10 + stretchAmount
                : 1.10 - stretchAmount * 0.5;
            const targetScaleY = horizDom
                ? 1.10 - stretchAmount * 0.5
                : 1.10 + stretchAmount;

            dragScaleX = lerp(dragScaleX, targetScaleX, 0.22);
            dragScaleY = lerp(dragScaleY, targetScaleY, 0.22);

            // Subtle rotation lean in direction of horizontal movement — max ±3 degrees
            const targetAngle = Phaser.Math.Clamp(dragVelX * 0.012, -3, 3);
            currentAngle = lerp(currentAngle, targetAngle, 0.18);

            container.setScale(dragScaleX, dragScaleY);
            container.setAngle(currentAngle);
        });

        container.on('dragend', (ptr) => {
            container.setAngle(0);
            container.setDepth(20 + Math.floor(container.y));

            const sh = container.list[0];
            // Restore shadow
            if (sh) {
                scene.tweens.add({
                    targets: sh,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    alpha: 1.0,
                    duration: 120,
                    ease: 'Quad.Out',
                });
            }

            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;
            const moveDist = Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, wx, wy);
            if (!hasMoved && moveDist < 12) {
                this._handleMobClick(mobItem, container);
                return;
            }

            this._handleMobDrop(mobItem);
        });

        return container;
    }

    // ============================================================
    // Кликер по мобу (Squash & Stretch физика)
    // ============================================================

    _handleMobClick(mobItem, container) {
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playClink();
        }

        this.scene.tweens.killTweensOf(container);
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.22,
            scaleY: 0.80,
            duration: 70,
            ease: 'Quad.Out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: container,
                    scaleX: 0.94,
                    scaleY: 1.10,
                    duration: 90,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: container,
                            scaleX: 1.0,
                            scaleY: 1.0,
                            duration: 110,
                            ease: 'Back.Out',
                            onComplete: () => {
                                if (container) {
                                    container.setScale(1.0);
                                    this._startMobWobble(mobItem);
                                }
                            }
                        });
                    }
                });
            }
        });

        if (CONFIG.XP_PER_CLICK) {
            this.economy.addXP(CONFIG.XP_PER_CLICK);
        }

        if (this.onMobClick) {
            this.onMobClick(mobItem);
        }
    }

    // ============================================================
    // Логика слияния (Drag and Drop)
    // ============================================================

    _handleMobDrop(draggedItem) {
        const curX = draggedItem.container.x;
        const curY = draggedItem.container.y;

        let targetMob = null;
        let minDist = CONFIG.MERGE_RADIUS;

        for (const other of this.mobs) {
            if (other.id === draggedItem.id) continue;
            if (other.mobLevel !== draggedItem.mobLevel) continue;

            const dist = Phaser.Math.Distance.Between(curX, curY, other.container.x, other.container.y);
            if (dist < minDist) {
                minDist = dist;
                targetMob = other;
            }
        }

        if (targetMob && draggedItem.mobLevel < CONFIG.MOB_LEVELS) {
            // УСПЕШНОЕ СЛИЯНИЕ!
            this._executeMerge(draggedItem, targetMob);
            return;
        }

        // Проверяем: это невалидный сброс?
        // Невалидный сброс:
        // 1) Выход за пределы игрового поля (curX < minX || curX > maxX || curY < minY || curY > maxY)
        // 2) Сброс прямо на другого моба ДРУГОГО уровня (дистанция < 55px)
        const isOutOfBounds = (
            curX < this.bounds.minX ||
            curX > this.bounds.maxX ||
            curY < this.bounds.minY ||
            curY > this.bounds.maxY
        );

        let droppedOnOtherMob = false;
        for (const other of this.mobs) {
            if (other.id === draggedItem.id) continue;
            const ox = other.container ? other.container.x : other.x;
            const oy = other.container ? other.container.y : other.y;
            if (Phaser.Math.Distance.Between(curX, curY, ox, oy) < 55) {
                droppedOnOtherMob = true;
                break;
            }
        }

        if (isOutOfBounds || droppedOnOtherMob) {
            this._playInvalidDropAnimation(draggedItem);
            return;
        }

        // ВАЛИДНЫЙ СБРОС (Valid Drop на свободное место)
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playPop();
        }

        let adjustedX = curX;
        let adjustedY = curY;
        const minSpacing = 86;
        for (let pass = 0; pass < 3; pass++) {
            for (const other of this.mobs) {
                if (other.id === draggedItem.id) continue;
                const ox = other.container ? other.container.x : other.x;
                const oy = other.container ? other.container.y : other.y;
                const dist = Phaser.Math.Distance.Between(adjustedX, adjustedY, ox, oy);
                if (dist < minSpacing) {
                    let angle = Phaser.Math.Angle.Between(ox, oy, adjustedX, adjustedY);
                    if (dist < 4) angle = Math.random() * Math.PI * 2;
                    adjustedX = ox + Math.cos(angle) * minSpacing;
                    adjustedY = oy + Math.sin(angle) * minSpacing;
                }
            }
        }

        const clampedX = Phaser.Math.Clamp(adjustedX, this.bounds.minX + 35, this.bounds.maxX - 35);
        const clampedY = Phaser.Math.Clamp(adjustedY, this.bounds.minY + 35, this.bounds.maxY - 35);

        draggedItem.x = clampedX;
        draggedItem.y = clampedY;
        draggedItem.container.setDepth(20 + Math.floor(clampedY));

        // Stage 3: landing squash sequence
        this._playLandingAnimation(draggedItem, clampedX, clampedY);
    }

    // ============================================================
    // Stage 3: Invalid drop feedback — snap back to valid position,
    // horizontal shake: -4px -> +4px -> -2px -> 0 with subtle squash
    // ============================================================

    _playInvalidDropAnimation(mobItem) {
        const c = mobItem.container;
        const scene = this.scene;
        if (!c) return;

        const origX = mobItem._prevValidX !== undefined ? mobItem._prevValidX : mobItem.x;
        const origY = mobItem._prevValidY !== undefined ? mobItem._prevValidY : mobItem.y;

        // Restore target logical coordinates to original valid position
        mobItem.x = origX;
        mobItem.y = origY;
        c.setDepth(20 + Math.floor(origY));

        scene.tweens.killTweensOf(c);
        c.setAngle(0);

        // Soft low-frequency pop / error sound
        if (typeof SoundManager !== 'undefined' && SoundManager.playClick) {
            SoundManager.playClick();
        }

        // Restore shadow
        const sh = c.list && c.list[0];
        if (sh) {
            scene.tweens.add({
                targets: sh,
                scaleX: 1.0, scaleY: 1.0, alpha: 1.0,
                duration: 90, ease: 'Quad.Out'
            });
        }

        // Return immediately to original position, then horizontal shake with subtle squash
        // Sequence: -4px -> +4px -> -2px -> original (total ~150ms)
        c.x = origX;
        c.y = origY;
        c.setScale(1.08, 0.94); // subtle squash

        scene.tweens.add({
            targets: c,
            x: origX - 4,
            duration: 35,
            ease: 'Quad.Out',
            onComplete: () => {
                scene.tweens.add({
                    targets: c,
                    x: origX + 4,
                    duration: 45,
                    ease: 'Quad.InOut',
                    onComplete: () => {
                        scene.tweens.add({
                            targets: c,
                            x: origX - 2,
                            duration: 35,
                            ease: 'Quad.InOut',
                            onComplete: () => {
                                scene.tweens.add({
                                    targets: c,
                                    x: origX,
                                    scaleX: 1.0,
                                    scaleY: 1.0,
                                    duration: 35,
                                    ease: 'Quad.Out',
                                    onComplete: () => {
                                        if (c) {
                                            c.x = origX;
                                            c.y = origY;
                                            c.setScale(1.0);
                                            this._startMobWobble(mobItem);
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // ============================================================
    // Stage 3: Satisfying landing squash → overshoot → settle
    // ============================================================

    _playLandingAnimation(mobItem, targetX, targetY) {
        const c = mobItem.container;
        const scene = this.scene;

        // Snap position immediately
        scene.tweens.killTweensOf(c);
        c.x = targetX;
        c.y = targetY;
        c.setAngle(0);

        // Shadow snap back
        const sh = c.list && c.list[0];
        if (sh) {
            scene.tweens.add({
                targets: sh,
                scaleX: 1.0, scaleY: 1.0, alpha: 1.0,
                duration: 60, ease: 'Quad.Out'
            });
        }

        // Phase 1: Squash on impact
        scene.tweens.add({
            targets: c,
            scaleX: 1.16,
            scaleY: 0.84,
            duration: 65,
            ease: 'Quad.Out',
            onComplete: () => {
                // Phase 2: Overshoot up
                scene.tweens.add({
                    targets: c,
                    scaleX: 0.94,
                    scaleY: 1.10,
                    duration: 90,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        // Phase 3: Settle
                        scene.tweens.add({
                            targets: c,
                            scaleX: 1.0,
                            scaleY: 1.0,
                            duration: 100,
                            ease: 'Back.Out',
                            onComplete: () => {
                                if (c) {
                                    c.setScale(1.0);
                                    this._startMobWobble(mobItem);
                                }
                            }
                        });
                    }
                });
            }
        });

        // Landing dust — 6 tiny particles
        this._spawnLandingDust(targetX, targetY);
    }

    // ============================================================
    // Stage 3: Landing dust particles (grass/pale-green puffs)
    // ============================================================

    _spawnLandingDust(x, y) {
        const scene = this.scene;
        const groundY = y + (this.mobSize / 2) - 10;
        const colors = ['#b7f5a0', '#d4f7c5', '#ffffff', '#a8edc0'];
        const count = 6;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI) + ((i / count) * Math.PI) + (Math.random() - 0.5) * 0.7;
            const speed = 20 + Math.random() * 22;
            const size = randInt(3, 6);
            const g = scene.add.graphics().setDepth(18);
            const col = parseInt(colors[i % colors.length].replace('#', ''), 16);
            g.fillStyle(col, 0.82);
            g.fillCircle(0, 0, size);
            g.x = x;
            g.y = groundY;

            scene.tweens.add({
                targets: g,
                x: x + Math.cos(angle) * speed,
                y: groundY + Math.sin(angle) * speed * 0.5,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 250 + Math.random() * 200,
                ease: 'Cubic.Out',
                onComplete: () => g.destroy(),
            });
        }
    }

    // ============================================================
    // Stage 3: Merge sequence — attraction → impact → reveal
    // ============================================================

    _executeMerge(draggedItem, targetItem) {
        const newLevel = targetItem.mobLevel + 1;
        const newMob   = getMobByLevel(newLevel);
        if (!newMob) return;

        const targetX = targetItem.container.x;
        const targetY = targetItem.container.y;
        targetItem.x  = targetX;
        targetItem.y  = targetY;
        targetItem.mobLevel = newLevel;

        // 1. Combo tracking
        const now = Date.now();
        if (now - this.lastMergeTime < 2600) {
            this.mergeCombo++;
        } else {
            this.mergeCombo = 1;
        }
        this.lastMergeTime = now;
        const combo = this.mergeCombo;

        // Merge combo sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playMerge(combo);
        }

        // Combo floating text
        if (combo >= 2) {
            let comboText = `COMBO x${combo}!`;
            let comboColor = '#ffd700';
            if (combo === 2)      { comboText = 'COMBO x2! 🔥'; comboColor = '#ffaa00'; }
            else if (combo === 3) { comboText = 'COMBO x3! ⚡'; comboColor = '#ff5722'; }
            else                  { comboText = `MEGA MERGE x${combo}! 💥🔥`; comboColor = '#ff1744'; }
            spawnFloatingText(this.scene, targetX, targetY - 68, comboText, comboColor, 20);
        }

        if (this.onMergeCombo) {
            this.onMergeCombo(combo);
        }

        // Remove draggedItem from array immediately (prevents double-merge)
        this.mobs = this.mobs.filter(m => m.id !== draggedItem.id);

        // ── PHASE A: Attraction (both mobs move toward midpoint, shrink slightly) ──
        const midX = (draggedItem.container.x + targetX) / 2;
        const midY = (draggedItem.container.y + targetY) / 2;

        this.scene.tweens.killTweensOf(draggedItem.container);
        this.scene.tweens.killTweensOf(targetItem.container);

        const phaseADur = 100;

        this.scene.tweens.add({
            targets: draggedItem.container,
            x: targetX,
            y: targetY,
            scaleX: 0.88,
            scaleY: 0.88,
            duration: phaseADur,
            ease: 'Quad.In',
        });

        this.scene.tweens.add({
            targets: targetItem.container,
            scaleX: 0.88,
            scaleY: 0.88,
            duration: phaseADur,
            ease: 'Quad.In',
            onComplete: () => {
                // ── PHASE B: Impact ──
                draggedItem.container.destroy();

                // Brief flash on target before destroying
                this.scene.tweens.add({
                    targets: targetItem.container,
                    scaleX: 1.18,
                    scaleY: 1.18,
                    duration: 50,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        targetItem.container.destroy();
                        targetItem.container = null;

                        // Shockwave ring + particles
                        this._spawnMergeRing(targetX, targetY, combo);
                        this._spawnMergeParticles(targetX, targetY, combo);

                        // Camera shake scaled by combo (only for combo >= 3 to protect UI readability)
                        if (combo >= 5) {
                            this.scene.cameras.main.shake(120, 0.005);
                        } else if (combo === 4) {
                            this.scene.cameras.main.shake(80, 0.003);
                        } else if (combo === 3) {
                            this.scene.cameras.main.shake(60, 0.002);
                        }
                        // combo 1 and 2: zero camera shake!

                        // ── PHASE C: New mob reveal ──
                        targetItem.mobLevel = newLevel;
                        targetItem.container = this._buildMobContainer(targetItem);

                        // Temporarily hide to let ring lead
                        targetItem.container.setScale(0);
                        targetItem.container.setDepth(25 + Math.floor(targetY));

                        // Short delay then pop in with Back.Out bounce
                        this.scene.time.delayedCall(60, () => {
                            if (!targetItem.container) return;

                            this.scene.tweens.add({
                                targets: targetItem.container,
                                scaleX: 1.22,
                                scaleY: 1.22,
                                duration: 180,
                                ease: 'Back.Out',
                                onComplete: () => {
                                    if (!targetItem.container) return;
                                    this.scene.tweens.add({
                                        targets: targetItem.container,
                                        scaleX: 1.0,
                                        scaleY: 1.0,
                                        duration: 120,
                                        ease: 'Quad.Out',
                                        onComplete: () => {
                                            if (targetItem.container) {
                                                targetItem.container.setScale(1.0);
                                                this._startMobWobble(targetItem);
                                            }
                                            // Completion-driven sequencing: trigger unlock modal only after reveal is 100% complete!
                                            if (this.onMergeSuccess) {
                                                this.onMergeSuccess(newMob, isNewUnlock);
                                            }
                                        }
                                    });
                                }
                            });
                        });
                    }
                });
            }
        });

        // 5. XP reward floating text — slightly after impact
        const xpEarned = this.economy.onMerge(newMob);
        this.scene.time.delayedCall(150, () => {
            this._spawnMergeRewardText(targetX, targetY, xpEarned);
        });

        // 6. New unlock tracking
        const isNewUnlock = !this.shownModals.has(newLevel);
        this.shownModals.add(newLevel);
        this.collection.add(newLevel);

        const currentShopLevel = Math.max(1, Math.max(...this.collection) - CONFIG.BUY_LEVEL_OFFSET);
        this.cleanupUnmergeableOldMobs(currentShopLevel);
    }

    // ============================================================
    // Stage 3: Merge ring / shockwave (tween-driven, no frame timers)
    // ============================================================

    _spawnMergeRing(x, y, combo = 1) {
        const scene = this.scene;
        // Ring color: pale gold / mint depending on combo
        const ringColor = combo >= 5 ? 0xffd700 : (combo >= 3 ? 0x86efac : 0xe2f8e0);
        const endR = combo >= 5 ? 75 : (combo >= 3 ? 65 : 55);

        const ring = scene.add.graphics().setDepth(160);
        ring.lineStyle(2.5, ringColor, 1.0);
        ring.strokeCircle(0, 0, endR);
        ring.x = x;
        ring.y = y;
        ring.setScale(0.25);
        ring.setAlpha(0.88);

        scene.tweens.add({
            targets: ring,
            scaleX: 1.0,
            scaleY: 1.0,
            alpha: 0,
            duration: 340,
            ease: 'Quad.Out',
            onComplete: () => ring.destroy()
        });

        // x5 combo: double ring
        if (combo >= 5) {
            const ring2 = scene.add.graphics().setDepth(159);
            ring2.lineStyle(1.8, 0xffd700, 1.0);
            ring2.strokeCircle(0, 0, endR * 1.25);
            ring2.x = x;
            ring2.y = y;
            ring2.setScale(0.18);
            ring2.setAlpha(0.7);

            scene.tweens.add({
                targets: ring2,
                scaleX: 1.0,
                scaleY: 1.0,
                alpha: 0,
                duration: 440,
                delay: 40,
                ease: 'Quad.Out',
                onComplete: () => ring2.destroy()
            });
        }
    }

    // ============================================================
    // Stage 3: Merge particles — stars + sparkles + diamonds
    // ============================================================

    _spawnMergeParticles(x, y, combo = 1) {
        const scene = this.scene;
        // Base count 10, scale with combo
        const baseCount = 10;
        const count = Math.min(baseCount + (combo - 1) * 2, 20);

        // Casual palette: yellow, mint, cyan, white
        const colors = [0xffd700, 0x86efac, 0x67e8f9, 0xffffff, 0xfbbf24, 0xa7f3d0];
        const shapes = ['star', 'diamond', 'circle', 'circle', 'star'];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = 40 + Math.random() * 55;
            const size = 2.5 + Math.random() * 3.5;
            const col = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const lifetime = 380 + Math.random() * 280;

            const g = scene.add.graphics().setDepth(165);
            g.fillStyle(col, 1.0);

            if (shape === 'circle') {
                g.fillCircle(0, 0, size);
            } else if (shape === 'diamond') {
                g.fillTriangle(0, -size, size * 0.6, 0, 0, size);
                g.fillTriangle(0, -size, -size * 0.6, 0, 0, size);
            } else {
                // Simple star: 5 points
                for (let p = 0; p < 5; p++) {
                    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
                    const a2 = a + Math.PI / 5;
                    g.fillTriangle(
                        Math.cos(a) * size, Math.sin(a) * size,
                        Math.cos(a2) * (size * 0.4), Math.sin(a2) * (size * 0.4),
                        Math.cos(a + Math.PI * 2 / 5) * size, Math.sin(a + Math.PI * 2 / 5) * size
                    );
                }
            }

            g.x = x;
            g.y = y;

            // Some rise upward, some spread outward
            const riseBonus = Math.random() > 0.4 ? -Math.random() * 25 : 0;

            scene.tweens.add({
                targets: g,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist + riseBonus,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: lifetime,
                ease: 'Cubic.Out',
                onComplete: () => g.destroy(),
            });
        }

        // x5 combo: extra gold star burst
        if (combo >= 5) {
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                const g = scene.add.graphics().setDepth(166);
                const starSize = 6 + Math.random() * 4;
                g.fillStyle(0xffd700, 1.0);
                // Larger star
                for (let p = 0; p < 5; p++) {
                    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
                    const a2 = a + Math.PI / 5;
                    g.fillTriangle(
                        Math.cos(a) * starSize, Math.sin(a) * starSize,
                        Math.cos(a2) * (starSize * 0.4), Math.sin(a2) * (starSize * 0.4),
                        Math.cos(a + Math.PI * 2 / 5) * starSize, Math.sin(a + Math.PI * 2 / 5) * starSize
                    );
                }
                g.x = x;
                g.y = y;
                scene.tweens.add({
                    targets: g,
                    x: x + Math.cos(angle) * 80,
                    y: y + Math.sin(angle) * 80 - 20,
                    alpha: 0,
                    scaleX: 0.1,
                    scaleY: 0.1,
                    duration: 600,
                    ease: 'Cubic.Out',
                    onComplete: () => g.destroy(),
                });
            }
        }
    }

    // ============================================================
    // Stage 3: Merge reward floating text — refined arc + scale
    // ============================================================

    _spawnMergeRewardText(x, y, xpEarned) {
        const scene = this.scene;
        const text = `+${formatNumber(xpEarned)} XP ⭐`;

        const t = createHDText(scene, x, y - 30, text, {
            fontSize: '18px',
            fontStyle: '900',
            color: '#fde68a',
            stroke: '#111625',
            strokeThickness: 3,
            shadow: { blur: 5, color: '#000', fill: true },
        }).setOrigin(0.5, 1).setDepth(170).setScale(0.8).setAlpha(1.0);

        // Scale up to 1.08 then hold, arc upward 38px, fade out at end
        scene.tweens.add({
            targets: t,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 160,
            ease: 'Back.Out',
            onComplete: () => {
                scene.tweens.add({
                    targets: t,
                    y: y - 75,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    alpha: 0,
                    duration: 640,
                    ease: 'Cubic.Out',
                    onComplete: () => t.destroy(),
                });
            }
        });
    }

    /**
     * Удаляет устаревших мобов с поля
     */
    cleanupUnmergeableOldMobs(shopLevel) {
        if (!shopLevel || shopLevel <= 1) return;

        const belowMobs = this.mobs.filter(m => m.mobLevel < shopLevel);
        if (belowMobs.length === 0) return;

        const mobsByLvl = new Map();
        belowMobs.forEach(m => {
            if (!mobsByLvl.has(m.mobLevel)) mobsByLvl.set(m.mobLevel, []);
            mobsByLvl.get(m.mobLevel).push(m);
        });

        const targetUnits = Math.pow(2, shopLevel - 1);
        let totalUnits = 0;
        belowMobs.forEach(m => {
            totalUnits += Math.pow(2, m.mobLevel - 1);
        });

        let toRemove = [];

        if (totalUnits < targetUnits) {
            toRemove = [...belowMobs];
        } else {
            const carryCount = new Map();
            for (let lvl = 1; lvl < shopLevel; lvl++) {
                const list = mobsByLvl.get(lvl) || [];
                const carry = carryCount.get(lvl) || 0;
                const totalAtLvl = list.length + carry;
                const pairs = Math.floor(totalAtLvl / 2);
                const remainder = totalAtLvl % 2;

                if (remainder === 1 && list.length > 0) {
                    toRemove.push(list[list.length - 1]);
                }

                if (pairs > 0) {
                    carryCount.set(lvl + 1, (carryCount.get(lvl + 1) || 0) + pairs);
                }
            }
        }

        if (toRemove.length === 0) return;

        toRemove.forEach((mobItem, i) => {
            this.mobs = this.mobs.filter(m => m.id !== mobItem.id);

            const sellValue = Math.max(1, Math.round(getMobCost(mobItem.mobLevel) * 0.5));
            this.economy.addCoins(sellValue);

            const cx = mobItem.container.x;
            const cy = mobItem.container.y;

            this.scene.time.delayedCall(i * 90, () => {
                spawnFloatingText(this.scene, cx, cy - 35, `💨 +${formatNumber(sellValue)} 💎 (Продан)`, '#ffd700');
                if (typeof SoundManager !== 'undefined') SoundManager.playCoin();

                this.scene.tweens.add({
                    targets: mobItem.container,
                    scaleX: 0,
                    scaleY: 0,
                    alpha: 0,
                    duration: 260,
                    ease: 'Back.In',
                    onComplete: () => {
                        mobItem.container.destroy();
                    }
                });
            });
        });
    }

    // ============================================================
    // Для системы боёв и сериализации
    // ============================================================

    getMobsOnField() {
        return this.mobs.map(m => ({
            id: m.id,
            mob: getMobByLevel(m.mobLevel),
        }));
    }

    _loadFromState(fieldState) {
        if (!Array.isArray(fieldState)) return;
        fieldState.forEach(item => {
            if (item && item.mobLevel && getMobByLevel(item.mobLevel)) {
                this.spawnMob(item.mobLevel, item.x, item.y);
            }
        });
        this._relaxFieldLayout();
    }

    _relaxFieldLayout() {
        if (!this.mobs || this.mobs.length <= 1) return;
        const minSpacing = 84;
        for (let iter = 0; iter < 4; iter++) {
            for (let i = 0; i < this.mobs.length; i++) {
                for (let j = i + 1; j < this.mobs.length; j++) {
                    const m1 = this.mobs[i];
                    const m2 = this.mobs[j];
                    if (!m1 || !m2 || !m1.container || !m2.container) continue;
                    const d = Phaser.Math.Distance.Between(m1.container.x, m1.container.y, m2.container.x, m2.container.y);
                    if (d < minSpacing) {
                        let angle = Phaser.Math.Angle.Between(m1.container.x, m1.container.y, m2.container.x, m2.container.y);
                        if (d < 4) angle = Math.random() * Math.PI * 2;
                        const overlap = (minSpacing - d) / 2;
                        m1.container.x -= Math.cos(angle) * overlap;
                        m1.container.y -= Math.sin(angle) * overlap;
                        m2.container.x += Math.cos(angle) * overlap;
                        m2.container.y += Math.sin(angle) * overlap;

                        m1.container.x = Phaser.Math.Clamp(m1.container.x, this.bounds.minX + 35, this.bounds.maxX - 35);
                        m1.container.y = Phaser.Math.Clamp(m1.container.y, this.bounds.minY + 35, this.bounds.maxY - 35);
                        m2.container.x = Phaser.Math.Clamp(m2.container.x, this.bounds.minX + 35, this.bounds.maxX - 35);
                        m2.container.y = Phaser.Math.Clamp(m2.container.y, this.bounds.minY + 35, this.bounds.maxY - 35);

                        m1.x = m1.container.x;
                        m1.y = m1.container.y;
                        m2.x = m2.container.x;
                        m2.y = m2.container.y;
                        m1.container.setDepth(20 + Math.floor(m1.y));
                        m2.container.setDepth(20 + Math.floor(m2.y));
                    }
                }
            }
        }
    }

    toState() {
        return {
            field: this.mobs.map(m => ({
                id: m.id,
                mobLevel: m.mobLevel,
                x: Math.round(m.container ? m.container.x : m.x),
                y: Math.round(m.container ? m.container.y : m.y),
            })),
            collection: Array.from(this.collection),
            shownModals: Array.from(this.shownModals),
        };
    }
}
