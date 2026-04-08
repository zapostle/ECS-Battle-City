// =============================================================================
// 关卡系统 - 管理游戏生命周期事件
// Natural Order: 通过组件的添加和移除来管理实体生命周期
//
// 重要设计决策：
//   不再硬编码任何实体ID（如 stage=1, player=2）
//   所有实体引用通过组件查询动态获取：
//     舞台实体 → 拥有 COMP.STAGE 的唯一实体
//     玩家实体 → 拥有 COMP.PLAYER_INPUT 的唯一实体
//   这样即使 World 的 _nextEntityId 从任意值开始也不会冲突
// =============================================================================

import { COMP } from '../Constants.js';
import { ENEMY_SPAWNS, PLAYER_SPAWNS } from '../Levels.js';
import {
    createPosition, createDirection, createVelocity, createCollision,
    createTankType, createHP, createShootCooldown, createAIController,
    createRender, createSpawnProtect, createScore, createPlayerInput
} from '../Components.js';

/**
 * 查找拥有指定组件的唯一实体（用于舞台/玩家等单例实体）
 * 如果找到多个则返回第一个，未找到返回 null
 */
function findUniqueEntity(world, compType) {
    for (const id of world.getEntitiesWith(compType)) {
        return id;
    }
    return null;
}

export function StageSystem(world) {
    // ---- 动态获取舞台和玩家实体ID ----
    const stageEntityId = findUniqueEntity(world, COMP.STAGE);
    const playerEntityId = findUniqueEntity(world, COMP.PLAYER_INPUT);

    const stage = stageEntityId ? world.getComponent(stageEntityId, COMP.STAGE) : null;
    if (!stage || stage.state !== 'playing') return;

    // ==================== 1. 敌人生成逻辑 ====================
    if (stage.enemiesSpawned < stage.maxEnemies && stage.enemyCount < 4) {
        stage.spawnTimer--;
        if (stage.spawnTimer <= 0) {
            stage.spawnTimer = 180;
            console.log(`[StageSystem] 🎯 敌人生成 | 已生成: ${stage.enemiesSpawned}/${stage.maxEnemies} | 场上: ${stage.enemyCount}`);
            spawnEnemy(world, stage);
        }
    }

    // ==================== 2. 胜利条件判定 ====================
    if (stage.enemiesSpawned >= stage.maxEnemies) {
        let enemiesAlive = false;
        for (const eid of world.getEntitiesWith(COMP.AI_CTRL)) {
            if (world.getComponent(eid, COMP.HP)) {
                enemiesAlive = true;
                break;
            }
        }
        if (!enemiesAlive && stage.enemyCount <= 0) {
            console.log(`[StageSystem] 🏆 胜利条件达成! | 已生成敌人: ${stage.enemiesSpawned}/${stage.maxEnemies} | 关卡: ${stage.level}`);
            stage.state = 'victory';
        }
    }

    // ==================== 3. 玩家复活逻辑 ====================
    const playerData = stageEntityId ? world.getComponent(stageEntityId, COMP.PLAYER_DATA) : null;
    if (playerData && playerData.respawnTimer > 0) {
        playerData.respawnTimer--;
        if (playerData.respawnTimer <= 0) {
            console.log(`[StageSystem] ❤️ 玩家复活 | 剩余生命: ${playerData.lives} | 累计分数: ${playerData.score}`);
            respawnPlayer(world, playerData);  // 倒计时结束 → 复活玩家
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
    // 保护特殊实体（舞台+玩家）不被自动销毁，通过组件查询而非硬编码ID
    const toRemove = [];
    for (const entityId of world.getEntitiesWith(COMP.DESTROYED)) {
        // 跳过舞台实体和玩家实体（它们有自己的销毁/复活逻辑）
        if (entityId === stageEntityId || entityId === playerEntityId) continue;
        toRemove.push(entityId);
    }
    for (const id of toRemove) {
        world.destroyEntity(id);
    }
}

// ====== 内部函数：生成一个新的敌人坦克 ======
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
    console.log(`[StageSystem] 👾 敌人已生成! | ID: ${enemyId} | 颜色: ${colorKey} | 出生点: (${spawn.x}, ${spawn.y})`);
}

// ====== 内部函数：复活玩家坦克 ======
function respawnPlayer(world, playerData) {
    // 动态查找玩家实体ID（通过 PLAYER_INPUT 组件）
    const playerId = findUniqueEntity(world, COMP.PLAYER_INPUT);

    if (!playerId) {
        console.warn('[StageSystem] ⚠️ 复活失败：找不到玩家实体（无 PLAYER_INPUT 组件）');
        // 创建全新的玩家实体
        const newPlayerId = world.createEntity();
        _initPlayerComponents(world, newPlayerId, playerData);
        console.log(`[StageSystem] ❤️ 玩家重新创建 | 新ID: ${newPlayerId}`);
        return;
    }

    // 销毁旧组件并重建（保留同一实体ID，让外部引用不失效）
    world.destroyEntity(playerId);
    _initPlayerComponents(world, playerId, playerData);
    console.log(`[StageSystem] ❤️ 玩家已复活 | ID: ${playerId}`);
}

/** 初始化/重建玩家的完整组件套件 */
function _initPlayerComponents(world, playerId, playerData) {
    const spawn = PLAYER_SPAWNS[0];

    world.addComponent(playerId, COMP.POSITION, createPosition(spawn.x, spawn.y));
    world.addComponent(playerId, COMP.DIRECTION, createDirection(0));                      // 默认朝上
    world.addComponent(playerId, COMP.VELOCITY, createVelocity());
    world.addComponent(playerId, COMP.COLLISION, createCollision(7, 7));
    world.addComponent(playerId, COMP.TANK_TYPE, createTankType('player', 'player'));
    world.addComponent(playerId, COMP.HP, createHP(1));
    world.addComponent(playerId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, 20));
    world.addComponent(playerId, COMP.PLAYER_INPUT, createPlayerInput());                  // 重新注册输入
    world.addComponent(playerId, COMP.RENDER, createRender('tank', 'player', 1));
    world.addComponent(playerId, COMP.SPAWN_PROTECT, createSpawnProtect(120));             // 2秒无敌时间
    world.addComponent(playerId, COMP.SCORE, createScore());

    // 恢复累计分数
    const scoreComp = world.getComponent(playerId, COMP.SCORE);
    if (scoreComp) {
        scoreComp.value = playerData.score || 0;
    }
}
