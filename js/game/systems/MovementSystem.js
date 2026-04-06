// Movement System: Applies velocity from input/AI to position
// Natural ordering: Only moves tanks that have direction (from InputSystem or AISystem)
// Applies movement first, then CollisionSystem will revert if needed

import { COMP, DIR, DIR_VEC, PLAYER_SPEED, ENEMY_SPEED } from '../Constants.js';

export function MovementSystem(world) {
    for (const entityId of world.getEntitiesWith(COMP.TANK_TYPE)) {
        const pos = world.getComponent(entityId, COMP.POSITION);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const col = world.getComponent(entityId, COMP.COLLISION);
        const tankType = world.getComponent(entityId, COMP.TANK_TYPE);

        if (!pos || !dir || !col) continue;

        // Check if this tank should move
        let shouldMove = false;
        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const aiCtrl = world.getComponent(entityId, COMP.AI_CTRL);

        if (input && input.dir >= 0) {
            shouldMove = true;
            dir.dir = input.dir; // Update direction from player input
        } else if (aiCtrl) {
            shouldMove = true;
            dir.dir = aiCtrl.moveDir; // Direction set by AISystem
        }

        if (!shouldMove) continue;

        const speed = tankType.type === 'player' ? PLAYER_SPEED : ENEMY_SPEED;
        const vec = DIR_VEC[dir.dir];
        const dx = vec[0];
        const dy = vec[1];

        // Save previous position for collision revert
        const prevX = pos.x;
        const prevY = pos.y;

        // Snap perpendicular axis to grid when turning (FC-style)
        if (dx !== 0) {
            // Moving horizontally, gradually align Y to tile center
            const tileY = Math.round((pos.y - 8) / 16);
            const targetY = tileY * 16 + 8;
            const diff = targetY - pos.y;
            if (Math.abs(diff) > 0.5) {
                pos.y += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);
            }
        }
        if (dy !== 0) {
            // Moving vertically, gradually align X to tile center
            const tileX = Math.round((pos.x - 8) / 16);
            const targetX = tileX * 16 + 8;
            const diff = targetX - pos.x;
            if (Math.abs(diff) > 0.5) {
                pos.x += Math.sign(diff) * Math.min(Math.abs(diff), speed * 0.8);
            }
        }

        // Apply movement
        pos.x += dx * speed;
        pos.y += dy * speed;

        // Boundary clamping
        pos.x = Math.max(col.halfW, Math.min(26 * 16 - col.halfW, pos.x));
        pos.y = Math.max(col.halfH, Math.min(26 * 16 - col.halfH, pos.y));
    }
}
