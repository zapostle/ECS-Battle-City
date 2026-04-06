// Damage System: Processes DamageInfo event components (add -> process -> remove pattern)
// Natural ordering: Triggered ONLY when HpComponent + DamageInfoComponent coexist on same entity
// This demonstrates the core Natural Order ECS principle

import { COMP } from '../Constants.js';

export function DamageSystem(world) {
    const stageComp = world.getComponent(1, COMP.STAGE);
    if (!stageComp) return;

    for (const entityId of world.getEntitiesWithAll(COMP.HP, COMP.DAMAGE_INFO)) {
        const hp = world.getComponent(entityId, COMP.HP);
        const dmgInfo = world.getComponent(entityId, COMP.DAMAGE_INFO);

        if (!hp || !dmgInfo) continue;

        // Apply damage
        hp.hp -= dmgInfo.damage;

        // Flash effect
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render) render.flash = 4;

        // Check death
        if (hp.hp <= 0) {
            // Create large explosion at death position
            const pos = world.getComponent(entityId, COMP.POSITION);
            if (pos) {
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: pos.x, y: pos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 2, timer: 0, maxTimer: 20 });
                world.addComponent(expId, COMP.RENDER, { type: 'explosion', color: '#FF4500', zIndex: 2, flash: 0 });
            }

            // Check if enemy - award score
            const tankType = world.getComponent(entityId, COMP.TANK_TYPE);
            if (tankType && tankType.type === 'enemy') {
                stageComp.enemyCount--;
                for (const pid of world.getEntitiesWith(COMP.SCORE)) {
                    const score = world.getComponent(pid, COMP.SCORE);
                    score.value += 100;
                }
            }

            // Check if player died
            if (tankType && tankType.type === 'player') {
                const playerData = world.getComponent(1, COMP.PLAYER_DATA);
                if (playerData) {
                    playerData.lives--;
                    // Save current score before destruction
                    const scoreComp = world.getComponent(entityId, COMP.SCORE);
                    if (scoreComp) playerData.score = scoreComp.value;
                    if (playerData.lives > 0) {
                        playerData.respawnTimer = 90;
                    } else {
                        stageComp.state = 'gameover';
                    }
                }
            }

            // Mark for deferred removal
            world.addComponent(entityId, COMP.DESTROYED, {});
        }

        // CRITICAL: Consume event component (Add → Process → Remove)
        // This is the Natural Order ECS pattern - the DamageInfoComponent is an EVENT
        // It exists only for one tick: produced by CollisionSystem, consumed here.
        // Next tick, DamageSystem won't trigger because DamageInfo no longer exists.
        world.removeComponent(entityId, COMP.DAMAGE_INFO);
    }
}
