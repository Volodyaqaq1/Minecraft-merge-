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

        // Анимация плавного появления
        if (!this._isLoading && typeof SoundManager !== 'undefined') {
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
                if (mobItem.container) mobItem.container.setScale(1.0);
            }
        });

        return mobItem;
    }

    _buildMobContainer(mobItem) {
        const { scene, mobSize } = this;
        const mob = getMobByLevel(mobItem.mobLevel);

        const container = scene.add.container(mobItem.x, mobItem.y);
        container.setDepth(20);
        container.setScale(1.0);

        // 1. Белая мягкая подсветка / контур как в оригинале сквиши
        const glow = scene.add.graphics();
        glow.fillStyle(0xffffff, 0.45);
        glow.fillCircle(0, 0, mobSize / 2 + 5);
        container.add(glow);

        // 2. Круглая основа карточки
        const bg = scene.add.graphics();
        drawRoundRect(bg, -mobSize / 2, -mobSize / 2, mobSize, mobSize, mobSize / 2, mob.rarityColor, 0.55, 0xffffff, 2.5);
        container.add(bg);

        // 3. Эмодзи / спрайт моба (крупный и сочный)
        const mobImg = scene.add.text(0, -8, mob.emoji, {
            fontSize: `${Math.round(mobSize * 0.52)}px`,
        }).setOrigin(0.5);
        container.add(mobImg);

        // 4. Имя моба снизу (крупное и читаемое)
        const nameText = scene.add.text(0, mobSize / 2 - 16, mob.name, {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold',
            wordWrap: { width: mobSize + 14 }
        }).setOrigin(0.5, 0);
        container.add(nameText);

        // 5. Бейдж уровня слева сверху (увеличенный)
        const lvlBadge = scene.add.graphics();
        drawRoundRect(lvlBadge, -mobSize / 2 + 2, -mobSize / 2 + 2, 28, 20, 6, 0x000000, 0.85);
        container.add(lvlBadge);

        const lvlText = scene.add.text(-mobSize / 2 + 16, -mobSize / 2 + 4, `${mobItem.mobLevel}`, {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#ffd700',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        container.add(lvlText);

        // 6. Интерактивность: Drag & Click
        container.setInteractive(
            new Phaser.Geom.Circle(0, 0, mobSize / 2 + 6),
            Phaser.Geom.Circle.Contains
        );
        scene.input.setDraggable(container);

        let startPointerPos = { x: 0, y: 0 };
        let hasMoved = false;

        container.on('pointerdown', (ptr) => {
            startPointerPos = { x: ptr.x, y: ptr.y };
            hasMoved = false;
        });

        container.on('dragstart', () => {
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
            if (Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, ptr.x, ptr.y) > 10) {
                hasMoved = true;
            }
        });

        container.on('dragend', (ptr) => {
            container.setDepth(20);

            // Всегда плавно сбрасываем масштаб ровно в 1.0
            scene.tweens.add({
                targets: container,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 90,
                onComplete: () => {
                    if (container) container.setScale(1.0);
                }
            });

            // Проверка: это был просто клик/тап или полноценное перетаскивание?
            const moveDist = Phaser.Math.Distance.Between(startPointerPos.x, startPointerPos.y, ptr.x, ptr.y);
            if (!hasMoved && moveDist < 12) {
                // КЛИКЕР — Нажатие на объект
                this._handleMobClick(mobItem, container);
                return;
            }

            // ПЕРЕТАСКИВАНИЕ — Проверяем слияние с другими мобами
            this._handleMobDrop(mobItem);
        });

        return container;
    }

    // ============================================================
    // Кликер по мобу
    // ============================================================

    _handleMobClick(mobItem, container) {
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playClink();
        }

        // Анимация сквоша (сплющивание как в оригинале сквишей)
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.25,
            scaleY: 0.8,
            duration: 80,
            yoyo: true,
            ease: 'Quad.Out',
            onComplete: () => {
                if (container) container.setScale(1.0);
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

            this.scene.tweens.add({
                targets: draggedItem.container,
                x: clampedX,
                y: clampedY,
                duration: 120,
            });

            draggedItem.x = clampedX;
            draggedItem.y = clampedY;
        }
    }

    _executeMerge(draggedItem, targetItem) {
        const newLevel = targetItem.mobLevel + 1;
        const newMob   = getMobByLevel(newLevel);
        if (!newMob) return;

        const targetX = targetItem.container.x;
        const targetY = targetItem.container.y;

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

        // 2. Визуальные сочные эффекты (вспышка кольца + частицы + тряска)
        const ring = this.scene.add.graphics();
        ring.lineStyle(3.5, newMob.rarityColor || 0xffd700, 0.95);
        ring.strokeCircle(targetX, targetY, 24);
        ring.setDepth(150);
        this.scene.tweens.add({
            targets: ring,
            scaleX: 3.2,
            scaleY: 3.2,
            alpha: 0,
            duration: 320,
            ease: 'Quad.Out',
            onComplete: () => ring.destroy()
        });

        // Разлетающиеся частицы искр
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
            const dist = randInt(40, 85);
            const spark = this.scene.add.text(targetX, targetY, Math.random() > 0.5 ? '✨' : '⭐', {
                fontSize: `${randInt(14, 20)}px`
            }).setOrigin(0.5).setDepth(160);

            this.scene.tweens.add({
                targets: spark,
                x: targetX + Math.cos(angle) * dist,
                y: targetY + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 420,
                ease: 'Cubic.Out',
                onComplete: () => spark.destroy()
            });
        }

        // Экранный shake на редком слиянии (редкость >= 2 или комбо >= 3)
        if (newMob.rarity >= 2 || newMob.level >= 10 || this.mergeCombo >= 3) {
            this.scene.cameras.main.shake(160, 0.007);
        }

        // 3. Анимация: перетаскиваемый моб притягивается к цели и исчезает
        this.scene.tweens.add({
            targets: draggedItem.container,
            x: targetX,
            y: targetY,
            scaleX: 0,
            scaleY: 0,
            duration: 160,
            onComplete: () => {
                draggedItem.container.destroy();
            }
        });

        // Удаляем draggedItem из массива
        this.mobs = this.mobs.filter(m => m.id !== draggedItem.id);

        // 4. Обновляем уровень целевого моба
        targetItem.mobLevel = newLevel;

        // Пересоздаём визуализацию целевого моба
        targetItem.container.destroy();
        targetItem.container = this._buildMobContainer(targetItem);

        // Фикс масштаба: устанавливаем масштаб 1.0, пульсируем до 1.28 и возвращаем ровно в 1.0!
        targetItem.container.setScale(1.0);
        this.scene.tweens.add({
            targets: targetItem.container,
            scaleX: 1.28,
            scaleY: 1.28,
            duration: 140,
            yoyo: true,
            ease: 'Back.Out',
            onComplete: () => {
                if (targetItem.container) {
                    targetItem.container.setScale(1.0);
                }
            }
        });

        // 5. Награда за слияние: ТОЛЬКО ОПЫТ (без монет)
        const xpEarned = this.economy.onMerge(newMob);
        spawnFloatingText(this.scene, targetX, targetY - 45, `+${xpEarned} XP ⭐`, '#ffd700');

        // 6. Добавляем в коллекцию (проверяем, открыт ли моб впервые)
        const maxPrevUnlocked = this.collection.size > 0 ? Math.max(...this.collection) : 1;
        const isNewUnlock = (newLevel > maxPrevUnlocked) || !this.shownModals.has(newLevel);
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
