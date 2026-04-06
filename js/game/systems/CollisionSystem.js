// Collision System: Tank-to-map, Tank-to-tank, Bullet-to-map, Bullet-to-tank collisions
// Natural ordering: Checks current Position state, produces DamageInfo events

import { COMP, DIR_VEC, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_WATER, TILE_BASE, TILE_BASE_DEAD } from '../Constants.js';

// Helper: Check if a rectangle collides with solid tiles
function collidesWithMap(mapData, cx, cy, halfW, halfH, isBullet = false) {
    const left = cx - halfW;
    const right = cx + halfW - 0.01;
    const top = cy - halfH;
    const bottom = cy + halfH - 0.01;

    const tx1 = Math.floor(left / 16);
    const tx2 = Math.floor(right / 16);
    const ty1 = Math.floor(top / 16);
    const ty2 = Math.floor(bottom / 16);

    for (let ty = ty1; ty <= ty2; ty++) {
        for (let tx = tx1; tx <= tx2; tx++) {
            if (tx < 0 || tx >= 26 || ty < 0 || ty >= 26) return true;
            const tile = mapData[ty][tx];
            if (isBullet) {
                if (tile === TILE_BRICK || tile === TILE_STEEL || tile === TILE_WATER || tile === TILE_BASE) {
                    return { tx, ty, tile };
                }
            } else {
                if (tile === TILE_BRICK || tile === TILE_STEEL || tile === TILE_WATER || tile === TILE_BASE || tile === TILE_BASE_DEAD) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function CollisionSystem(world) {
    const stage = world.getComponent(1, COMP.STAGE);
    if (!stage) return;
    const mapData = stage.mapData;

    // Collect all tank entities with positions
    const tanks = [];
    for (const entityId of world.getEntitiesWithAll3(COMP.POSITION, COMP.COLLISION, COMP.TANK_TYPE)) {
        const pos = world.getComponent(entityId, COMP.POSITION);
        const col = world.getComponent(entityId, COMP.COLLISION);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        if (!pos || !col || !dir) continue;
        tanks.push({ id: entityId, pos, col, dir, prevX: pos.x, prevY: pos.y });
    }

    // === Tank-to-Map collisions ===
    for (const tank of tanks) {
        const hit = collidesWithMap(mapData, tank.pos.x, tank.pos.y, tank.col.halfW, tank.col.halfH, false);
        if (hit) {
            tank.pos.x = tank.prevX;
            tank.pos.y = tank.prevY;
        }
    }

    // === Tank-to-Tank collisions ===
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
                    if (a.pos.x < b.pos.x) {
                        a.pos.x -= push; b.pos.x += push;
                    } else {
                        a.pos.x += push; b.pos.x -= push;
                    }
                } else {
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

    // === Bullet-to-Map and Bullet-to-Tank collisions ===
    for (const bulletId of world.getEntitiesWith(COMP.BULLET)) {
        const bPos = world.getComponent(bulletId, COMP.POSITION);
        const bBullet = world.getComponent(bulletId, COMP.BULLET);

        if (!bPos || !bBullet) continue;

        // Bullet vs Map
        const hit = collidesWithMap(mapData, bPos.x, bPos.y, 3, 3, true);
        if (hit) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
            const expId = world.createEntity();
            world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
            world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });

            if (hit.tile === TILE_BRICK) {
                mapData[hit.ty][hit.tx] = TILE_EMPTY;
            } else if (hit.tile === TILE_BASE) {
                mapData[hit.ty][hit.tx] = TILE_BASE_DEAD;
                stage.state = 'gameover';
            }
            continue; // Bullet destroyed, skip tank checks
        }

        // Bullet vs Tank
        for (const tank of tanks) {
            if (tank.id === bBullet.ownerId) continue;
            // Skip tanks with spawn protection
            const sp = world.getComponent(tank.id, COMP.SPAWN_PROTECT);
            if (sp) continue;

            const dx = Math.abs(bPos.x - tank.pos.x);
            const dy = Math.abs(bPos.y - tank.pos.y);
            if (dx < tank.col.halfW + 3 && dy < tank.col.halfH + 3) {
                // Hit! Add DamageInfo event component (consumed by DamageSystem)
                world.addComponent(tank.id, COMP.DAMAGE_INFO, {
                    attackerId: bBullet.ownerId,
                    damage: bBullet.power,
                    tags: ['bullet']
                });
                world.addComponent(bulletId, COMP.DESTROYED, {});

                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: bPos.x, y: bPos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 1, timer: 0, maxTimer: 8 });
                break; // One bullet can only hit one tank
            }
        }
    }
}
