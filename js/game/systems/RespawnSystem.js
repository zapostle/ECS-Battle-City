// =============================================================================
// 复活系统 - 管理带 Respawn 组件的实体的复活逻辑
// Natural Order ECS 理念：系统不知道"玩家"，只处理"带 Respawn 组件的实体"
//
// 职责：
//   - 遍历所有带 Respawn 组件的实体
//   - 递减 Respawn.frames 计时器
//   - 计时归零 → 清除旧组件 + 根据 Lives.respawnTemplate 重建组件
//   - 移除 Respawn + Destroyed 组件（消费事件）
//
// 解耦设计：
//   - 复活模板通过 Lives.respawnTemplate 闭包注入（由 Game.js 创建实体时设置）
//   - 任何实体都能拥有 Respawn 组件，不限于玩家
//   - 与 CleanupSystem 协作：CleanupSystem 看到带 Respawn 的实体不销毁，留给本系统处理
// =============================================================================

import { COMP } from '../Constants.js';

export function RespawnSystem(world, env) {
    for (const entityId of world.getEntitiesWith(COMP.RESPAWN)) {
        const respawn = world.getComponent(entityId, COMP.RESPAWN);

        // 递减复活计时器
        respawn.frames--;

        if (respawn.frames > 0) continue;  // 还在等待中

        // ====== 计时归零，执行复活 ======

        // 1. 消费 Destroyed 事件组件（Rule 2: 事件组件消费后移除）
        if (world.hasComponent(entityId, COMP.DESTROYED)) {
            world.removeComponent(entityId, COMP.DESTROYED);
        }

        // 2. 保存需要跨复活保留的组件数据
        const savedLives = world.getComponent(entityId, COMP.LIVES);
        const savedScore = world.getComponent(entityId, COMP.SCORE);
        const livesData = savedLives ? { ...savedLives } : null;
        const scoreValue = savedScore ? savedScore.value : 0;

        // 3. 清除旧组件（重建干净状态）
        // ★ 不调用 destroyEntity——它会在帧末 _processRemovals 中清除所有组件，导致刚添加的新组件也被删掉
        for (const [typeName, set] of world.componentSets) {
            if (set.contains(entityId)) set.remove(entityId);
        }

        // 4. 根据 Lives.respawnTemplate 重建组件
        // ★ 模板函数由实体创建者注入（如 Game._initPlayerComponents），本系统不关心具体内容
        if (livesData && typeof livesData.respawnTemplate === 'function') {
            livesData.respawnTemplate(world, env, entityId);
        }

        // 5. 恢复跨复活保留的组件数据
        // ★ Lives 组件被 _initPlayerComponents 重建后，需要覆盖为正确的剩余生命数
        if (livesData) {
            const newLives = world.getComponent(entityId, COMP.LIVES);
            if (newLives) {
                newLives.lives = livesData.lives;
                newLives.respawnTemplate = livesData.respawnTemplate;
            }
        }
        // ★ Score 组件被重建后，恢复之前的分数
        const newScore = world.getComponent(entityId, COMP.SCORE);
        if (newScore) {
            newScore.value = scoreValue;
        }

        // 6. 移除 Respawn 组件（复活完成）
        world.removeComponent(entityId, COMP.RESPAWN);
    }
}
