// ============================================================
// components/MergeField.js — сетка 5×4 и логика мёрджа
// ============================================================

class MergeField {
    /**
     * @param {Phaser.Scene} scene
     * @param {Economy} economy
     * @param {object} state  — сохранённое состояние { field:[], queue:[], collection:[] }
     */
    constructor(scene, economy, state) {
        this.scene    = scene;
        this.economy  = economy;
        this.cols     = CONFIG.FIELD_COLS;
        this.rows     = CONFIG.FIELD_ROWS;
        this.slotSize = CONFIG.FIELD_SLOT_SIZE;
        this.offX     = CONFIG.FIELD_OFFSET_X;
        this.offY     = CONFIG.FIELD_OFFSET_Y;

        // slots[i] = { mobLevel: number } | null
        this.slots = new Array(this.cols * this.rows).fill(null);

        // Очередь следующих мобов (массив уровней)
        this.queue = state.queue.length >= CONFIG.QUEUE_SIZE
            ? [...state.queue]
            : this._fillQueue(state.queue, state.collection);

        // Коллекция открытых мобов
        this.collection = new Set(state.collection);

        // Спрайты мобов на поле
        this.mobSprites = {};  // slotIndex → Phaser.GameObjects.Container

        // Контейнер слотов (фоны)
        this.slotGraphics = [];

        // Drag state
        this._drag = null;

        this._buildGrid();
        this._loadFromState(state.field);
        this._renderQueue();
    }

    // ============================================================
    // Grid построение
    // ============================================================

    _buildGrid() {
        const { scene, cols, rows, slotSize, offX, offY } = this;

        for (let i = 0; i < cols * rows; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = offX + col * (slotSize + 6);
            const y = offY + row * (slotSize + 6);

            const g = scene.add.graphics();
            drawRoundRect(g, x, y, slotSize, slotSize, 10, CONFIG.COLORS.SLOT_EMPTY, 0.7, 0x3a5a3a, 2);
            this.slotGraphics.push({ g, x, y });
        }
    }

    slotPos(index) {
        const col = index % this.cols;
        const row = Math.floor(index / this.cols);
        const { offX, offY, slotSize } = this;
        return {
            x: offX + col * (slotSize + 6) + slotSize / 2,
            y: offY + row * (slotSize + 6) + slotSize / 2,
        };
    }

    _getSlotAt(worldX, worldY) {
        const { cols, rows, slotSize, offX, offY } = this;
        for (let i = 0; i < cols * rows; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const sx = offX + col * (slotSize + 6);
            const sy = offY + row * (slotSize + 6);
            if (worldX >= sx && worldX <= sx + slotSize &&
                worldY >= sy && worldY <= sy + slotSize) {
                return i;
            }
        }
        return -1;
    }

    // ============================================================
    // Отрисовка моба в слоте
    // ============================================================

