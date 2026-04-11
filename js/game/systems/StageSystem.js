// =============================================================================
// 关卡系统 - 管理游戏生命周期事件
// Natural Order: 通过组件的添加和移除来管理实体生命周期
// 现在通过 Environment（环境容器）访问全局状态，不再依赖 stage 单例实体
// =============================================================================

import { COMP } from '../Constants.js';
import {
    createPosition, createDirection, createVelocity, createCollision,
    createTankType, createHP, createShootCooldown, createAIController,
    createRender, createSpawnProtect, createScore, createPlayerInput
} from '../Components.js';

/**
 * 查找拥有指定组件的唯一实体（用于玩家等单例实体）
 */
function findUniqueEntity(world, compType) {
    for (const id of world.getEntitiesWith(compType)) {
        return id;
    }
    return null;
}

export function StageSystem(world, _env) {  // ★ 规范签名: (world, env)
    const env = world.env;
    if (!env || env.state !== 'playing') return;

    const playerEntityId = findUniqueEntity(world, COMP.PLAYER_INPUT);

    // ==================== 1. 敌人生成逻辑 ====================
    if (env.enemiesSpawned < env.maxEnemies && env.enemyCount < env.config.combat.MAX_ENEMIES_ON_SCREEN) {
        env.spawnTimer--;
        if (env.spawnTimer <= 0) {
            env.spawnTimer = env.config.combat.ENEMY_SPAWN_INTERVAL;  // ★ 通过 env.config 访问 (Rule 6)
            console.log(`[StageSystem] 🎯 敌人生成 | 已生成: ${env.enemiesSpawned}/${env.maxEnemies} | 场上: ${env.enemyCount}`);
            spawnEnemy(world, env);
        }
    }

    // ==================== 2. 胜利条件判定 ====================
    if (env.enemiesSpawned >= env.maxEnemies) {
        let enemiesAlive = false;
        for (const eid of world.getEntitiesWith(COMP.AI_CTRL)) {
            if (world.getComponent(eid, COMP.HP)) {
                enemiesAlive = true;
                break;
            }
        }
        if (!enemiesAlive && env.enemyCount <= 0) {
            console.log(`[StageSystem] 🏆 胜利条件达成! | 已生成敌人: ${env.enemiesSpawned}/${env.maxEnemies} | 关卡: ${env.level}`);
            env.state = 'victory';  // ★ 通过环境修改全局状态
        }
    }

    // ==================== 3. 玩家复活逻辑 ====================
    if (env.respawnTimer > 0) {
        env.respawnTimer--;
        if (env.respawnTimer <= 0) {
            console.log(`[StageSystem] ❤️ 玩家复活 | 剩余生命: ${env.playerLives} | 累计分数: ${env.playerScore}`);
            respawnPlayer(world, env);
        }
    }

    // ==================== 4. 更新出生保护计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_PROTECT)) {
        const sp = world.getComponent(entityId, COMP.SPAWN_PROTECT);
        sp.frames--;
        if (sp.frames <= 0) {
            console.log(`[StageSystem] 🛡️ 出生保护结束 | 实体ID: ${entityId}`);
            world.removeComponent(entityId, COMP.SPAWN_PROTECT);
        }
    }

    // ==================== 5. 更新爆炸动画计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.EXPLOSION)) {
        const exp = world.getComponent(entityId, COMP.EXPLOSION);
        exp.timer++;
        if (exp.timer >= exp.maxTimer) {
            world.addComponent(entityId, COMP.DESTROYED, {});
        }
    }

    // ==================== 6. 更新渲染闪烁效果计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.RENDER)) {
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render.flash > 0) render.flash--;
    }

    // ==================== 7. 清理已标记销毁的实体 ====================
    const toRemove = [];
    for (const entityId of world.getEntitiesWith(COMP.DESTROYED)) {
        if (entityId === playerEntityId) continue;  // 跳过玩家实体
        toRemove.push(entityId);
    }
    for (const id of toRemove) {
        world.destroyEntity(id);
    }
}

// ====== 内部函数：生成一个新的敌人坦克 ======
function spawnEnemy(world, env) {
    const spawns = env.config.spawn.ENEMY;
    const spawnIdx = env.enemiesSpawned % spawns.length;
    const spawn = spawns[spawnIdx];
    const enemyId = world.createEntity();

    const colorKeys = ['enemy1', 'enemy2', 'enemy3', 'enemy4'];
    const colorKey = colorKeys[env.enemiesSpawned % colorKeys.length];

    const enemyShootCd = env.config.combat.ENEMY_SHOOT_CD;
    const enemyProtectFrames = env.config.combat.SPAWN_PROTECT_ENEMY;

    world.addComponent(enemyId, COMP.POSITION, createPosition(spawn.x, spawn.y));
    world.addComponent(enemyId, COMP.DIRECTION, createDirection(2));
    world.addComponent(enemyId, COMP.VELOCITY, createVelocity());
    world.addComponent(enemyId, COMP.COLLISION, createCollision(7, 7));
    world.addComponent(enemyId, COMP.TANK_TYPE, createTankType('enemy', colorKey));
    world.addComponent(enemyId, COMP.HP, createHP(1));
    world.addComponent(enemyId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, enemyShootCd));
    world.addComponent(enemyId, COMP.AI_CTRL, createAIController('patrol'));
    world.addComponent(enemyId, COMP.RENDER, createRender('tank', colorKey, 1));
    world.addComponent(enemyId, COMP.SPAWN_PROTECT, createSpawnProtect(enemyProtectFrames));

    env.enemiesSpawned++;
    env.enemyCount++;
}

// ====== 内部函数：复活玩家坦克 ======
function respawnPlayer(world, env) {
    const playerId = findUniqueEntity(world, COMP.PLAYER_INPUT);

    if (!playerId) {
        const newPlayerId = world.createEntity();
        _initPlayerComponents(world, newPlayerId, env);
        return;
    }

    world.destroyEntity(playerId);
    _initPlayerComponents(world, playerId, env);
}

/** 初始化/重建玩家的完整组件套件 */
function _initPlayerComponents(world, playerId, env) {
    const spawn = env.config.spawn.PLAYER[0];
    const playerShootCd = env.config.combat.PLAYER_SHOOT_CD;
    const playerProtectFrames = env.config.combat.SPAWN_PROTECT_PLAYER;

    world.addComponent(playerId, COMP.POSITION, createPosition(spawn.x, spawn.y));
    world.addComponent(playerId, COMP.DIRECTION, createDirection(0));
    world.addComponent(playerId, COMP.VELOCITY, createVelocity());
    world.addComponent(playerId, COMP.COLLISION, createCollision(7, 7));
    world.addComponent(playerId, COMP.TANK_TYPE, createTankType('player', 'player'));
    world.addComponent(playerId, COMP.HP, createHP(env.config.combat.PLAYER_HP));
    world.addComponent(playerId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, playerShootCd));
    world.addComponent(playerId, COMP.PLAYER_INPUT, createPlayerInput());
    world.addComponent(playerId, COMP.RENDER, createRender('tank', 'player', 1));
    world.addComponent(playerId, COMP.SPAWN_PROTECT, createSpawnProtect(playerProtectFrames));
    world.addComponent(playerId, COMP.SCORE, createScore());

    const scoreComp = world.getComponent(playerId, COMP.SCORE);
    if (scoreComp) scoreComp.value = env.playerScore || 0;
}
