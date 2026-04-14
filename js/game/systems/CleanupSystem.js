// =============================================================================
// 清理系统 - 消费 Destroyed 事件组件，决定实体的最终命运
// Natural Order ECS 核心理念：系统不知道"玩家"、"敌人"的区别
//
// 职责：
//   - 遍历所有带 Destroyed 的实体
//   - 如果实体同时拥有 Respawn 组件 → 不销毁（交由 RespawnSystem 处理）
//   - 否则 → 消费 Destroyed 组件 + 延迟销毁实体
//
// 解耦设计：
//   - 不硬编码 playerEntityId 判断
//   - 通过 Respawn 组件的存在与否决定实体的命运
//   - 任何带 Respawn 的实体（不仅是玩家）都能享受"死后复活"的机制
// =============================================================================

import { COMP } from '../Constants.js';

export function CleanupSystem(world, _env) {
    const toRemove = [];

    for (const entityId of world.getEntitiesWith(COMP.DESTROYED)) {
        // 如果实体拥有 Respawn 组件，说明它需要复活，跳过销毁
        // RespawnSystem 会在复活完成后移除 Respawn + Destroyed 组件
        if (world.hasComponent(entityId, COMP.RESPAWN)) {
            continue;
        }
        toRemove.push(entityId);
    }

    for (const id of toRemove) {
        // ★ 不再维护 env.enemyCount — UI 层通过 WorldView.countAliveEntitiesWith(COMP.AI_CTRL) 实时统计

        world.removeComponent(id, COMP.DESTROYED);  // ★ 消费事件组件（Rule 2: 事件组件消费后移除）
        world.destroyEntity(id);                     // 延迟销毁实体
    }
}
