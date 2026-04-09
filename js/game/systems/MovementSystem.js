// =============================================================================
// 移动系统 - 应用速度/方向到位置
// Natural Order: 消费 InputSystem/AISystem 产生的方向数据，更新 Position 组件
// 设计策略:
//   Direction = 纯朝向（渲染用，默认向上）
//   是否移动 = 由 InputSystem.dir / AI_CTRL.moveDir 显式驱动
//   无输入时 shouldMove=false → 坦克不动，即使 Direction 仍为"向上"
// =============================================================================

import { COMP, DIR_VEC, PLAYER_SPEED, ENEMY_SPEED } from '../Constants.js';

export function MovementSystem(world) {
    const dirNames = { [0]: '上↑', [1]: '右→', [2]: '下↓', [3]: '左←' };

    for (const entityId of world.getEntitiesWith(COMP.TANK_TYPE)) {
        const pos = world.getComponent(entityId, COMP.POSITION);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const col = world.getComponent(entityId, COMP.COLLISION);
        const tankType = world.getComponent(entityId, COMP.TANK_TYPE);

        if (!pos || !dir || !col) continue;

        // 跳过已标记销毁的实体
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;

        // ---- 判断移动意图：只看输入/AI，不看 Direction 默认值 ----
        let shouldMove = false;
        let moveDir;  // 本帧实际移动方向（可能不同于渲染朝向）

        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const aiCtrl = world.getComponent(entityId, COMP.AI_CTRL);

        const isPlayer = tankType && tankType.type === 'player';
        const tag = isPlayer ? '🟡玩家' : `👾敌人#${entityId}`;

        if (input && input.dir >= 0) {
            // 玩家有按键输入 → 移动 + 更新朝向
            shouldMove = true;
            moveDir = input.dir;
            if (dir.dir !== moveDir) {
                console.log(`[MovementSystem] ${tag} 朝向变化: ${dirNames[dir.dir]} → ${dirNames[moveDir]} | (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
            }
            dir.dir = moveDir;  // 同步朝向到移动方向
        } else if (aiCtrl) {
            // AI 有决策 → 移动 + 更新朝向
            shouldMove = true;
            moveDir = aiCtrl.moveDir;
            if (dir.dir !== moveDir) {
                console.log(`[MovementSystem] ${tag} 朝向变化(AI): ${dirNames[dir.dir]} → ${dirNames[moveDir]} | 思考倒计时: ${aiCtrl.thinkTimer}帧`);
            }
            dir.dir = moveDir;
        }
        // else: 无输入、无AI → shouldMove 保持 false → 不移动
        //       此时 Direction 保持原值（如默认向上），仅影响渲染

        if (!shouldMove) continue;

        // ---- 执行位移 ----
        const speed = tankType.type === 'player' ? PLAYER_SPEED : ENEMY_SPEED;
        const vec = DIR_VEC[moveDir];
        const dx = vec[0];
        const dy = vec[1];

        // 保存当前位置到组件（供 CollisionSystem 碰撞回滚使用）
        // 必须存到 pos 对象上，不能存局部变量——否则 CollisionSystem 读不到旧值
        pos.prevX = pos.x;
        pos.prevY = pos.y;

        // ---- FC风格网格对齐: 转向时逐渐对齐到瓦片网格中心 ----
        if (dx !== 0) {
            const tileY = Math.round((pos.y - 8) / 16);
            const targetY = tileY * 16 + 8;
            const diff = targetY - pos.y;
            if (Math.abs(diff) > 0.5) {
                pos.y += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);
            }
        }
        if (dy !== 0) {
            const tileX = Math.round((pos.x - 8) / 16);
            const targetX = tileX * 16 + 8;
            const diff = targetX - pos.x;
            if (Math.abs(diff) > 0.5) {
                pos.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);
            }
        }

        pos.x += dx * speed;
        pos.y += dy * speed;

        // 边界限制
        pos.x = Math.max(col.halfW, Math.min(26 * 16 - col.halfW, pos.x));
        pos.y = Math.max(col.halfH, Math.min(26 * 16 - col.halfW, pos.y));
    }
}
