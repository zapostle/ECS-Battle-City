// =============================================================================
// Natural Order ECS 框架 - JavaScript 实现
// SparseSet（稀疏集合）: O(1) 时间复杂度的实体-组件映射数据结构
// 采用 swap-and-pop（交换并弹出）策略实现高效删除
// =============================================================================

export class SparseSet {
    constructor(initialCapacity = 16) {
        this.sparse = new Map();    // 稀疏数组: entityId -> denseIndex（实体ID到稠密索引的映射）
        this.dense = [];            // 稠密数组: denseIndex -> component（索引到组件数据的映射）
        this.reverseMap = new Map(); // 反向映射: denseIndex -> entityId（用于交换删除时追踪）
        this.count = 0;             // 当前存储的元素数量
        this.capacity = initialCapacity; // 初始容量
    }

    // 添加实体及其组件数据
    add(entityId, component) {
        // 防止重复添加
        if (this.sparse.has(entityId)) return;
        // 容量不足时自动扩容为原来的2倍
        if (this.count >= this.capacity) {
            this.capacity *= 2;
        }
        // 将组件存入稠密数组末尾
        this.dense[this.count] = component;
        // 建立双向映射关系
        this.sparse.set(entityId, this.count);
        this.reverseMap.set(this.count, entityId);
        this.count++;
    }

    // 检查是否包含指定实体
    contains(entityId) {
        return this.sparse.has(entityId);
    }

    // 获取指定实体的组件数据，O(1) 查询
    get(entityId) {
        const idx = this.sparse.get(entityId);
        if (idx === undefined) return undefined;
        return this.dense[idx];
    }

    // 移除指定实体（使用 swap-and-pop 策略保证 O(1) 删除）
    remove(entityId) {
        const idx = this.sparse.get(entityId);
        if (idx === undefined) return;

        this.count--;
        // 如果被删除的不是最后一个元素，将最后一个元素移到被删除的位置
        if (idx !== this.count) {
            this.dense[idx] = this.dense[this.count];
            const lastId = this.reverseMap.get(this.count);
            this.sparse.set(lastId, idx);       // 更新被移动元素的稀疏索引
            this.reverseMap.set(idx, lastId);    // 更新反向映射
        }
        // 清理末尾位置的引用
        this.dense[this.count] = undefined;
        this.reverseMap.delete(this.count);
        this.sparse.delete(entityId);
    }

    // 生成器：遍历所有已存储的实体ID
    *ids() {
        for (let i = 0; i < this.count; i++) {
            yield this.reverseMap.get(i);
        }
    }

    // 获取当前元素数量
    getCount() {
        return this.count;
    }
}