    _createMobSprite(slotIndex, mobLevel) {
        const mob = getMobByLevel(mobLevel);
        if (!mob) return;

        const pos = this.slotPos(slotIndex);
        const { scene, slotSize } = this;

        const container = scene.add.container(pos.x, pos.y);
        container.setDepth(10);

        // Фон карточки с цветом редкости
        const bg = scene.add.graphics();
        drawRoundRect(bg, -slotSize / 2 + 4, -slotSize / 2 + 4,
            slotSize - 8, slotSize - 8, 8, mob.rarityColor, 0.35);
        container.add(bg);

        // Спрайт или эмодзи-заглушка
        let mobImg;
        if (scene.textures.exists(mob.key)) {
            mobImg = scene.add.image(0, -6, mob.key)
                .setDisplaySize(slotSize - 20, slotSize - 30);
        } else {
            // Эмодзи как текст-заглушка
            mobImg = scene.add.text(0, -8, mob.emoji, {
                fontSize: `${slotSize * 0.45}px`
            }).setOrigin(0.5);
        }
        container.add(mobImg);

        // Имя
        const nameText = scene.add.text(0, slotSize / 2 - 16, mob.name, {
            fontSize: '9px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: slotSize - 8 }
        }).setOrigin(0.5, 0);
        container.add(nameText);

        // Уровень (бейдж)
        const lvlBg = scene.add.graphics();
        drawRoundRect(lvlBg, -slotSize / 2 + 4, -slotSize / 2 + 4, 22, 16, 4, 0x000000, 0.7);
        container.add(lvlBg);
        const lvlText = scene.add.text(-slotSize / 2 + 15, -slotSize / 2 + 5,
            `${mobLevel}`, {
            fontSize: '9px', fontFamily: 'monospace', color: '#ffff00'
        }).setOrigin(0.5, 0);
        container.add(lvlText);

        // Drag
        container.setInteractive(
            new Phaser.Geom.Rectangle(-slotSize / 2, -slotSize / 2, slotSize, slotSize),
            Phaser.Geom.Rectangle.Contains
        );
        scene.input.setDraggable(container);
        container.on('dragstart', () => {
            this._drag = { slotIndex, mobLevel };
            container.setDepth(50);
        });
        container.on('drag', (ptr, dx, dy) => {
            container.x = dx;
            container.y = dy;
        });
        container.on('dragend', (ptr) => {
            this._onDragEnd(ptr, slotIndex, container);
        });

        if (this.mobSprites[slotIndex]) {
            this.mobSprites[slotIndex].destroy();
        }
        this.mobSprites[slotIndex] = container;
        return container;
    }

    _removeMobSprite(slotIndex) {
        if (this.mobSprites[slotIndex]) {
            this.mobSprites[slotIndex].destroy();
            delete this.mobSprites[slotIndex];
        }
    }

    // ============================================================
    // Drag & Drop
    // ============================================================

    _onDragEnd(ptr, fromSlot, container) {
        const toSlot = this._getSlotAt(ptr.x, ptr.y);
        this._drag = null;
        container.setDepth(10);

        if (toSlot === -1 || toSlot === fromSlot) {
            // Вернуть на место
            const pos = this.slotPos(fromSlot);
            this.scene.tweens.add({ targets: container, x: pos.x, y: pos.y, duration: 150 });
            return;
        }

        const fromMobLevel = this.slots[fromSlot];
        const toMobLevel   = this.slots[toSlot];

        if (toMobLevel === null) {
            // Переместить на пустой слот
            this._moveToSlot(fromSlot, toSlot);
        } else if (fromMobLevel === toMobLevel && fromMobLevel < CONFIG.MOB_LEVELS) {
            // Мёрдж!
            this._doMerge(fromSlot, toSlot, fromMobLevel);
        } else {
            // Поменяться местами
            this._swapSlots(fromSlot, toSlot);
        }
    }

    _moveToSlot(from, to) {
        const level = this.slots[from];
        this.slots[to]   = level;
        this.slots[from] = null;

        const pos = this.slotPos(to);
        const sprite = this.mobSprites[from];
        this.scene.tweens.add({
            targets: sprite,
            x: pos.x, y: pos.y,
            duration: 150,
        });
        this.mobSprites[to] = sprite;
        delete this.mobSprites[from];
    }

