// =============================================================================
// AI 系统 - 敌人坦克人工智能行为控制
// Natural Order: 在 InputSystem 之后运行，产生敌人移动方向数据
// 职责: 控制所有敌人的决策逻辑（巡逻、追踪、射击）
// =============================================================================

import { COMP, DIR, DIR_VEC, ENEMY_SPEED } from '../Constants.js';
import { TILE_BRICK, TILE_STEEL, TILE_WATER, TILE_EMPTY, TILE_ICE } from '../Constants.js';

export function AISystem(world) {
    // 读取关卡状态，非 playing 状态时不处理
    const stageId = world.findEntity(COMP.STAGE);
    const stageComp = stageId ? world.getComponent(stageId, COMP.STAGE) : null;
    if (!stageComp || stageComp.state !== 'playing') return;

    // 遍历所有拥有 AI 控制器的实体（即所有敌人坦克）
    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        const ai = world.getComponent(entityId, COMP.AI_CTRL);       // AI参数
        const dirComp = world.getComponent(entityId, COMP.DIRECTION); // 方向组件
        const pos = world.getComponent(entityId, COMP.POSITION);      // 位置组件

        if (!pos || !dirComp) continue;

        // --- AI 思考计时器递减 ---
        ai.thinkTimer--;

        // 思考计时器归零时，重新做出AI决策
        if (ai.thinkTimer <= 0) {
            // 设定下次思考间隔（60-180帧随机，约1-3秒@60FPS）
            ai.thinkTimer = 60 + Math.floor(Math.random() * 120);
            // 随机选择一个方向（0-3）
            ai.moveDir = Math.floor(Math.random() * 4);

            // --- 追踪行为：30%概率朝向玩家方向移动 ---
            const playerId = world.findEntity(COMP.PLAYER_INPUT);
            if (playerId && Math.random() < 0.3) {
                const playerPos = world.getComponent(playerId, COMP.POSITION);
                if (playerPos) {
                    // 计算到玩家的方向向量
                    const dx = playerPos.x - pos.x;
                    const dy = playerPos.y - pos.y;
                    // 选择偏差更大的轴作为移动方向
                    if (Math.abs(dx) > Math.abs(dy)) {
                        ai.moveDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;  // X轴偏差大 → 左右移动
                    } else {
                        ai.moveDir = dy > 0 ? DIR.DOWN : DIR.UP;     // Y轴偏差大 → 上下移动
                    }
                }
            }
        }

        // 将AI决策的方向应用到实体的 Direction 组件
        dirComp.dir = ai.moveDir;

        // --- 随机射击决策 ---
        // 每帧有 shootChance (默认2%) 的概率尝试射击
        if (Math.random() < ai.shootChance) {
            const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
            // 仅在射击冷却结束时才实际发射
            if (shootCd && shootCd.cooldown <= 0) {
                shootCd.cooldown = shootCd.maxCooldown;           // 重置冷却
                world.addComponent(entityId, COMP.SHOOT_REQUEST, {}); // 添加射击请求（ShootSystem消费）
            }
        }
    }
}

export { COMP as COMP_AI };
