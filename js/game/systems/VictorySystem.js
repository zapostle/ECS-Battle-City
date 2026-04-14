// =============================================================================
// 胜利条件系统 - 检测关卡胜利条件是否达成
// Natural Order ECS 理念：系统只查询组件数据做判断，不硬编码游戏实体
//
// 规则35: !SpawnTimer存在 + !AI存活 → 胜利
// 规则36: 胜利 → GameState.state='victory'
//
// ★ 重构：移除 env.state 兼容写入，只写 GameState 组件
// =============================================================================

import { COMP } from '../Constants.js';

export function VictorySystem(world, env) {
    // ★ 通过 GameState 组件判断游戏状态
    const gameStateId = world.findEntity(COMP.GAME_STATE);
    const gameState = gameStateId ? world.getComponent(gameStateId, COMP.GAME_STATE) : null;
    if (gameState && gameState.state !== 'playing') return;

    // 条件1：检查是否还有活跃的 SpawnTimer（仍有实体需要生成）
    let hasActiveSpawner = false;
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
        hasActiveSpawner = true;
        break;
    }

    if (hasActiveSpawner) return;

    // 条件2：检查场上是否还有 AI 控制的存活实体
    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;
        if (world.getComponent(entityId, COMP.HP)) return;
    }

    // 规则36: 所有条件满足 → 写入 GameState 组件
    if (gameState) gameState.state = 'victory';
}
