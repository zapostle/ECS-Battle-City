// Shoot System: Handles shooting requests from players and AI
// Natural ordering: Creates Bullet entities when ShootRequest or PlayerInput.shoot exists

import { COMP, DIR, DIR_VEC, BULLET_SPEED, TILE } from '../Constants.js';
import { createPosition, createDirection, createVelocity, createCollision, createBullet, createRender, createAnimation } from '../Components.js';

export function ShootSystem(world) {
    const mapData = world.getComponent(1, COMP.STAGE)?.mapData;
    if (!mapData) return;

    // Process player shoot requests
    for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!input || !shootCd || !dir || !pos) continue;
        if (!input.shoot || shootCd.cooldown > 0) continue;

        input.shoot = false;
        shootCd.cooldown = shootCd.maxCooldown;
        spawnBullet(world, entityId, dir.dir, pos.x, pos.y);
    }

    // Process AI shoot requests
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_REQUEST)) {
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (dir && pos) {
            spawnBullet(world, entityId, dir.dir, pos.x, pos.y);
        }
        world.removeComponent(entityId, COMP.SHOOT_REQUEST);
    }

    // Move bullets
    for (const bulletId of world.getEntitiesWith(COMP.BULLET)) {
        const pos = world.getComponent(bulletId, COMP.POSITION);
        const dir = world.getComponent(bulletId, COMP.DIRECTION);
        const bullet = world.getComponent(bulletId, COMP.BULLET);

        if (!pos || !dir || !bullet) continue;

        const vec = DIR_VEC[dir.dir];
        pos.x += vec[0] * BULLET_SPEED;
        pos.y += vec[1] * BULLET_SPEED;

        // Out of bounds check
        if (pos.x < 0 || pos.x > 26 * 16 || pos.y < 0 || pos.y > 26 * 16) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
        }
    }

    // Decrease cooldowns
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_COOLDOWN)) {
        const cd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        if (cd.cooldown > 0) cd.cooldown--;
    }
}

function spawnBullet(world, ownerId, dir, x, y) {
    const vec = DIR_VEC[dir];
    const bulletId = world.createEntity();

    // Spawn bullet at the tip of the tank
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
