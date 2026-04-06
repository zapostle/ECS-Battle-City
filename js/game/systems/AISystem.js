// AI System: Enemy tank artificial intelligence
// Natural ordering: Produces movement direction on AIController entities

import { COMP, DIR, DIR_VEC, ENEMY_SPEED } from '../Constants.js';
import { TILE_BRICK, TILE_STEEL, TILE_WATER, TILE_EMPTY, TILE_ICE } from '../Constants.js';

export function AISystem(world) {
    // Read stage info
    const stageComp = world.getComponent(1, COMP.STAGE);
    if (!stageComp || stageComp.state !== 'playing') return;

    for (const entityId of world.getEntitiesWith(COMP.AI_CTRL)) {
        const ai = world.getComponent(entityId, COMP.AI_CTRL);
        const dirComp = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!pos || !dirComp) continue;

        ai.thinkTimer--;

        if (ai.thinkTimer <= 0) {
            // AI Decision: choose new direction
            ai.thinkTimer = 60 + Math.floor(Math.random() * 120);
            ai.moveDir = Math.floor(Math.random() * 4);

            // Bias towards player direction (chase behavior)
            const playerInput = world.getComponent(2, COMP.PLAYER_INPUT); // player entity id = 2
            if (playerInput && Math.random() < 0.3) {
                const playerPos = world.getComponent(2, COMP.POSITION);
                if (playerPos) {
                    const dx = playerPos.x - pos.x;
                    const dy = playerPos.y - pos.y;
                    if (Math.abs(dx) > Math.abs(dy)) {
                        ai.moveDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
                    } else {
                        ai.moveDir = dy > 0 ? DIR.DOWN : DIR.UP;
                    }
                }
            }
        }

        // Apply direction
        dirComp.dir = ai.moveDir;

        // Random shooting
        if (Math.random() < ai.shootChance) {
            const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
            if (shootCd && shootCd.cooldown <= 0) {
                shootCd.cooldown = shootCd.maxCooldown;
                world.addComponent(entityId, COMP.SHOOT_REQUEST, {});
            }
        }
    }
}

export { COMP as COMP_AI };
