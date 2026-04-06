// =============================================================================
// 关卡系统 - 管理游戏生命周期事件
// Natural Order: 通过组件的添加和移除来管理实体生命周期
// 职责:
//   1. 敌人坦克的定时生成
//   2. 胜利条件判定（消灭所有敌人）
//   3. 玩家死亡后的复活逻辑
//   4. 出生保护、爆炸动画、闪烁效果等计时器的更新
//   5. 已标记销毁实体的统一清理
// =============================================================================

import { COMP } from '../Constants.js';
import { ENEMY_SPAWNS, PLAYER_SPAWNS } from './Levels.js';
import {
    createPosition, createDirection, createVelocity, createCollision,
    createTankType, createHP, createShootCooldown, createAIController,
    createRender, createSpawnProtect, createScore, createPlayerInput
} from '../Components.js';

export function StageSystem(world) {
    const stage = world.getComponent(1, COMP.STAGE);
    if (!stage || stage.state !== 'playing') return;

    // ==================== 1. 敌人生成逻辑 ====================
    // 条件: 已生成数 < 最大敌人数(20) 且 场上存活敌人数 < 4（同时最多4个敌人）
    if (stage.enemiesSpawned < stage.maxEnemies && stage.enemyCount < 4) {
        stage.spawnTimer--;
        if (stage.spawnTimer <= 0) {
            stage.spawnTimer = 180;  // 每180帧（约3秒）尝试生成一个敌人
            spawnEnemy(world, stage);
        }
    }

    // ==================== 2. 胜利条件判定 ====================
    // 当已生成的敌人数量达到上限，且场上的敌人和 enemyCount 都归零时 → 过关
    if (stage.enemiesSpawned >= stage.maxEnemies) {
        let enemiesAlive = false;
        // 检查是否还有存活的 AI 敌人
        for (const eid of world.getEntitiesWith(COMP.AI_CTRL)) {
            if (world.getComponent(eid, COMP.HP)) {
                enemiesAlive = true;
                break;
            }
        }
        if (!enemiesAlive && stage.enemyCount <= 0) {
            stage.state = 'victory';  // 所有敌人已被消灭 → 胜利！
        }
    }

    // ==================== 3. 玩家复活逻辑 ====================
    const playerData = world.getComponent(1, COMP.PLAYER_DATA);
    if (playerData && playerData.respawnTimer > 0) {
        playerData.respawnTimer--;
        if (playerData.respawnTimer <= 0) {
            respawnPlayer(world, playerData);  // 倒计时结束 → 复活玩家
        }
    }

    // ==================== 4. 更新出生保护计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_PROTECT)) {
        const sp = world.getComponent(entityId, COMP.SPAWN_PROTECT);
        sp.frames--;
        if (sp.frames <= 0) {
            world.removeComponent(entityId, COMP.SPAWN_PROTECT);  // 保护时间结束 → 移除组件
        }
    }

    // ==================== 5. 更新爆炸动画计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.EXPLOSION)) {
        const exp = world.getComponent(entityId, COMP.EXPLOSION);
        exp.timer++;
        if (exp.timer >= exp.maxTimer) {
            world.addComponent(entityId, COMP.DESTROYED, {});  // 动画播放完毕 → 标记销毁
        }
    }

    // ==================== 6. 更新渲染闪烁效果计时 ====================
    for (const entityId of world.getEntitiesWith(COMP.RENDER)) {
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render.flash > 0) render.flash--;  // 闪烁倒计时递减
    }

    // ==================== 7. 清理已标记销毁的实体 ====================
    const toRemove = [];
    for (const entityId of world.getEntitiesWith(COMP.DESTROYED)) {
        if (entityId <= 2) continue;  // 永远不销毁舞台实体(1)和玩家实体(2)
        toRemove.push(entityId);
    }
    // 统一批量销毁（调用 World.destroyEntity 实现延迟删除）
    for (const id of toRemove) {
        world.destroyEntity(id);
    }
}

// ====== 内部函数：生成一个新的敌人坦克 ======
function spawnEnemy(world, stage) {
    // 循环使用三个出生点
    const spawnIdx = stage.enemiesSpawned % ENEMY_SPAWNS.length;
    const spawn = ENEMY_SPAWNS[spawnIdx];
    const enemyId = world.createEntity();

    // 循环使用4种敌人颜色
    const colorKeys = ['enemy1', 'enemy2', 'enemy3', 'enemy4'];
    const colorKey = colorKeys[stage.enemiesSpawned % colorKeys.length];

    // 为新敌人添加全套组件
    world.addComponent(enemyId, COMP.POSITION, createPosition(spawn.x, spawn.y));      // 位置
    world.addComponent(enemyId, COMP.DIRECTION, createDirection(2));                     // 初始方向向下
    world.addComponent(enemyId, COMP.VELOCITY, createVelocity());                       // 速度
    world.addComponent(enemyId, COMP.COLLISION, createCollision(7, 7));                 // 碰撞体
    world.addComponent(enemyId, COMP.TANK_TYPE, createTankType('enemy', colorKey));     // 类型+颜色
    world.addComponent(enemyId, COMP.HP, createHP(1));                                   // 1血
    world.addComponent(enemyId, COMP.SHOOT_COOLDOWN, createShootCooldown(0, 60));       // 射击冷却60帧
    world.addComponent(enemyId, COMP.AI_CTRL, createAIController('patrol'));             // AI控制器
    world.addComponent(enemyId, COMP.RENDER, createRender('tank', colorKey, 1));        // 渲染
    world.addComponent(enemyId, COMP.SPAWN_PROTECT, createSpawnProtect(60));             // 出生保护60帧

    // 更新关卡统计
    stage.enemiesSpawned++;  // 已生成总数+1
    stage.enemyCount++;      // 当前场上敌人数+1
}

// ====== 内部函数：复活玩家坦克 ======
function respawnPlayer(world, playerData) {
    const spawn = PLAYER_SPAWNS[0];  // 使用主出生点
    const playerId = 2;              // 玩家固定使用 entity ID = 2

    // 先完全清除玩家实体上的所有旧组件
    world.destroyEntity(playerId);

    // 重新添加完整的玩家组件套件（相当于"重生"）
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

    // 恢复之前的累计分数
    const scoreComp = world.getComponent(playerId, COMP.SCORE);
    if (scoreComp) {
        scoreComp.value = playerData.score || 0;
    }
}