    _swapSlots(a, b) {
        [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
        const posA = this.slotPos(a);
        const posB = this.slotPos(b);
        const sA = this.mobSprites[a];
        const sB = this.mobSprites[b];
        this.scene.tweens.add({ targets: sA, x: posB.x, y: posB.y, duration: 150 });
        this.scene.tweens.add({ targets: sB, x: posA.x, y: posA.y, duration: 150 });
        this.mobSprites[a] = sB;
        this.mobSprites[b] = sA;
    }

    _doMerge(fromSlot, toSlot, mobLevel) {
        const newLevel = mobLevel + 1;
        const newMob = getMobByLevel(newLevel);
        if (!newMob) return;

        // Анимация слияния: fromSlot летит к toSlot
        const posTo = this.slotPos(toSlot);
        const spriteFrom = this.mobSprites[fromSlot];
        this.scene.tweens.add({
            targets: spriteFrom,
            x: posTo.x,
            y: posTo.y,
            scaleX: 0,
            scaleY: 0,
            duration: 200,
            onComplete: () => {
                spriteFrom.destroy();
                delete this.mobSprites[fromSlot];

                // Удалить toSlot
                this._removeMobSprite(toSlot);

                // Создать новый моб
                this.slots[fromSlot] = null;
                this.slots[toSlot] = newLevel;
                const newSprite = this._createMobSprite(toSlot, newLevel);

                // Анимация появления
                if (newSprite) {
                    newSprite.setScale(0);
                    this.scene.tweens.add({
                        targets: newSprite,
                        scaleX: 1, scaleY: 1,
                        duration: 250,
                        ease: 'Back.Out',
                    });
                }

                // Экономика
                const earned = this.economy.onMerge(newMob);
                spawnFloatingText(this.scene, posTo.x, posTo.y - 30,
                    `+${formatNumber(earned)} 💎`, '#5dff6e');

                // Открыть в коллекцию
                this.collection.add(newLevel);

                // Выспавнить следующий из очереди
                this._spawnFromQueue();
            }
        });
    }

    // ============================================================
    // Очередь и спавн
    // ============================================================

    _fillQueue(existing, collection) {
        const q = [...existing];
        const maxLevel = Math.max(...collection, 1);
        while (q.length < CONFIG.QUEUE_SIZE) {
            const lvl = Math.max(1, randInt(1, Math.max(1, maxLevel - CONFIG.QUEUE_MAX_LEVEL_OFFSET)));
            q.push(lvl);
        }
        return q;
    }

    _spawnFromQueue() {
        if (this.queue.length === 0) return;
        const emptySlot = this._findEmptySlot();
        if (emptySlot === -1) return; // поле полное

        const nextLevel = this.queue.shift();
        this.slots[emptySlot] = nextLevel;
        this._createMobSprite(emptySlot, nextLevel);

        // Добавить новый в конец очереди
        const maxLevel = Math.max(...this.collection, 1);
        const lvl = Math.max(1, randInt(1, Math.max(1, maxLevel - CONFIG.QUEUE_MAX_LEVEL_OFFSET)));
        this.queue.push(lvl);

        this._renderQueue();
    }

    /**
     * Добавить моба на поле (из магазина)
     */
    addMobToField(mobLevel) {
        const slot = this._findEmptySlot();
        if (slot === -1) return false;
        this.slots[slot] = mobLevel;
        this._createMobSprite(slot, mobLevel);
        this.collection.add(mobLevel);
        return true;
    }

    _findEmptySlot() {
        return this.slots.findIndex(s => s === null);
    }

    _renderQueue() {
        // GameScene слушает это через коллбек
        if (this.onQueueUpdate) this.onQueueUpdate([...this.queue]);
    }

    // ============================================================
    // Для выбора бойцов
    // ============================================================

    getMobsOnField() {
        const result = [];
        this.slots.forEach((level, idx) => {
            if (level !== null) {
                result.push({ slotIndex: idx, mob: getMobByLevel(level) });
            }
        });
        return result;
    }

    // ============================================================
    // Загрузка / сохранение
    // ============================================================

    _loadFromState(fieldState) {
        fieldState.forEach(({ slot, mobLevel }) => {
            if (slot >= 0 && slot < this.slots.length && getMobByLevel(mobLevel)) {
                this.slots[slot] = mobLevel;
                this._createMobSprite(slot, mobLevel);
            }
        });
    }

    toState() {
        const field = [];
        this.slots.forEach((level, idx) => {
            if (level !== null) field.push({ slot: idx, mobLevel: level });
        });
        return {
            field,
            queue:      [...this.queue],
            collection: [...this.collection],
        };
    }
}
