// =============================================================================
// 伤害系统 - 处理 DamageInfo 事件组件
// Natural Order 核心模式的最佳体现：
//   - 触发条件: HP组件 和 DamageInfo组件 同时存在于同一实体上
//   - 处理流程: Add( CollisionSystem添加 ) → Process( 本系统处理 ) → Remove( 移除 )
//   - DamageInfo 只存在一帧，天然保证伤害只处理一次
//
// 解耦设计（不再硬编码"玩家"、"敌人"）：
//   - 击杀奖励 → 检查 KillReward 组件，给攻击者的 Score 加分
//   - 复活逻辑 → 检查 Lives 组件，有剩余生命则添加 Respawn 组件
//   - 场上计数 → 通过 SpawnTimer.activeCount 维护，本系统递减
//   - 游戏结束 → 当带 Lives 的实体生命耗尽，设置 env.state = 'gameover'
// =============================================================================

import { COMP } from '../Constants.js';
import { createRespawn } from '../Components.js';

export function DamageSystem(world, env) {
    if (!env || env.state !== 'playing') return;

    const EXPLOSION_LARGE_FRAMES = env.config.animation.EXPLOSION_LARGE_FRAMES;
    const HIT_FLASH_FRAMES = env.config.animation.HIT_FLASH_FRAMES;
    const RESPAWN_DELAY = env.config.combat.RESPAWN_DELAY;

    for (const entityId of world.getEntitiesWithAll(COMP.HP, COMP.DAMAGE_INFO)) {
        const hp = world.getComponent(entityId, COMP.HP);
        const dmgInfo = world.getComponent(entityId, COMP.DAMAGE_INFO);

        if (!hp || !dmgInfo) continue;

        // ---- 扣除生命值 ----
        hp.hp -= dmgInfo.damage;

        // ---- 触发受击闪烁效果 ----
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render) render.flash = HIT_FLASH_FRAMES;

        // ---- 死亡判定 ----
        if (hp.hp <= 0) {
            // 创建爆炸效果实体
            const pos = world.getComponent(entityId, COMP.POSITION);
            if (pos) {
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: pos.x, y: pos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 2, timer: 0, maxTimer: EXPLOSION_LARGE_FRAMES });
                world.addComponent(expId, COMP.RENDER, { type: 'explosion', color: '#FF4500', zIndex: 2, flash: 0 });
            }

            // ★ 击杀奖励：如果实体有 KillReward 组件，将奖励加到攻击者的 Score 上
            const killReward = world.getComponent(entityId, COMP.KILL_REWARD);
            if (killReward && killReward.score > 0 && dmgInfo.attackerId) {
                const attackerScore = world.getComponent(dmgInfo.attackerId, COMP.SCORE);
                if (attackerScore) {
                    attackerScore.value += killReward.score;
                }
            }

            // ★ 递减 SpawnTimer 的 activeCount（AI 实体死亡时释放生成配额）
            if (world.hasComponent(entityId, COMP.AI_CTRL)) {
                for (const spawnerId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
                    const st = world.getComponent(spawnerId, COMP.SPAWN_TIMER);
                    if (st.activeCount > 0) st.activeCount--;
                }
            }

            // ★ 复活逻辑：检查 Lives 组件
            const lives = world.getComponent(entityId, COMP.LIVES);
            if (lives && lives.lives > 0) {
                lives.lives--;
                if (lives.lives > 0) {
                    // 还有剩余生命 → 添加 Respawn 组件，由 RespawnSystem 处理复活
                    world.addComponent(entityId, COMP.RESPAWN, createRespawn(RESPAWN_DELAY));
                    // 保存分数到 env（跨复活保留）
                    const scoreComp = world.getComponent(entityId, COMP.SCORE);
                    if (scoreComp) env.playerScore = scoreComp.value;
                } else {
                    // 生命耗尽 → 游戏结束（带 Lives 的实体通常是玩家）
                    const scoreComp = world.getComponent(entityId, COMP.SCORE);
                    if (scoreComp) env.playerScore = scoreComp.value;
                    env.state = 'gameover';
                }
            }

            // 添加销毁标记（CleanupSystem 或 RespawnSystem 会处理）
            world.addComponent(entityId, COMP.DESTROYED, {});
        }

        // ★ 消费 DamageInfo 事件组件（Rule 2: 事件组件消费后移除）
        world.removeComponent(entityId, COMP.DAMAGE_INFO);
    }
}
