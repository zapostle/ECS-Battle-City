// =============================================================================
// 碰撞系统 - 处理所有碰撞检测逻辑
// Natural Order: 读取当前 Position 状态，产生 DamageInfo 事件和 Destroyed 标记
// 负责四种碰撞:
//   1. 坦克 vs 地图瓦片（回滚位置）
//   2. 坦克 vs 坦克（互相推开）
//   3. 子弹 vs 地图瓦片（摧毁子弹+破坏瓦片）
//   4. 子弹 vs 坦克（产生伤害事件）
// =============================================================================

import { COMP } from '../Constants.js';

// ====== 辅助函数：检测矩形区域是否与地图中的固体瓦片重叠 ======
// ★ 配置通过参数注入 (Rule 6)，不直接导入配置模块
function collidesWithMap(mapData, cx, cy, halfW, halfH, isBullet = false, cfg) {
    const TILE = cfg.map.TILE;
    const MAP_W = cfg.map.MAP_W;
    const MAP_H = cfg.map.MAP_H;
    const { BRICK, STEEL, WATER, BASE, BASE_DEAD } = cfg.tile;

    // 计算矩形的四条边界的瓦片坐标范围
    const left = cx - halfW;
    const right = cx + halfW - 0.01;   // 微小偏移防止边界精度问题
    const top = cy - halfH;
    const bottom = cy + halfH - 0.01;

    const tx1 = Math.floor(left / TILE);
    const tx2 = Math.floor(right / TILE);
    const ty1 = Math.floor(top / TILE);
    const ty2 = Math.floor(bottom / TILE);

    for (let ty = ty1; ty <= ty2; ty++) {
        for (let tx = tx1; tx <= tx2; tx++) {
            if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return true;
            const tile = mapData[ty][tx];
            if (isBullet) {
                if (tile === BRICK || tile === STEEL || tile === WATER || tile === BASE) {
                    return { tx, ty, tile };
                }
            } else {
                if (tile === BRICK || tile === STEEL || tile === WATER || tile === BASE || tile === BASE_DEAD) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ====== 碰撞系统主函数 ======
export function CollisionSystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
    const mapData = env.mapData;
    if (!mapData) return;

    // ★ 所有配置通过 env.config 访问 (Rule 6)
    const { BRICK, BASE, BASE_DEAD } = env.config.tile;
    const EMPTY = env.config.tile.EMPTY;

    // ---- 收集所有带有位置、碰撞体、坦克类型的实体 ----
    const tanks = [];
    for (const entityId of world.getEntitiesWithAll3(COMP.POSITION, COMP.COLLISION, COMP.TANK_TYPE)) {
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;
        const pos = world.getComponent(entityId, COMP.POSITION);
        const col = world.getComponent(entityId, COMP.COLLISION);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        if (!pos || !col || !dir) continue;
        tanks.push({ id: entityId, pos, col, dir, prevX: pos.prevX ?? pos.x, prevY: pos.prevY ?? pos.y });
    }

    // ==================== 1. 坦克 vs 地图碰撞检测 ====================
    for (const tank of tanks) {
        const hit = collidesWithMap(mapData, tank.pos.x, tank.pos.y, tank.col.halfW, tank.col.halfH, false, env.config);
        if (hit) {
            tank.pos.x = tank.prevX;
            tank.pos.y = tank.prevY;
        }
    }

    // ==================== 2. 坦克 vs 坦克碰撞检测 ====================
    for (let i = 0; i < tanks.length; i++) {
        for (let j = i + 1; j < tanks.length; j++) {
            const a = tanks[i], b = tanks[j];
            const dx = Math.abs(a.pos.x - b.pos.x);
            const dy = Math.abs(a.pos.y - b.pos.y);
            const overlapX = (a.col.halfW + b.col.halfW) - dx;
            const overlapY = (a.col.halfH + b.col.halfH) - dy;

            if (overlapX > 0 && overlapY > 0) {
                if (overlapX < overlapY) {
                    const push = overlapX / 2;
                    if (a.pos.x < b.pos.x) { a.pos.x -= push; b.pos.x += push; }
                    else { a.pos.x += push; b.pos.x -= push; }
                } else {
                    const push = overlapY / 2;
                    if (a.pos.y < b.pos.y) { a.pos.y -= push; b.pos.y += push; }
                    else { a.pos.y += push; b.pos.y -= push; }
                }
            }
        }
    }

    // ==================== 3. 子弹 vs 地图 & 子弹 vs 坦克 碰撞检测 ====================
    for (const bulletId of world.getEntitiesWith(COMP.BULLET)) {
        const bPos = world.getComponent(bulletId, COMP.POSITION);
        const bBullet = world.getComponent(bulletId, COMP.BULLET);

        if (!bPos || !bBullet) continue;

        // ---- 3a. 子弹 vs 地图碰撞 ----
        const hit = collidesWithMap(mapData, bPos.x, bPos.y, 3, 3, true, env.config);
        if (hit) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
            const expId = world.createEntity();
            world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
            world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });

            if (hit.tile === BRICK) {
                mapData[hit.ty][hit.tx] = EMPTY;
            } else             if (hit.tile === BASE) {
                mapData[hit.ty][hit.tx] = BASE_DEAD;
                // ★ 写入 GameState 单例组件（替代 env.state = 'gameover'）
                const gameStateId = world.findEntity(COMP.GAME_STATE);
                const gameState = gameStateId ? world.getComponent(gameStateId, COMP.GAME_STATE) : null;
                if (gameState) gameState.state = 'gameover';
                // 同步写入 env.state（兼容过渡期，后续可移除）
                env.state = 'gameover';
            }
            continue;
        }

        // ---- 3b. 子弹 vs 坦克碰撞 ----
        for (const tank of tanks) {
            if (tank.id === bBullet.ownerId) continue;
            const sp = world.getComponent(tank.id, COMP.SPAWN_PROTECT);
            if (sp) continue;

            const dx = Math.abs(bPos.x - tank.pos.x);
            const dy = Math.abs(bPos.y - tank.pos.y);
            if (dx < tank.col.halfW + 3 && dy < tank.col.halfH + 3) {
                world.addComponent(tank.id, COMP.DAMAGE_INFO, {
                    attackerId: bBullet.ownerId,
                    damage: bBullet.power,
                    tags: ['bullet']
                });
                world.addComponent(bulletId, COMP.DESTROYED, {});
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });
                break;
            }
        }
    }
}
