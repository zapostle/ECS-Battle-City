// =============================================================================
// 移动系统 - 应用速度/方向到位置
// Natural Order: 消费 InputSystem/AISystem 产生的方向数据，更新 Position 组件
// 设计策略:
//   Direction = 纯朝向（渲染用，默认向上）
//   是否移动 = 由 InputSystem.dir / AI_CTRL.moveDir 显式驱动
//   无输入时 shouldMove=false → 坦克不动，即使 Direction 仍为"向上"
// =============================================================================

import { COMP } from '../Constants.js';

export function MovementSystem(world, _env) {  // ★ 规范签名: (world, env)
    const env = world.env;
    // ★ DIR_VEC 通过 env.config 访问 (Rule 6)
    const DIR_VEC = env.config.dirVec;
    const TILE = env.config.map.TILE;
    const MAP_W = env.config.map.MAP_W;
    const MAP_H = env.config.map.MAP_H;
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

        if (!shouldMove) continue;

        // ---- 执行位移（从环境配置表读取速度）----
        const cfgSpeed = isPlayer ? env.config.speed.PLAYER : env.config.speed.ENEMY;
        const vec = DIR_VEC[moveDir];
        const dx = vec[0];
        const dy = vec[1];

        // 保存当前位置到组件（供 CollisionSystem 碰撞回滚使用）
        pos.prevX = pos.x;
        pos.prevY = pos.y;

        // ---- FC风格网格对齐: 转向时逐渐对齐到瓦片网格中心 ----
        const halfTile = TILE / 2;
        if (dx !== 0) {
            const tileY = Math.round((pos.y - halfTile) / TILE);
            const targetY = tileY * TILE + halfTile;
            const diff = targetY - pos.y;
            if (Math.abs(diff) > 0.5) {
                pos.y += Math.sign(diff) * Math.min(Math.abs(diff), cfgSpeed * 0.8);
            }
        }
        if (dy !== 0) {
            const tileX = Math.round((pos.x - halfTile) / TILE);
            const targetX = tileX * TILE + halfTile;
            const diff = targetX - pos.x;
            if (Math.abs(diff) > 0.5) {
                pos.x += Math.sign(diff) * Math.min(Math.abs(diff), cfgSpeed * 0.8);
            }
        }

        pos.x += dx * cfgSpeed;
        pos.y += dy * cfgSpeed;

        // 边界限制（从环境配置读取地图尺寸）
        const gameW = MAP_W * TILE;
        const gameH = MAP_H * TILE;
        pos.x = Math.max(col.halfW, Math.min(gameW - col.halfW, pos.x));
        pos.y = Math.max(col.halfH, Math.min(gameH - col.halfH, pos.y));
    }
}
