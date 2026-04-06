// Stage System: Manages game state, enemy spawning, level progression
// Natural ordering: Manages lifecycle events via component addition/removal

import { COMP } from '../Constants.js';
import { ENEMY_SPAWNS, PLAYER_SPAWNS } from '../Levels.js';
import {
    createPosition, createDirection, createVelocity, createCollision,
    createTankType, createHP, createShootCooldown, createAIController,
    createRender, createSpawnProtect, createScore, createPlayerInput
} from '../Components.js';

export function StageSystem(world) {
    const stage = world.getComponent(1, COMP.STAGE);
    if (!stage || stage.state !== 'playing') return;

    // === Spawn enemies ===
    if (stage.enemiesSpawned < stage.maxEnemies && stage.enemyCount < 4) {
        stage.spawnTimer--;
        if (stage.spawnTimer <= 0) {
            stage.spawnTimer = 180;
            spawnEnemy(world, stage);
        }
    }

    // === Check win condition ===
    if (stage.enemiesSpawned >= stage.maxEnemies) {
        let enemiesAlive = false;
        for (const eid of world.getEntitiesWith(COMP.AI_CTRL)) {
            if (world.getComponent(eid, COMP.HP)) {
                enemiesAlive = true;
                break;
            }
        }
        if (!enemiesAlive && stage.enemyCount <= 0) {
            stage.state = 'victory';
        }
    }

    // === Respawn player ===
    const playerData = world.getComponent(1, COMP.PLAYER_DATA);
    if (playerData && playerData.respawnTimer > 0) {
        playerData.respawnTimer--;
        if (playerData.respawnTimer <= 0) {
            respawnPlayer(world, playerData);
        }
    }

    // === Update spawn protect ===
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_PROTECT)) {
        const sp = world.getComponent(entityId, COMP.SPAWN_PROTECT);
        sp.frames--;
        if (sp.frames <= 0) {
            world.removeComponent(entityId, COMP.SPAWN_PROTECT);
        }
    }

    // === Update explosions ===
    for (const entityId of world.getEntitiesWith(COMP.EXPLOSION)) {
        const exp = world.getComponent(entityId, COMP.EXPLOSION);
        exp.timer++;
        if (exp.timer >= exp.maxTimer) {
            world.addComponent(entityId, COMP.DESTROYED, {});
        }
    }

    // === Render flash countdown ===
    for (const entityId of world.getEntitiesWith(COMP.RENDER)) {
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render.flash > 0) render.flash--;
    }

    // === Cleanup destroyed entities ===
    const toRemove = [];
    for (const entityId of world.getEntitiesWith(COMP.DESTROYED)) {
        if (entityId <= 2) continue; // Never destroy stage (1) or player (2)
        toRemove.push(entityId);
    }
    for (const id of toRemove) {
        world.destroyEntity(id);
    }
}

function spawnEnemy(world, stage) {
    const spawnIdx = stage.enemiesSpawned % ENEMY_SPAWNS.length;
    const spawn = ENEMY_SPAWNS[spawnIdx];
    const enemyId = world.createEntity();

    const colorKeys = ['enemy1', 'enemy2', 'enemy3', 'enemy4'];
    const colorKey = colorKeys[stage.enemiesSpawned % colorKeys.length];

    world.addComponent(enemyId, COMP.POSITION, createPosition(spawn.x, spawn.y));
    world.addComponent(enemyId, COMP.DIRECTION, createDirection(2));
    world.addComponent(enemyId, COMP.VELOCITY, createVelocity());
    world.addComponent(enemyId, COMP.COLLISION, createCollision(7, 7));
    world.addComponent(enemyId, COMP.TANK_TYPE, createTankType('enemy', colorKey));
    world.addComponent(enemyId, COMP.HP, createHP(1));
    world.addComponent(enemyId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, 60));
    world.addComponent(enemyId, COMP.AI_CTRL, createAIController('patrol'));
    world.addComponent(enemyId, COMP.RENDER, createRender('tank', colorKey, 1));
    world.addComponent(enemyId, COMP.SPAWN_PROTECT, createSpawnProtect(60));

    stage.enemiesSpawned++;
    stage.enemyCount++;
}

function respawnPlayer(world, playerData) {
    const spawn = PLAYER_SPAWNS[0];
    const playerId = 2;

    // Clear all existing components on player entity
    world.destroyEntity(playerId);

    // Re-add all player components fresh
    world.addComponent(playerId, COMP.POSITION, createPosition(spawn.x, spawn.y));
    world.addComponent(playerId, COMP.DIRECTION, createDirection(0));
    world.addComponent(playerId, COMP.VELOCITY, createVelocity());
    world.addComponent(playerId, COMP.COLLISION, createCollision(7, 7));
    world.addComponent(playerId, COMP.TANK_TYPE, createTankType('player', 'player'));
    world.addComponent(playerId, COMP.HP, createHP(1));
    world.addComponent(playerId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, 20));
    world.addComponent(playerId, COMP.PLAYER_INPUT, createPlayerInput());
    world.addComponent(playerId, COMP.RENDER, createRender('tank', 'player', 1));
    world.addComponent(playerId, COMP.SPAWN_PROTECT, createSpawnProtect(120));
    world.addComponent(playerId, COMP.SCORE, createScore());

    // Restore score
    const scoreComp = world.getComponent(playerId, COMP.SCORE);
    if (scoreComp) {
        scoreComp.value = playerData.score || 0;
    }
}
