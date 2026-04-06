// Natural Order ECS Framework - JavaScript
// SparseSet: O(1) entity-component mapping with swap-and-pop deletion

export class SparseSet {
    constructor(initialCapacity = 16) {
        this.sparse = new Map();    // entityId -> denseIndex
        this.dense = [];            // denseIndex -> component
        this.reverseMap = new Map(); // denseIndex -> entityId
        this.count = 0;
        this.capacity = initialCapacity;
    }

    add(entityId, component) {
        if (this.sparse.has(entityId)) return;
        if (this.count >= this.capacity) {
            this.capacity *= 2;
        }
        this.dense[this.count] = component;
        this.sparse.set(entityId, this.count);
        this.reverseMap.set(this.count, entityId);
        this.count++;
    }

    contains(entityId) {
        return this.sparse.has(entityId);
    }

    get(entityId) {
        const idx = this.sparse.get(entityId);
        if (idx === undefined) return undefined;
        return this.dense[idx];
    }

    remove(entityId) {
        const idx = this.sparse.get(entityId);
        if (idx === undefined) return;

        this.count--;
        if (idx !== this.count) {
            this.dense[idx] = this.dense[this.count];
            const lastId = this.reverseMap.get(this.count);
            this.sparse.set(lastId, idx);
            this.reverseMap.set(idx, lastId);
        }
        this.dense[this.count] = undefined;
        this.reverseMap.delete(this.count);
        this.sparse.delete(entityId);
    }

    *ids() {
        for (let i = 0; i < this.count; i++) {
            yield this.reverseMap.get(i);
        }
    }

    getCount() {
        return this.count;
    }
}
