// =============================================================================
// 射击系统 - 处理玩家和AI的射击请求，管理子弹的生成与飞行
//
// ★ "事件即实体"重构：
//   - ShootCooldown.cooldown 递减改由 PendingAction 事件实体驱动
//   - 射击时创建 PendingAction{setField:'cooldown', value:0} 事件实体
//   - 本系统不再自减 cooldown
// =============================================================================

import { COMP } from '../Constants.js';
import { createPosition, createDirection, createVelocity, createCollision, createBullet, createRender, createPendingAction } from '../Components.js';

export function ShootSystem(world, env) {
    const DIR_VEC = env.config.dirVec;

    // ==================== 规则10: 处理玩家的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
        if (world.hasComponent(entityId, COMP.DESTROYED)) continue;

        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!input || !shootCd || !dir || !pos) continue;
        if (!input.shoot || shootCd.cooldown > 0) continue;

        input.shoot = false;
        shootCd.cooldown = shootCd.maxCooldown;

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

        spawnBullet(world, entityId, dir.dir, pos.x, pos.y, DIR_VEC);
    }

    // ==================== 规则11: 处理 AI 的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_REQUEST)) {
        if (world.hasComponent(entityId, COMP.DESTROYED)) {
            world.removeComponent(entityId, COMP.SHOOT_REQUEST);
            continue;
        }
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);
        const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);

        if (dir && pos) {
            spawnBullet(world, entityId, dir.dir, pos.x, pos.y, DIR_VEC);

            // ★ 创建事件实体："冷却时间后 cooldown 归零"
            if (shootCd) {
                shootCd.cooldown = shootCd.maxCooldown;
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
        world.removeComponent(entityId, COMP.SHOOT_REQUEST);
    }

    // ==================== 规则12+13: 移动所有子弹 + 边界检测 ====================
    const bulletSpeed = env.config.speed.BULLET;
    const MAP_W = env.config.map.MAP_W;
    const MAP_H = env.config.map.MAP_H;
    const TILE = env.config.map.TILE;
    const gameW = MAP_W * TILE;
    const gameH = MAP_H * TILE;

    for (const bulletId of world.getEntitiesWith(COMP.BULLET)) {
        const pos = world.getComponent(bulletId, COMP.POSITION);
        const dir = world.getComponent(bulletId, COMP.DIRECTION);

        if (!pos || !dir) continue;

        const vec = DIR_VEC[dir.dir] || [0, 0];
        pos.x += vec[0] * bulletSpeed;
        pos.y += vec[1] * bulletSpeed;

        // 规则13: 边界检查——飞出地图则标记销毁
        if (pos.x < 0 || pos.x > gameW || pos.y < 0 || pos.y > gameH) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
        }
    }

    // ★ 不再自减 cooldown — 由 PendingAction 事件实体驱动
}

function spawnBullet(world, ownerId, dir, x, y, DIR_VEC) {
    const vec = (DIR_VEC && DIR_VEC[dir]) || [0, 0];
    const bulletId = world.createEntity();

    const offset = 10;
    world.addComponent(bulletId, COMP.POSITION, createPosition(
        x + vec[0] * offset,
        y + vec[1] * offset
    ));
    world.addComponent(bulletId, COMP.DIRECTION, createDirection(dir));
    world.addComponent(bulletId, COMP.VELOCITY, createVelocity());
    world.addComponent(bulletId, COMP.COLLISION, createCollision(3, 3));
    world.addComponent(bulletId, COMP.BULLET, createBullet(ownerId, 1));
    world.addComponent(bulletId, COMP.RENDER, createRender('bullet', '#FFFFFF'));
}
