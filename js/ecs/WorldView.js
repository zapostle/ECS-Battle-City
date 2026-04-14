// =============================================================================
// WorldView - World 的只读视图接口
// UI 层通过 WorldView 查询 ECS 数据，无法修改任何组件或实体
// 设计原则：单向数据流 — System 写组件 → World 存储 → WorldView 只读 → UI 渲染
// =============================================================================

export class WorldView {
    /**
     * @param {import('./World.js').World} world - 被观察的 World 实例
     */
    constructor(world) {
        this._world = world;
    }

    // ==================== 只读查询（与 World 完全一致的查询 API）====================

    /** 获取实体上指定类型的组件（只读引用，UI 层不应修改） */
    getComponent(entityId, typeName) {
        return this._world.getComponent(entityId, typeName);
    }

    /** 检查实体是否拥有指定类型的组件 */
    hasComponent(entityId, typeName) {
        return this._world.hasComponent(entityId, typeName);
    }

    /** 查询拥有指定单一组件的所有实体（返回迭代器） */
    getEntitiesWith(typeName) {
        return this._world.getEntitiesWith(typeName);
    }

    /** 查询同时拥有两种组件的实体 */
    getEntitiesWithAll(typeA, typeB) {
        return this._world.getEntitiesWithAll(typeA, typeB);
    }

    /** 查询同时拥有三种组件的实体 */
    getEntitiesWithAll3(typeA, typeB, typeC) {
        return this._world.getEntitiesWithAll3(typeA, typeB, typeC);
    }

    /** 查找拥有指定组件的第一个实体（用于单例查询） */
    findEntity(typeName) {
        return this._world.findEntity(typeName);
    }

    // ==================== 环境只读访问 ====================

    /** 获取 Environment 引用（配置、服务等只读数据） */
    get env() {
        return this._world.env;
    }

    // ==================== 统计查询（UI 常用，World 原生不提供）====================

    /** 统计拥有某组件类型的实体数量 */
    countEntitiesWith(typeName) {
        let count = 0;
        for (const _ of this._world.getEntitiesWith(typeName)) count++;
        return count;
    }

    /** 统计拥有某组件类型且未销毁的实体数量 */
    countAliveEntitiesWith(typeName) {
        let count = 0;
        for (const id of this._world.getEntitiesWith(typeName)) {
            if (!this._world.hasComponent(id, 'Destroyed')) count++;
        }
        return count;
    }

    /** 查询游戏状态（从 GameState 单例实体读取） */
    getGameState() {
        const stateId = this._world.findEntity('GameState');
        if (stateId) {
            return this._world.getComponent(stateId, 'GameState')?.state ?? 'playing';
        }
        return 'playing';
    }
}
