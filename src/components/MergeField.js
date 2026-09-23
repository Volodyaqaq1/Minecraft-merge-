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

        // Коллекция открытых мобов
        this.collection = new Set(state.collection || [1]);

        // Список всех активных мобов на поле: [{ id, mobLevel, container, x, y }]
        this.mobs = [];
        this._nextId = 1;

        // Коллбеки наружу (для GameScene)
        this.onMobClick     = null; // fn(mobData) -> кликер
        this.onMergeSuccess = null; // fn(newMob) -> обновить магазин

        // Загрузить мобов из сохранения
        this._loadFromState(state.field || []);
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
        this.mobs.push(mobItem);

        // Добавляем в коллекцию
        this.collection.add(mob.level);

        // Анимация появления
        mobItem.container.setScale(0);
        this.scene.tweens.add({
            targets: mobItem.container,
            scaleX: 1,
            scaleY: 1,
            duration: 220,
            ease: 'Back.Out',
        });

        return mobItem;
    }

    _buildMobContainer(mobItem) {
        const { scene, mobSize } = this;
        const mob = getMobByLevel(mobItem.mobLevel);

        const container = scene.add.container(mobItem.x, mobItem.y);
        container.setDepth(20);

        // 1. Белая мягкая подсветка / контур как в оригинале сквиши
        const glow = scene.add.graphics();
        glow.fillStyle(0xffffff, 0.4);
        glow.fillCircle(0, 0, mobSize / 2 + 5);
        container.add(glow);

        // 2. Круглая основа карточки
        const bg = scene.add.graphics();
        drawRoundRect(bg, -mobSize / 2, -mobSize / 2, mobSize, mobSize, mobSize / 2, mob.rarityColor, 0.5, 0xffffff, 2);
        container.add(bg);

        // 3. Эмодзи / спрайт моба
        const mobImg = scene.add.text(0, -6, mob.emoji, {
            fontSize: `${mobSize * 0.48}px`,
        }).setOrigin(0.5);
        container.add(mobImg);

        // 4. Имя моба снизу
        const nameText = scene.add.text(0, mobSize / 2 - 14, mob.name, {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: mobSize + 10 }
        }).setOrigin(0.5, 0);
        container.add(nameText);

        // 5. Бейдж уровня слева сверху
        const lvlBadge = scene.add.graphics();
        drawRoundRect(lvlBadge, -mobSize / 2 + 2, -mobSize / 2 + 2, 22, 16, 5, 0x000000, 0.75);
        container.add(lvlBadge);

        const lvlText = scene.add.text(-mobSize / 2 + 13, -mobSize / 2 + 3, `${mobItem.mobLevel}`, {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#ffd700',
            fontStyle: 'bold',
        }).setOrigin(0.5, 0);
        container.add(lvlText);

        // 6. Интерактивность: Drag & Click
        container.setInteractive(
            new Phaser.Geom.Circle(0, 0, mobSize / 2 + 4),
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
                duration: 100,
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
            scene.tweens.add({
                targets: container,
                scaleX: 1,
                scaleY: 1,
                duration: 100,
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
        // Анимация сквоша (сплющивание как в оригинале сквишей)
        this.scene.tweens.add({
            targets: container,
            scaleX: 1.25,
            scaleY: 0.8,
            duration: 80,
            yoyo: true,
            ease: 'Quad.Out',
        });

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
            // Слияния нет: удерживаем моба в границах поля
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

        // 1. Анимация: перетаскиваемый моб притягивается к цели и исчезает
        this.scene.tweens.add({
            targets: draggedItem.container,
            x: targetX,
            y: targetY,
            scaleX: 0,
            scaleY: 0,
            duration: 180,
            onComplete: () => {
                draggedItem.container.destroy();
            }
        });

        // Удаляем draggedItem из массива
        this.mobs = this.mobs.filter(m => m.id !== draggedItem.id);

        // 2. Обновляем уровень целевого моба
        targetItem.mobLevel = newLevel;

        // Пересоздаём визуализацию целевого моба
        targetItem.container.destroy();
        targetItem.container = this._buildMobContainer(targetItem);

        // Всплеск / взрыв при слиянии
        targetItem.container.setScale(0.3);
        this.scene.tweens.add({
            targets: targetItem.container,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 150,
            yoyo: true,
            ease: 'Back.Out',
        });

        // 3. Экономика и награда за мёрдж
        const earned = this.economy.onMerge(newMob);
        spawnFloatingText(this.scene, targetX, targetY - 45, `+${formatNumber(earned)} 💎`, '#5dff6e');

        // 4. Добавляем в коллекцию
        this.collection.add(newLevel);

        // Оповещаем о слиянии (обновить магазин)
        if (this.onMergeSuccess) {
            this.onMergeSuccess(newMob);
        }
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
            collection: [...this.collection],
        };
    }
}
