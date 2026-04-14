// =============================================================================
// 胜利条件系统 - 检测关卡胜利条件是否达成
// Natural Order ECS 理念：系统只查询组件数据做判断，不硬编码游戏实体
//
// 胜利条件：
//   1. 所有 SpawnTimer 已消耗完毕（不再有新生成 + 已生成数达到上限）
//   2. 场上没有存活的 AI 控制实体
//
// 解耦设计：
//   - 通过 SpawnTimer 组件判断"是否还有实体要来"
//   - 通过 AI_CTRL + !Destroyed 组件判断"场上是否还有存活敌人"
//   - 不知道"敌人"是什么，只知道"带 AI_CTRL 的实体还有没有存活"
// =============================================================================

import { COMP } from '../Constants.js';

export function VictorySystem(world, env) {
    // ★ 通过 GameState 组件判断游戏状态（替代 env.state）
    const gameStateId = world.findEntity(COMP.GAME_STATE);
    const gameState = gameStateId ? world.getComponent(gameStateId, COMP.GAME_STATE) : null;
    if (gameState && gameState.state !== 'playing') return;
    // 兼容过渡期
    if (!gameState && env.state !== 'playing') return;

    // 条件1：检查是否还有活跃的 SpawnTimer（仍有实体需要生成）
    let hasActiveSpawner = false;
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
        hasActiveSpawner = true;  // SpawnTimer 存在就意味着还有生成计划
        break;
    }

    if (hasActiveSpawner) return;

    // 条件2：检查场上是否还有 AI 控制的存活实体
    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        // 跳过已标记销毁的实体
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;
        // 有 HP 存活则未胜利
        if (world.getComponent(entityId, COMP.HP)) return;
    }

    // 所有条件满足 → 写入 GameState 单例组件（替代 env.state = 'victory'）
    if (gameState) gameState.state = 'victory';
    // 同步写入 env.state（兼容过渡期，后续可移除）
    env.state = 'victory';
}
