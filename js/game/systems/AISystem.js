// =============================================================================
// AI 系统 - 敌人坦克人工智能行为控制
// Natural Order: 在 InputSystem 之后运行，产生敌人移动方向数据
// 职责: 控制所有敌人的决策逻辑（巡逻、追踪、射击）
//
// ★ 规则精化：
//   规则3: AI_CTRL.thinkTimer-- (每帧递减)
//   规则4: thinkTimer≤0 → AI_CTRL.moveDir=随机方向
//   规则5: random()<CHASE_CHANCE → 追踪玩家方向
//   规则6: random()<shootChance → ShootRequest
//   ★ 不再写 dirComp.dir — 规则7"将moveDir同步到Direction"归 MovementSystem
// =============================================================================

import { COMP } from '../Constants.js';

export function AISystem(world, env) {
    // ★ 通过 GameState 组件判断游戏状态（替代 env.state）
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

        // ★ 不再写 dirComp.dir — 规则7归 MovementSystem 处理

        // --- 规则6: 随机射击决策 ---
        if (env.random() < ai.shootChance) {
            const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
            if (shootCd && shootCd.cooldown <= 0) {
                shootCd.cooldown = shootCd.maxCooldown;
                world.addComponent(entityId, COMP.SHOOT_REQUEST, {});
            }
        }
    }
}
