// =============================================================================
// 射击系统 - 处理玩家和AI的射击请求，管理子弹的生成与飞行
// Natural Order: 当 ShootRequest 或 PlayerInput.shoot 存在时创建子弹实体
// 执行顺序: 在 MovementSystem 之后、CollisionSystem 之前
// =============================================================================

import { COMP } from '../Constants.js';
import { createPosition, createDirection, createVelocity, createCollision, createBullet, createRender } from '../Components.js';

export function ShootSystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
    // ★ DIR_VEC 通过 env.config 访问 (Rule 6)
    const DIR_VEC = env.config.dirVec;
    const mapData = env.mapData;
    if (!mapData) return;

    // ==================== 处理玩家的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!input || !shootCd || !dir || !pos) continue;
        if (!input.shoot || shootCd.cooldown > 0) continue;

        input.shoot = false;
        shootCd.cooldown = shootCd.maxCooldown;
        spawnBullet(world, entityId, dir.dir, pos.x, pos.y, DIR_VEC);
    }

    // ==================== 处理 AI 的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_REQUEST)) {
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (dir && pos) {
            spawnBullet(world, entityId, dir.dir, pos.x, pos.y, DIR_VEC);
        }
        world.removeComponent(entityId, COMP.SHOOT_REQUEST);
    }

    // ==================== 移动所有子弹 ====================
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

        // 边界检查：飞出地图则标记销毁
        if (pos.x < 0 || pos.x > gameW || pos.y < 0 || pos.y > gameH) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
        }
    }

    // ==================== 更新所有射击冷却计时器 ====================
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_COOLDOWN)) {
        const cd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        if (cd.cooldown > 0) cd.cooldown--;
    }
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
