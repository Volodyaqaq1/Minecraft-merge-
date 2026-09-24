// ============================================================
// components/MergeField.js — свободное поле без сетки и логика слияния
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

        // Если координаты не переданы, выбираем случайную позицию на полянке
        const x = targetX !== undefined ? targetX : randInt(this.bounds.minX + 40, this.bounds.maxX - 40);
        const y = targetY !== undefined ? targetY : randInt(this.bounds.minY + 40, this.bounds.maxY - 40);

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

        // Анимация появления только для динамически заспавненных мобов,
        // мобы из сохранения сразу отображаются в нормальном масштабе 1.0
        if (this._isLoading) {
            mobItem.container.setScale(1.0);
            this._startMobWobble(mobItem);
        } else {
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playPop();
            }
            mobItem.container.setScale(0);
            this.scene.tweens.add({
                targets: mobItem.container,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 220,
                ease: 'Back.Out',
                onComplete: () => {
                    if (mobItem.container) {
                        mobItem.container.setScale(1.0);
                        this._startMobWobble(mobItem);
                    }
                }
            });
        }

        return mobItem;
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
        container.setDepth(20);
        container.setScale(1.0);

        // 1. Мягкая тень под ногами персонажа (на полянке)
        const shadow = scene.add.graphics();
        shadow.fillStyle(0x0a2808, 0.28);
        shadow.fillEllipse(0, mobSize / 2 - 8, mobSize * 0.74, 16);
        shadow.fillStyle(0x0a2808, 0.14);
        shadow.fillEllipse(0, mobSize / 2 - 8, mobSize * 0.88, 22);
        container.add(shadow);

        // 2. Аура для повышенных визуальных тиров (Золотой / Алмазный)
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

        // 3. SPRITE: Полный персонаж (squishy character) с прозрачным альфа-фоном
        const spriteTex = (mob.spriteKey && scene.textures.exists(mob.spriteKey))
            ? mob.spriteKey
            : (scene.textures.exists(mob.texture) ? mob.texture : 'mob_sprite_placeholder');
        const mobImg = scene.add.image(0, -6, spriteTex).setDisplaySize(mobSize * 0.95, mobSize * 0.95);
        container.add(mobImg);

        // 4. Имя моба снизу в компактном бейдже
        const nameBadge = scene.add.graphics();
        const badgeW = Math.min(mobSize + 16, 120);
        drawRoundRect(nameBadge, -badgeW / 2, mobSize / 2 - 16, badgeW, 20, 10, 0x0f172a, 0.85, mob.tierColor || 0xffffff, 1.2);
        container.add(nameBadge);

        const nameText = createHDText(scene, 0, mobSize / 2 - 6, mob.name, {
            fontSize: '11px',
            color: mob.tier === 2 ? '#ffd700' : (mob.tier === 3 ? '#38bdf8' : '#ffffff'),
            fontStyle: '800',
        }).setOrigin(0.5);
        container.add(nameText);

        // 5. Бейдж уровня слева сверху
        const lvlBadge = scene.add.graphics();
        const badgeBorderColor = mob.tier === 2 ? 0xffd700 : (mob.tier === 3 ? 0x00e6ff : 0x475569);
        drawRoundRect(lvlBadge, -mobSize / 2 + 2, -mobSize / 2 - 4, 32, 22, 8, 0x0f172a, 0.92, badgeBorderColor, 1.5);
        container.add(lvlBadge);

        const lvlText = createHDText(scene, -mobSize / 2 + 18, -mobSize / 2 + 7, `${mobItem.mobLevel}`, {
            fontSize: '12px',
            color: mob.tier === 2 ? '#ffd700' : (mob.tier === 3 ? '#38bdf8' : '#ffffff'),
            fontStyle: '900',
        }).setOrigin(0.5);
        container.add(lvlText);

        // 8. Интерактивность: Drag & Click
        container.setInteractive(
            new Phaser.Geom.Circle(0, -6, mobSize / 2 + 8),
            Phaser.Geom.Circle.Contains
        );
        scene.input.setDraggable(container);

        let startPointerPos = { x: 0, y: 0 };
        let hasMoved = false;

        container.on('pointerdown', (ptr) => {
            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;
            startPointerPos = { x: wx, y: wy };
            hasMoved = false;
        });

        container.on('dragstart', () => {
            scene.tweens.killTweensOf(container);
            container.setDepth(100);
            scene.tweens.add({
                targets: container,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 90,
            });
        });

        container.on('drag', (ptr, dragX, dragY) => {
            container.x = dragX;
            container.y = dragY;
            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;
            if (Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, wx, wy) > 10) {
                hasMoved = true;
            }
        });

        container.on('dragend', (ptr) => {
            container.setDepth(20);

            // Проверка: это был просто клик/тап или полноценное перетаскивание?
            const wx = ptr.worldX !== undefined ? ptr.worldX : ptr.x;
            const wy = ptr.worldY !== undefined ? ptr.worldY : ptr.y;
            const moveDist = Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, wx, wy);
            if (!hasMoved && moveDist < 12) {
                // КЛИКЕР — Нажатие на объект с упругим сквошем
                this._handleMobClick(mobItem, container);
                return;
            }

            // ПЕРЕТАСКИВАНИЕ — Проверяем слияние с другими мобами
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

        // Анимация упругого сквоша и стретча (быстрое сплющивание и эластичный отскок)
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

        // Начисляем немного опыта за клик
        if (CONFIG.XP_PER_CLICK) {
            this.economy.addXP(CONFIG.XP_PER_CLICK);
        }

        // Оповещаем GameScene для начисления награды и роста комбо
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

        // Ищем ближайшего моба того же уровня в радиусе MERGE_RADIUS
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
        } else {
            // Слияния нет: мягкий звук падения и удерживаем моба в границах поля
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playPop();
            }

            const clampedX = Phaser.Math.Clamp(curX, this.bounds.minX + 30, this.bounds.maxX - 30);
            const clampedY = Phaser.Math.Clamp(curY, this.bounds.minY + 30, this.bounds.maxY - 30);

            draggedItem.x = clampedX;
            draggedItem.y = clampedY;

            this.scene.tweens.killTweensOf(draggedItem.container);
            this.scene.tweens.add({
                targets: draggedItem.container,
                x: clampedX,
                y: clampedY,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 120,
                ease: 'Quad.Out',
                onComplete: () => {
                    this._startMobWobble(draggedItem);
                }
            });
        }
    }

    _executeMerge(draggedItem, targetItem) {
        const newLevel = targetItem.mobLevel + 1;
        const newMob   = getMobByLevel(newLevel);
        if (!newMob) return;

        const targetX = targetItem.container.x;
        const targetY = targetItem.container.y;
        targetItem.x  = targetX;
        targetItem.y  = targetY;

        // 1. Быстрое комбо слияний (в пределах 2.6 сек)
        const now = Date.now();
        if (now - this.lastMergeTime < 2600) {
            this.mergeCombo++;
        } else {
            this.mergeCombo = 1;
        }
        this.lastMergeTime = now;

        // Звук слияния с повышающейся тональностью
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playMerge(this.mergeCombo);
        }

        // Всплывающее комбо над мобом
        if (this.mergeCombo >= 2) {
            let comboText = `COMBO x${this.mergeCombo}!`;
            let comboColor = '#ffd700';
            if (this.mergeCombo === 2) {
                comboText = 'COMBO x2! 🔥';
                comboColor = '#ffaa00';
            } else if (this.mergeCombo === 3) {
                comboText = 'COMBO x3! ⚡';
                comboColor = '#ff5722';
            } else {
                comboText = `MEGA MERGE x${this.mergeCombo}! 💥🔥`;
                comboColor = '#ff1744';
            }
            spawnFloatingText(this.scene, targetX, targetY - 68, comboText, comboColor, 20);
        }

        if (this.onMergeCombo) {
            this.onMergeCombo(this.mergeCombo);
        }

        // 2. Визуальные сочные эффекты (вспышка + веер пастельных конфетти и звездочек)
        const flash = this.scene.add.graphics().setDepth(180);
        flash.fillStyle(0xffffff, 0.95);
        flash.fillCircle(targetX, targetY, 60);
        this.scene.tweens.add({
            targets: flash,
            scaleX: 2.2,
            scaleY: 2.2,
            alpha: 0,
            duration: 260,
            ease: 'Quad.Out',
            onComplete: () => flash.destroy()
        });

        const burstIcons = ['⭐', '✨', '🌸', '💫', '🌟'];
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
            const dist = randInt(45, 110);
            const icon = burstIcons[i % burstIcons.length];
            const p = this.scene.add.text(targetX, targetY, icon, {
                fontSize: `${randInt(14, 22)}px`
            }).setOrigin(0.5).setDepth(170);

            this.scene.tweens.add({
                targets: p,
                x: targetX + Math.cos(angle) * dist,
                y: targetY + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: randInt(380, 560),
                ease: 'Cubic.Out',
                onComplete: () => p.destroy()
            });
        }

        // Экранный shake для сочности
        this.scene.cameras.main.shake(140, 0.006);

        // 3. Анимация: перетаскиваемый моб притягивается к цели и исчезает
        this.scene.tweens.killTweensOf(draggedItem.container);
        this.scene.tweens.add({
            targets: draggedItem.container,
            x: targetX,
            y: targetY,
            scaleX: 0,
            scaleY: 0,
            duration: 140,
            ease: 'Cubic.In',
            onComplete: () => {
                draggedItem.container.destroy();
            }
        });

        // Удаляем draggedItem из массива
        this.mobs = this.mobs.filter(m => m.id !== draggedItem.id);

        // 4. Обновляем уровень целевого моба
        targetItem.mobLevel = newLevel;

        // Пересоздаём визуализацию целевого моба
        this.scene.tweens.killTweensOf(targetItem.container);
        targetItem.container.destroy();
        targetItem.container = this._buildMobContainer(targetItem);

        // Пружинистое сочное появление (Squash-pop)
        targetItem.container.setScale(0.35);
        this.scene.tweens.add({
            targets: targetItem.container,
            scaleX: 1.32,
            scaleY: 1.32,
            duration: 150,
            ease: 'Back.Out',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: targetItem.container,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 130,
                    ease: 'Back.Out',
                    onComplete: () => {
                        if (targetItem.container) {
                            targetItem.container.setScale(1.0);
                            this._startMobWobble(targetItem);
                        }
                    }
                });
            }
        });

        // 5. Награда за слияние: ТОЛЬКО ОПЫТ (без монет)
        const xpEarned = this.economy.onMerge(newMob);
        spawnFloatingText(this.scene, targetX, targetY - 45, `+${xpEarned} XP ⭐`, '#ffd700');

        // 6. Добавляем в коллекцию (проверяем, открыт ли моб впервые)
        const isNewUnlock = !this.shownModals.has(newLevel);
        this.shownModals.add(newLevel);
        this.collection.add(newLevel);

        // Очищаем устаревших мобов ниже уровня магазина, которые больше не смогут объединиться
        const currentShopLevel = Math.max(1, Math.max(...this.collection) - CONFIG.BUY_LEVEL_OFFSET);
        this.cleanupUnmergeableOldMobs(currentShopLevel);

        // Оповещаем о слиянии (обновить магазин, задания и показать окно открытия)
        if (this.onMergeSuccess) {
            this.onMergeSuccess(newMob, isNewUnlock);
        }
    }

    /**
     * Удаляет устаревших мобов, чей уровень ниже уровня магазина (shopLevel),
     * которые математически больше никогда не смогут объединиться
     */
    cleanupUnmergeableOldMobs(shopLevel) {
        if (!shopLevel || shopLevel <= 1) return;

        const belowMobs = this.mobs.filter(m => m.mobLevel < shopLevel);
        if (belowMobs.length === 0) return;

        // Группируем мобов по уровням
        const mobsByLvl = new Map();
        belowMobs.forEach(m => {
            if (!mobsByLvl.has(m.mobLevel)) mobsByLvl.set(m.mobLevel, []);
            mobsByLvl.get(m.mobLevel).push(m);
        });

        // Проверяем суммарную "силу" всех мобов ниже уровня магазина.
        // Чтобы собрать хотя бы одного моба уровня shopLevel, нужно суммарно 2^(shopLevel - 1) единиц.
        const targetUnits = Math.pow(2, shopLevel - 1);
        let totalUnits = 0;
        belowMobs.forEach(m => {
            totalUnits += Math.pow(2, m.mobLevel - 1);
        });

        let toRemove = [];

        if (totalUnits < targetUnits) {
            // Если все мобы ниже shopLevel вместе взятые не могут дойти до shopLevel —
            // ВСЕ они гарантированно тупиковые и никогда не объединятся с магазином!
            toRemove = [...belowMobs];
        } else {
            // Если потенциал есть, проверяем по цепочке снизу вверх:
            // мобы без пары на своём уровне не могут объединиться
            const carryCount = new Map();
            for (let lvl = 1; lvl < shopLevel; lvl++) {
                const list = mobsByLvl.get(lvl) || [];
                const carry = carryCount.get(lvl) || 0;
                const totalAtLvl = list.length + carry;
                const pairs = Math.floor(totalAtLvl / 2);
                const remainder = totalAtLvl % 2;

                if (remainder === 1 && list.length > 0) {
                    // Последний моб без пары — лишний сирота
                    toRemove.push(list[list.length - 1]);
                }

                if (pairs > 0) {
                    carryCount.set(lvl + 1, (carryCount.get(lvl + 1) || 0) + pairs);
                }
            }
        }

        if (toRemove.length === 0) return;

        // Удаляем отобранных мобов с поля с красивой анимацией растворения и начислением компенсации
        toRemove.forEach((mobItem, i) => {
            // Исключаем из массива мобов
            this.mobs = this.mobs.filter(m => m.id !== mobItem.id);

            // Компенсация за продажу устаревшего существа
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
