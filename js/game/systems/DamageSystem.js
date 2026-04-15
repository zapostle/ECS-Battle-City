// =============================================================================
// 伤害系统 - 处理 DamageInfo 事件组件
// Natural Order 核心模式的最佳体现：
//   - 触发条件: HP组件 和 DamageInfo组件 同时存在于同一实体上
//   - 处理流程: Add( CollisionSystem添加 ) → Process( 本系统处理 ) → Remove( 移除 )
//   - DamageInfo 只存在一帧，天然保证伤害只处理一次
//
// ★ "事件即实体"重构：
//   - 受击闪烁：创建 PendingAction{setField:'flash'} 事件实体
//   - 爆炸自毁：创建 PendingAction{addComp:'Destroyed'} 事件实体
//   - 出生保护到期移除：创建 PendingAction{removeComp:'SpawnProtect'} 事件实体
// =============================================================================

import { COMP } from '../Constants.js';
import { createRespawn, createPendingAction } from '../Components.js';

export function DamageSystem(world, env) {
    // ★ 通过 GameState 组件判断游戏状态
    const gameStateId = world.findEntity(COMP.GAME_STATE);
    const gameState = gameStateId ? world.getComponent(gameStateId, COMP.GAME_STATE) : null;
    if (gameState && gameState.state !== 'playing') return;

    const EXPLOSION_LARGE_FRAMES = env.config.animation.EXPLOSION_LARGE_FRAMES;
    const HIT_FLASH_FRAMES = env.config.animation.HIT_FLASH_FRAMES;
    const RESPAWN_DELAY = env.config.combat.RESPAWN_DELAY;

    for (const entityId of world.getEntitiesWithAll(COMP.HP, COMP.DAMAGE_INFO)) {
        const hp = world.getComponent(entityId, COMP.HP);
        const dmgInfo = world.getComponent(entityId, COMP.DAMAGE_INFO);

        if (!hp || !dmgInfo) continue;

        // ---- 规则19: 扣除生命值 ----
        hp.hp -= dmgInfo.damage;

        // ---- 规则20: 触发受击闪烁效果 ----
        // ★ 闪烁由 PendingAction 事件实体驱动
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render) {
            render.flash = HIT_FLASH_FRAMES;  // 设初始值
            // ★ 创建事件实体："HIT_FLASH_FRAMES帧后将 flash 设为0"
            const flashActionId = world.createEntity();
            world.addComponent(flashActionId, COMP.PENDING_ACTION, createPendingAction({
                targetId: entityId,
                action: 'setField',
                componentType: COMP.RENDER,
                field: 'flash',
                value: 0,
                frames: HIT_FLASH_FRAMES,
            }));
        }

        // ---- 死亡判定 ----
        if (hp.hp <= 0) {
            // 规则21: 创建爆炸效果实体 + ★ PendingAction 驱动自毁
            const pos = world.getComponent(entityId, COMP.POSITION);
            if (pos) {
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: pos.x, y: pos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 2, timer: 0, maxTimer: EXPLOSION_LARGE_FRAMES });
                world.addComponent(expId, COMP.RENDER, { type: 'explosion', color: '#FF4500', zIndex: 2, flash: 0 });

                // ★ 创建事件实体："爆炸动画结束后添加 Destroyed 标记"
                const expActionId = world.createEntity();
                world.addComponent(expActionId, COMP.PENDING_ACTION, createPendingAction({
                    targetId: expId,
                    action: 'addComp',
                    componentType: COMP.DESTROYED,
                    value: {},
                    frames: EXPLOSION_LARGE_FRAMES,
                }));
            }

            // 规则22: 击杀奖励
            const killReward = world.getComponent(entityId, COMP.KILL_REWARD);
            if (killReward && killReward.score > 0 && dmgInfo.attackerId) {
                const attackerScore = world.getComponent(dmgInfo.attackerId, COMP.SCORE);
                if (attackerScore) {
                    attackerScore.value += killReward.score;
                }
            }

            // 规则23: AI死亡 → 递减 SpawnTimer.activeCount
            if (world.hasComponent(entityId, COMP.AI_CTRL)) {
                for (const spawnerId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
                    const st = world.getComponent(spawnerId, COMP.SPAWN_TIMER);
                    if (st.activeCount > 0) st.activeCount--;
                }
            }

            // 规则24+25: 复活逻辑
            const lives = world.getComponent(entityId, COMP.LIVES);
            if (lives && lives.lives > 0) {
                lives.lives--;
                if (lives.lives > 0) {
                    // 还有剩余生命 → 添加 Respawn 组件
                    world.addComponent(entityId, COMP.RESPAWN, createRespawn(RESPAWN_DELAY));
                } else {
                    // 规则25: 生命耗尽 → 写入 GameState 组件
                    if (gameState) gameState.state = 'gameover';
                }
            }

            // 添加销毁标记
            world.addComponent(entityId, COMP.DESTROYED, {});
        }

        // 规则26: 消费 DamageInfo 事件组件（Rule 2: 事件组件消费后移除）
        world.removeComponent(entityId, COMP.DAMAGE_INFO);
    }
}
