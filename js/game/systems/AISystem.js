// =============================================================================
// AI 系统 - 敌人坦克人工智能行为控制
// Natural Order: 在 InputSystem 之后运行，产生敌人移动方向数据
// 职责: 控制所有敌人的决策逻辑（巡逻、追踪、射击）
//
// ★ "事件即实体"重构：
//   - 射击时创建 PendingAction 事件实体驱动冷却归零
//   - 不再直接写 shootCd.cooldown（冷却由事件实体管理）
// =============================================================================

import { COMP } from '../Constants.js';
import { createPendingAction } from '../Components.js';

export function AISystem(world, env) {
    // ★ 通过 GameState 组件判断游戏状态
    const gameStateId = world.findEntity(COMP.GAME_STATE);
    const gameState = gameStateId ? world.getComponent(gameStateId, COMP.GAME_STATE) : null;
    if (gameState && gameState.state !== 'playing') return;

    const { THINK_MIN, THINK_MAX, CHASE_CHANCE } = env.config.ai;
    const DIR = env.config.dir;

    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;

        const ai = world.getComponent(entityId, COMP.AI_CTRL);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!pos) continue;

        // --- 规则3: AI 思考计时器递减 ---
        ai.thinkTimer--;

        // --- 规则4: thinkTimer≤0 → 重新决策 ---
        if (ai.thinkTimer <= 0) {
            ai.thinkTimer = THINK_MIN + Math.floor(env.random() * (THINK_MAX - THINK_MIN));
            ai.moveDir = Math.floor(env.random() * 4);

            // --- 规则5: 追踪玩家 ---
            const playerId = world.findEntity(COMP.PLAYER_INPUT);
            if (playerId && env.random() < CHASE_CHANCE) {
                const playerPos = world.getComponent(playerId, COMP.POSITION);
                if (playerPos) {
                    const dx = playerPos.x - pos.x;
                    const dy = playerPos.y - pos.y;
                    if (Math.abs(dx) > Math.abs(dy)) {
                        ai.moveDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
                    } else {
                        ai.moveDir = dy > 0 ? DIR.DOWN : DIR.UP;
                    }
                }
            }
        }

        // --- 规则6: 随机射击决策 ---
        if (env.random() < ai.shootChance) {
            const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
            if (shootCd && shootCd.cooldown <= 0) {
                shootCd.cooldown = shootCd.maxCooldown;
                world.addComponent(entityId, COMP.SHOOT_REQUEST, {});

                // ★ 创建事件实体："冷却时间后 cooldown 归零"
                const cdActionId = world.createEntity();
                world.addComponent(cdActionId, COMP.PENDING_ACTION, createPendingAction({
                    targetId: entityId,
                    action: 'setField',
                    componentType: COMP.SHOOT_COOLDOWN,
                    field: 'cooldown',
                    value: 0,
                    frames: shootCd.maxCooldown,
                }));
            }
        }
    }
}
