// =============================================================================
// 碰撞系统 - 处理所有碰撞检测逻辑
// Natural Order: 读取当前 Position 状态，产生 DamageInfo 事件和 Destroyed 标记
// 负责四种碰撞:
//   1. 坦克 vs 地图瓦片（回滚位置）
//   2. 坦克 vs 坦克（互相推开）
//   3. 子弹 vs 地图瓦片（摧毁子弹+破坏瓦片）
//   4. 子弹 vs 坦克（产生伤害事件）
// =============================================================================

import { COMP, DIR_VEC, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_WATER, TILE_BASE, TILE_BASE_DEAD } from '../Constants.js';

// ====== 辅助函数：检测矩形区域是否与地图中的固体瓦片重叠 ======
// 参数: mapData(地图数据), cx/cy(矩形中心坐标), halfW/halfH(半宽半高), isBullet(是否为子弹)
// 返回: false(无碰撞) | true(普通碰撞) | {tx, ty, tile}(子弹命中具体瓦片信息)
function collidesWithMap(mapData, cx, cy, halfW, halfH, isBullet = false) {
    // 计算矩形的四条边界的瓦片坐标范围
    const left = cx - halfW;
    const right = cx + halfW - 0.01;   // 微小偏移防止边界精度问题
    const top = cy - halfH;
    const bottom = cy + halfH - 0.01;

    const tx1 = Math.floor(left / 16);   // 左边界所在列
    const tx2 = Math.floor(right / 16);  // 右边界所在列
    const ty1 = Math.floor(top / 16);    // 上边界所在行
    const ty2 = Math.floor(bottom / 16); // 下边界所在行

    // 遍历矩形覆盖的所有瓦片
    for (let ty = ty1; ty <= ty2; ty++) {
        for (let tx = tx1; tx <= tx2; tx++) {
            // 超出地图边界视为有障碍
            if (tx < 0 || tx >= 26 || ty < 0 || ty >= 26) return true;
            const tile = mapData[ty][tx];
            if (isBullet) {
                // 子弹可以击中: 砖墙、钢墙、水域、基地（返回详细信息用于后续处理）
                if (tile === TILE_BRICK || tile === TILE_STEEL || tile === TILE_WATER || tile === TILE_BASE) {
                    return { tx, ty, tile };
                }
            } else {
                // 坦克被阻挡: 砖墙、钢墙、水域、基地、已毁基地
                if (tile === TILE_BRICK || tile === TILE_STEEL || tile === TILE_WATER || tile === TILE_BASE || tile === TILE_BASE_DEAD) {
                    return true;
                }
            }
        }
    }
    return false;  // 无碰撞
}

// ====== 碰撞系统主函数 ======
export function CollisionSystem(world) {
    const stage = world.getComponent(1, COMP.STAGE);
    if (!stage) return;
    const mapData = stage.mapData;

    // ---- 收集所有带有位置、碰撞体、坦克类型的实体 ----
    const tanks = [];
    for (const entityId of world.getEntitiesWithAll3(COMP.POSITION, COMP.COLLISION, COMP.TANK_TYPE)) {
        const pos = world.getComponent(entityId, COMP.POSITION);
        const col = world.getComponent(entityId, COMP.COLLISION);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        if (!pos || !col || !dir) continue;
        tanks.push({ id: entityId, pos, col, dir, prevX: pos.x, prevY: pos.y });  // 记录旧位置用于回滚
    }

    // ==================== 1. 坦克 vs 地图碰撞检测 ====================
    for (const tank of tanks) {
        const hit = collidesWithMap(mapData, tank.pos.x, tank.pos.y, tank.col.halfW, tank.col.halfH, false);
        if (hit) {
            // 发生碰撞 → 回滚到上一帧的位置
            tank.pos.x = tank.prevX;
            tank.pos.y = tank.prevY;
        }
    }

    // ==================== 2. 坦克 vs 坦克碰撞检测 ====================
    for (let i = 0; i < tanks.length; i++) {
        for (let j = i + 1; j < tanks.length; j++) {
            const a = tanks[i], b = tanks[j];
            // 计算 AABB 重叠量
            const dx = Math.abs(a.pos.x - b.pos.x);
            const dy = Math.abs(a.pos.y - b.pos.y);
            const overlapX = (a.col.halfW + b.col.halfW) - dx;
            const overlapY = (a.col.halfH + b.col.halfH) - dy;

            if (overlapX > 0 && overlapY > 0) {
                // 发生重叠，按最小分离轴方向互相推开（各推一半）
                if (overlapX < overlapY) {
                    // X轴分离量更小 → 水平推开
                    const push = overlapX / 2;
                    if (a.pos.x < b.pos.x) {
                        a.pos.x -= push; b.pos.x += push;
                    } else {
                        a.pos.x += push; b.pos.x -= push;
                    }
                } else {
                    // Y轴分离量更小 → 垂直推开
                    const push = overlapY / 2;
                    if (a.pos.y < b.pos.y) {
                        a.pos.y -= push; b.pos.y += push;
                    } else {
                        a.pos.y += push; b.pos.y -= push;
                    }
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
        const hit = collidesWithMap(mapData, bPos.x, bPos.y, 3, 3, true);  // 子弹用3x3碰撞盒
        if (hit) {
            // 标记子弹销毁
            world.addComponent(bulletId, COMP.DESTROYED, {});
            // 在碰撞点生成小型爆炸效果
            const expId = world.createEntity();
            world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
            world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });

            // 处理不同类型瓦片的受击效果
            if (hit.tile === TILE_BRICK) {
                mapData[hit.ty][hit.tx] = TILE_EMPTY;  // 砖墙被摧毁变为空地
            } else if (hit.tile === TILE_BASE) {
                mapData[hit.ty][hit.tx] = TILE_BASE_DEAD;  // 基地被毁 → 游戏结束
                stage.state = 'gameover';
            }
            continue;  // 子弹已销毁，跳过坦克碰撞检测
        }

        // ---- 3b. 子弹 vs 坦克碰撞 ----
        for (const tank of tanks) {
            // 不能击中自己（友军伤害免疫）
            if (tank.id === bBullet.ownerId) continue;
            // 跳过处于无敌保护状态的坦克
            const sp = world.getComponent(tank.id, COMP.SPAWN_PROTECT);
            if (sp) continue;

            // AABB 碰撞检测（子弹3x3 vs 坦克碰撞盒）
            const dx = Math.abs(bPos.x - tank.pos.x);
            const dy = Math.abs(bPos.y - tank.pos.y);
            if (dx < tank.col.halfW + 3 && dy < tank.col.halfH + 3) {
                // ---- 命中！添加 DamageInfo 事件组件（由 DamageSystem 消费处理）----
                world.addComponent(tank.id, COMP.DAMAGE_INFO, {
                    attackerId: bBullet.ownerId,  // 攻击者ID（用于计分）
                    damage: bBullet.power,         // 伤害值
                    tags: ['bullet']               // 伤害标签
                });
                // 销毁子弹
                world.addComponent(bulletId, COMP.DESTROYED, {});
                // 生成小型爆炸
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });
                break;  // 一颗子弹只能命中一个目标
            }
        }
    }
}
