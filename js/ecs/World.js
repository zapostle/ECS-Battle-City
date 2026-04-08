import { SparseSet } from './SparseSet.js';

// =============================================================================
// Natural Order ECS - World（世界容器）
// 作为 ECS 架构的核心中枢，管理所有组件集合和系统
// 负责实体的创建、销毁、组件的增删查、系统的注册与执行
// =============================================================================

export class World {
    constructor() {
        this.componentSets = new Map(); // 组件集合映射: typeName(组件类型名) -> SparseSet(稀疏集合)
        this.systems = [];              // 系统列表: 存储所有已注册的游戏系统函数
        this._nextEntityId = 1;          // 下一个可用的实体ID（自增计数器）
        this._toRemove = [];           // 延迟实体销毁队列（帧末统一清理，避免迭代中修改集合的问题）
        this._monitors = [];            // 实体监控器列表（每帧自动执行对比）
    }

    // 创建新实体，返回唯一的实体ID
    createEntity() {
        return this._nextEntityId++;
    }

    // 获取或创建指定类型的组件集合（内部方法）
    _getComponentSet(typeName) {
        if (!this.componentSets.has(typeName)) {
            this.componentSets.set(typeName, new SparseSet());
        }
        return this.componentSets.get(typeName);
    }

    // 为指定实体添加组件
    addComponent(entityId, typeName, component) {
        const set = this._getComponentSet(typeName);
        set.add(entityId, component);
    }

    // 获取实体上指定类型的组件
    getComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return undefined;
        return set.get(entityId);
    }

    // 移除实体上指定类型的组件
    removeComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (set) set.remove(entityId);
    }

    // 检查实体是否拥有指定类型的组件
    hasComponent(entityId, typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return false;
        return set.contains(entityId);
    }

    // 注册系统函数到世界容器
    addSystem(systemFn, name = '') {
        this.systems.push({ fn: systemFn, name });
    }

    // 执行一帧：按顺序运行所有已注册的系统，然后处理延迟销毁
    tick() {
        for (const sys of this.systems) {
            sys.fn(this);  // 将 world 自身传入每个系统
        }
        // 执行所有实体监控器（在系统执行后、销毁处理前）
        for (const monitor of this._monitors) {
            if (monitor.enabled) {
                monitor.tick(this);
            }
        }
        // 处理延迟实体销毁（在所有系统执行完毕后统一清理）
        this._processRemovals();
    }

    // 注册一个 EntityMonitor 监控器到世界容器
    registerMonitor(monitor) {
        this._monitors.push(monitor);
    }

    // 移除指定的监控器
    unregisterMonitor(monitor) {
        const idx = this._monitors.indexOf(monitor);
        if (idx >= 0) this._monitors.splice(idx, 1);
    }

    // 延迟销毁实体（加入待移除队列，安全地在迭代期间调用）
    destroyEntity(entityId) {
        this._toRemove.push(entityId);
    }

    // 内部方法：处理所有待移除的实体（从所有组件集合中清除）
    _processRemovals() {
        const unique = [...new Set(this._toRemove)];  // 去重
        this._toRemove = [];
        for (const id of unique) {
            for (const [, set] of this.componentSets) {
                set.remove(id);  // 从每个组件集合中移除此实体
            }
        }
    }

    // ==================== 多组件交集查询 ====================
    // 用于查找同时拥有多个组件的实体（ECS 核心查询能力）

    // 查询拥有指定单一组件的所有实体（返回迭代器）
    *getEntitiesWith(typeName) {
        const set = this.componentSets.get(typeName);
        if (!set) return;
        yield* set.ids();
    }

    // 查找拥有指定组件的第一个实体（用于舞台/玩家等单例实体的动态ID获取）
    findEntity(typeName) {
        for (const id of this.getEntitiesWith(typeName)) {
            return id;
        }
        return null;
    }

    // 查询同时拥有两种组件的实体（优化：遍历较小的集合）
    *getEntitiesWithAll(typeA, typeB) {
        const setA = this.componentSets.get(typeA);
        const setB = this.componentSets.get(typeB);
        if (!setA || !setB) return;

        // 性能优化：始终遍历元素较少的集合，减少迭代次数
        let small, large;
        if (setA.getCount() <= setB.getCount()) {
            small = setA; large = setB;
        } else {
            small = setB; large = setA;
        }
        for (const id of small.ids()) {
            if (large.contains(id)) yield id;  // 同时存在于两个集合中的实体
        }
    }

    // 查询同时拥有三种组件的实体
    *getEntitiesWithAll3(typeA, typeB, typeC) {
        const sets = [this.componentSets.get(typeA), this.componentSets.get(typeB), this.componentSets.get(typeC)];
        if (sets.some(s => !s)) return;
        sets.sort((a, b) => a.getCount() - b.getCount());  // 按大小排序优化
        for (const id of sets[0].ids()) {
            if (sets[1].contains(id) && sets[2].contains(id)) yield id;
        }
    }

    // 查询同时拥有四种组件的实体
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
