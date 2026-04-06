import { SparseSet } from './SparseSet.js';

// Natural Order ECS - World: Central container for all components and systems
export class World {
    constructor() {
        this.componentSets = new Map(); // typeName -> SparseSet
        this.systems = [];
        this._nextEntityId = 1;
        this._toRemove = []; // deferred entity removal queue
    }

    createEntity() {
        return this._nextEntityId++;
    }

    _getComponentSet(typeName) {
        if (!this.componentSets.has(typeName)) {
            this.componentSets.set(typeName, new SparseSet());
        }
        return this.componentSets.get(typeName);
    }

    addComponent(entityId, typeName, component) {
        const set = this._getComponentSet(typeName);
        set.add(entityId, component);
    }

    getComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return undefined;
        return set.get(entityId);
    }

    removeComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (set) set.remove(entityId);
    }

    hasComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return false;
        return set.contains(entityId);
    }

    addSystem(systemFn, name = '') {
        this.systems.push({ fn: systemFn, name });
    }

    tick() {
        for (const sys of this.systems) {
            sys.fn(this);
        }
        // Process deferred entity removals
        this._processRemovals();
    }

    // Deferred entity removal (safe during iteration)
    destroyEntity(entityId) {
        this._toRemove.push(entityId);
    }

    _processRemovals() {
        const unique = [...new Set(this._toRemove)];
        this._toRemove = [];
        for (const id of unique) {
            for (const [, set] of this.componentSets) {
                set.remove(id);
            }
        }
    }

    // ==================== Multi-component intersection queries ====================

    *getEntitiesWith(typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return;
        yield* set.ids();
    }

    *getEntitiesWithAll(typeA, typeB) {
        const setA = this.componentSets.get(typeA);
        const setB = this.componentSets.get(typeB);
        if (!setA || !setB) return;

        // Iterate the smaller set for efficiency
        let small, large;
        if (setA.getCount() <= setB.getCount()) {
            small = setA; large = setB;
        } else {
            small = setB; large = setA;
        }
        for (const id of small.ids()) {
            if (large.contains(id)) yield id;
        }
    }

    *getEntitiesWithAll3(typeA, typeB, typeC) {
        const sets = [this.componentSets.get(typeA), this.componentSets.get(typeB), this.componentSets.get(typeC)];
        if (sets.some(s => !s)) return;
        sets.sort((a, b) => a.getCount() - b.getCount());
        for (const id of sets[0].ids()) {
            if (sets[1].contains(id) && sets[2].contains(id)) yield id;
        }
    }

    *getEntitiesWithAll4(typeA, typeB, typeC, typeD) {
        const sets = [
            this.componentSets.get(typeA), this.componentSets.get(typeB),
            this.componentSets.get(typeC), this.componentSets.get(typeD)
        ];
        if (sets.some(s => !s)) return;
        sets.sort((a, b) => a.getCount() - b.getCount());
        for (const id of sets[0].ids()) {
            if (sets[1].contains(id) && sets[2].contains(id) && sets[3].contains(id)) yield id;
        }
    }
}
