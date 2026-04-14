// =============================================================================
// WorldView - World 的只读视图接口
// UI 层通过 WorldView 查询 ECS 数据，无法修改任何组件或实体
// 设计原则：单向数据流 — System 写组件 → World 存储 → WorldView 只读 → UI 渲染
//
// ★ "动态变量=组件"原则：
//   所有动态数据都在组件中，WorldView 提供便捷查询方法
//   UI 不再依赖 env 的任何动态字段
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

    // ==================== 环境只读访问（仅 config/providers）====================

    /** 获取 Environment 引用（只有 config/providers，无动态游戏数据） */
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

    // ==================== 单例组件便捷查询 ====================

    /** 查询游戏状态（从 GameState 单例组件读取） */
    getGameState() {
        const stateId = this._world.findEntity('GameState');
        if (stateId) {
            return this._world.getComponent(stateId, 'GameState')?.state ?? 'playing';
        }
        return 'playing';
    }

    /** 查询关卡号（从 GameState 单例组件读取，替代 env.level） */
    getLevel() {
        const stateId = this._world.findEntity('GameState');
        if (stateId) {
            return this._world.getComponent(stateId, 'GameState')?.level ?? 1;
        }
        return 1;
    }

    /** 查询地图数据（从 GameMap 单例组件读取，替代 env.mapData） */
    getMapData() {
        const mapId = this._world.findEntity('GameMap');
        if (mapId) {
            return this._world.getComponent(mapId, 'GameMap')?.data ?? null;
        }
        return null;
    }

    /** 查询帧计数（从 GameState 单例组件读取，替代 env.frameCount） */
    getFrameCount() {
        const stateId = this._world.findEntity('GameState');
        if (stateId) {
            return this._world.getComponent(stateId, 'GameState')?.frameCount ?? 0;
        }
        return 0;
    }
}
