// =============================================================================
// AI 系统 - 敌人坦克人工智能行为控制
// Natural Order: 在 InputSystem 之后运行，产生敌人移动方向数据
// 职责: 控制所有敌人的决策逻辑（巡逻、追踪、射击）
// =============================================================================

import { COMP } from '../Constants.js';

export function AISystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
    if (!env || env.state !== 'playing') return;

    // ★ 所有配置通过 env.config 访问 (Rule 6)
    const { THINK_MIN, THINK_MAX, CHASE_CHANCE } = env.config.ai;
    const DIR = env.config.dir;

    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        // 跳过已标记销毁的实体
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;

        const ai = world.getComponent(entityId, COMP.AI_CTRL);
        const dirComp = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!pos || !dirComp) continue;

        // --- AI 思考计时器递减 ---
        ai.thinkTimer--;

        if (ai.thinkTimer <= 0) {
            // 使用环境中的随机数生成器（可替换/可测试）
            ai.thinkTimer = THINK_MIN + Math.floor(env.random() * (THINK_MAX - THINK_MIN));
            ai.moveDir = Math.floor(env.random() * 4);

            // --- 追踪行为 ---
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

        dirComp.dir = ai.moveDir;

        // --- 随机射击决策 ---
        if (env.random() < ai.shootChance) {
            const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
            if (shootCd && shootCd.cooldown <= 0) {
                shootCd.cooldown = shootCd.maxCooldown;
                world.addComponent(entityId, COMP.SHOOT_REQUEST, {});
            }
        }
    }
}
