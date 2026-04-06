// =============================================================================
// 移动系统 - 应用速度/方向到位置
// Natural Order: 消费 InputSystem/AISystem 产生的方向数据，更新 Position 组件
// 设计策略: 先移动，后由 CollisionSystem 回滚碰撞 — 符合 FC 坦克大战的物理手感
// =============================================================================

import { COMP, DIR, DIR_VEC, PLAYER_SPEED, ENEMY_SPEED } from '../Constants.js';

export function MovementSystem(world) {
    // 遍历所有坦克类型实体（包括玩家和敌人）
    for (const entityId of world.getEntitiesWith(COMP.TANK_TYPE)) {
        const pos = world.getComponent(entityId, COMP.POSITION);      // 位置
        const dir = world.getComponent(entityId, COMP.DIRECTION);    // 方向
        const col = world.getComponent(entityId, COMP.COLLISION);    // 碰撞体
        const tankType = world.getComponent(entityId, COMP.TANK_TYPE);// 坦克类型

        if (!pos || !dir || !col) continue;

        // ---- 判断该坦克是否应该移动 ----
        let shouldMove = false;
        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);  // 检查是否有玩家输入
        const aiCtrl = world.getComponent(entityId, COMP.AI_CTRL);      // 检查是否是AI敌人

        if (input && input.dir >= 0) {
            shouldMove = true;
            dir.dir = input.dir;  // 使用玩家输入的方向
        } else if (aiCtrl) {
            shouldMove = true;
            dir.dir = aiCtrl.moveDir;  // 使用AI决策的方向
        }

        if (!shouldMove) continue;

        // 根据坦克类型选择速度
        const speed = tankType.type === 'player' ? PLAYER_SPEED : ENEMY_SPEED;
        const vec = DIR_VEC[dir.dir];  // 获取方向向量 [dx, dy]
        const dx = vec[0];
        const dy = vec[1];

        // 保存当前位置（供 CollisionSystem 碰撞回滚使用）
        const prevX = pos.x;
        const prevY = pos.y;

        // ---- FC风格网格对齐: 转向时逐渐对齐到瓦片网格中心 ----
        // 这模拟了经典坦克大战中坦克"卡"在网格上的手感
        if (dx !== 0) {
            // 水平移动时，Y轴逐渐对齐到最近的瓦片行中心
            const tileY = Math.round((pos.y - 8) / 16);
            const targetY = tileY * 16 + 8;
            const diff = targetY - pos.y;
            if (Math.abs(diff) > 0.5) {
                pos.y += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);  // 缓慢吸附
            }
        }
        if (dy !== 0) {
            // 垂直移动时，X轴逐渐对齐到最近的瓦片列中心
            const tileX = Math.round((pos.x - 8) / 16);
            const targetX = tileX * 16 + 8;
            const diff = targetX - pos.x;
            if (Math.abs(diff) > 0.5) {
                pos.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);  // 缓慢吸附
            }
        }

        // ---- 应用位移 ----
        pos.x += dx * speed;
        pos.y += dy * speed;

        // ---- 边界限制：防止移出地图范围 ----
        pos.x = Math.max(col.halfW, Math.min(26 * 16 - col.halfW, pos.x));
        pos.y = Math.max(col.halfH, Math.min(26 * 16 - col.halfW, pos.y));
    }
}
