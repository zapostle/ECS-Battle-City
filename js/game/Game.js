// =============================================================================
// 游戏主模块 - Natural Order ECS 坦克大战
// 作为程序入口，负责：
//   1. 初始化 Canvas 画布和渲染上下文
//   2. 创建并配置 ECS World（实体容器 + 环境容器）
//   3. 注册所有游戏系统（按执行顺序）
//   4. 运行游戏主循环（requestAnimationFrame）
//   5. 管理游戏状态转换（标题/游戏中/通关/游戏结束）
// =============================================================================

import { World } from '../ecs/World.js';
import { COMP, MAP_W, TILE_SIZE, CANVAS_TOTAL_H } from './Constants.js';
import { LEVELS } from './Levels.js';
import { GameConfig } from './GameConfig.js';
import * as Components from './Components.js';
import { EntityMonitor } from './EntityMonitor.js';
import { createInputSystem, createKeyState, setupKeyListeners } from './systems/InputSystem.js';
import { AISystem } from './systems/AISystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { ShootSystem } from './systems/ShootSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { DamageSystem } from './systems/DamageSystem.js';
import { TimerSystem } from './systems/TimerSystem.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { CleanupSystem } from './systems/CleanupSystem.js';
import { VictorySystem } from './systems/VictorySystem.js';
import { RespawnSystem } from './systems/RespawnSystem.js';
import { createRenderSystem } from './systems/RenderSystem.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scale = 2;

        // 设置 Canvas 实际像素尺寸
        canvas.width = MAP_W * TILE_SIZE * this.scale;
        canvas.height = CANVAS_TOTAL_H * this.scale;

        this.keyState = createKeyState();
        this.cleanupFn = setupKeyListeners(this.keyState);

        this.currentLevel = 0;
        this.running = false;
        this.gameState = 'title';
    }

    startLevel(levelIdx = 0) {
        this.currentLevel = levelIdx;
        this._setupWorld();
        this.gameState = 'playing';
    }

    _setupWorld() {
        // ==================== 创建 World + Environment ====================
        this.world = new World(GameConfig);
        const env = this.world.env;

        // ==================== 初始化环境运行时状态 ====================
        const levelData = LEVELS[this.currentLevel % LEVELS.length];
        const mapData = levelData.map(row => [...row]);  // 深拷贝地图数据

        env.reset(this.currentLevel + 1, mapData);
        env.playerLives = 3;

        // ==================== 注册所有游戏系统（按执行顺序）====================
        // Natural Order: 系统执行顺序由组件的添加/移除自然驱动
        this.world.addSystem(createInputSystem(this.keyState), 'InputSystem');
        this.world.addSystem(AISystem, 'AISystem');
        this.world.addSystem(MovementSystem, 'MovementSystem');
        this.world.addSystem(ShootSystem, 'ShootSystem');
        this.world.addSystem(CollisionSystem, 'CollisionSystem');
        this.world.addSystem(DamageSystem, 'DamageSystem');
        this.world.addSystem(TimerSystem, 'TimerSystem');
        this.world.addSystem(SpawnSystem, 'SpawnSystem');
        this.world.addSystem(RespawnSystem, 'RespawnSystem');
        this.world.addSystem(CleanupSystem, 'CleanupSystem');
        this.world.addSystem(VictorySystem, 'VictorySystem');
        this.world.addSystem(createRenderSystem(this.ctx, this.scale), 'RenderSystem');

        // ==================== 创建玩家坦克实体 ====================
        // ★ 通过组件声明实体的能力，而非硬编码到系统中
        const playerId = this.world.createEntity();
        this._initPlayerComponents(this.world, playerId, env);

        // 启动玩家监控器
        const playerMonitor = new EntityMonitor(playerId, '玩家坦克');
        playerMonitor.ignore('SpawnProtect');
        this.world.registerMonitor(playerMonitor);
        playerMonitor.start();
        window.__playerMonitor = playerMonitor;

        // ==================== 创建敌人生成器实体 ====================
        // ★ 将"敌人生成"从 StageSystem 硬编码 → 变为 SpawnTimer 组件驱动
        const spawnerId = this.world.createEntity();
        const maxEnemies = env.config.combat.MAX_ENEMIES_PER_STAGE;
        const spawnInterval = env.config.combat.ENEMY_SPAWN_INTERVAL;
        const firstSpawnDelay = env.config.combat.FIRST_SPAWN_DELAY;
        const maxOnScreen = env.config.combat.MAX_ENEMIES_ON_SCREEN;

        this.world.addComponent(spawnerId, COMP.SPAWN_TIMER, Components.createSpawnTimer({
            timer: firstSpawnDelay,
            interval: spawnInterval,
            repeat: true,
            maxActive: maxOnScreen,
            activeCount: 0,
            onSpawn: (world, env, st) => {
                _spawnEnemy(world, env, st);
            },
        }));

        // ★ 存储总生成数到 env（VictorySystem 不再依赖 env.maxEnemies）
        env.maxEnemies = maxEnemies;
        env.enemiesSpawned = 0;
    }

    /** 初始化/重建玩家的完整组件套件 */
    _initPlayerComponents(world, playerId, env) {
        const spawn = env.config.spawn.PLAYER[0];
        const playerShootCd = env.config.combat.PLAYER_SHOOT_CD;
        const playerProtectFrames = env.config.combat.SPAWN_PROTECT_PLAYER;

        world.addComponent(playerId, COMP.POSITION, Components.createPosition(spawn.x, spawn.y));
        world.addComponent(playerId, COMP.DIRECTION, Components.createDirection(0));
        world.addComponent(playerId, COMP.VELOCITY, Components.createVelocity());
        world.addComponent(playerId, COMP.COLLISION, Components.createCollision(7, 7));
        world.addComponent(playerId, COMP.TANK_TYPE, Components.createTankType('player', 'player'));
        world.addComponent(playerId, COMP.HP, Components.createHP(env.config.combat.PLAYER_HP));
        world.addComponent(playerId, COMP.SHOOT_COOLDOWN, Components.createShootCooldown(0, playerShootCd));
        world.addComponent(playerId, COMP.PLAYER_INPUT, Components.createPlayerInput());
        world.addComponent(playerId, COMP.RENDER, Components.createRender('tank', 'player', 1));
        world.addComponent(playerId, COMP.SPAWN_PROTECT, Components.createSpawnProtect(playerProtectFrames));
        world.addComponent(playerId, COMP.SCORE, Components.createScore());
        // ★ 声明式组件：告知系统"此实体有3条命"和"复活后如何重建"
        // respawnTemplate 是一个闭包函数，RespawnSystem 会在复活时调用它来重建组件
        const gameRef = this;  // 闭包引用 Game 实例
        world.addComponent(playerId, COMP.LIVES, Components.createLives(env.playerLives));
        world.getComponent(playerId, COMP.LIVES).respawnTemplate = (world, env, entityId) => {
            gameRef._initPlayerComponents(world, entityId, env);
        };
        world.addComponent(playerId, COMP.KILL_REWARD, Components.createKillReward(0));  // 玩家被击杀不给奖励

        // 恢复已有分数
        const scoreComp = world.getComponent(playerId, COMP.SCORE);
        if (scoreComp && env.playerScore) scoreComp.value = env.playerScore;
    }

    tick() {
        if (this.gameState === 'title') {
            this._drawTitle(); return;
        }
        if (this.gameState === 'gameover') {
            this._drawGameOver(); return;
        }
        if (this.gameState === 'stageclear') {
            this._drawStageClear(); return;
        }

        this.world.tick();

        if (this.world.env) {
            if (this.world.env.state === 'gameover') {
                this.gameState = 'gameover';
            } else if (this.world.env.state === 'victory') {
                this.gameState = 'stageclear';
            }
        }
    }

    run() {
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.tick();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    stop() { this.running = false; }

    destroy() {
        this.stop();
        if (this.cleanupFn) this.cleanupFn();
    }

    // ==================== UI 绘制方法 ====================
    _drawTitle() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#FF4500';
        ctx.font = `bold ${32 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('BATTLE CITY', W / 2, H * 0.3);

        ctx.fillStyle = '#FFD700';
        ctx.font = `${16 * s}px monospace`;
        ctx.fillText('Natural Order ECS', W / 2, H * 0.3 + 30 * s);

        this._drawTitleTank(ctx, W / 2, H * 0.5, s);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${10 * s}px monospace`;
        ctx.fillText('WASD / Arrow Keys: Move', W / 2, H * 0.7);
        ctx.fillText('Space / J: Shoot', W / 2, H * 0.7 + 16 * s);

        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.fillText('PRESS ENTER TO START', W / 2, H * 0.85);
        }
        ctx.textAlign = 'left';
    }

    _drawTitleTank(ctx, cx, cy, s) {
        ctx.save();
        ctx.translate(cx, cy);
        const size = 20 * s;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(-size / 2, -size / 2, size * 0.25, size);
        ctx.fillRect(size / 2 - size * 0.25, -size / 2, size * 0.25, size);
        ctx.fillStyle = '#DAA520';
        const turretSize = size * 0.4;
        ctx.fillRect(-turretSize / 2, -turretSize / 2, turretSize, turretSize);
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(-size * 0.07, -size / 2 - 4, size * 0.15, size / 2 + 4);
        ctx.restore();
    }

    _drawGameOver() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#FF0000';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H * 0.4);

        const score = this.world?.env?.playerScore ?? 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${14 * s}px monospace`;
        ctx.fillText(`SCORE: ${score}`, W / 2, H * 0.55);

        ctx.fillStyle = '#FFD700';
        ctx.font = `${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.fillText('PRESS ENTER TO RESTART', W / 2, H * 0.7);
        }
        ctx.textAlign = 'left';
    }

    _drawStageClear() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#00FF00';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR!', W / 2, H * 0.4);

        const level = this.world?.env?.level ?? this.currentLevel + 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${14 * s}px monospace`;
        ctx.fillText(`STAGE ${level} COMPLETE`, W / 2, H * 0.55);

        ctx.fillStyle = '#FFD700';
        ctx.font = `${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.fillText('PRESS ENTER FOR NEXT STAGE', W / 2, H * 0.7);
        }
        ctx.textAlign = 'left';
    }

    handleKeyPress(code) {
        if (code === 'Enter') {
            if (this.gameState === 'title') {
                this.startLevel(0);
            } else if (this.gameState === 'gameover') {
                this.startLevel(0);
            } else if (this.gameState === 'stageclear') {
                const nextLevel = this.world?.env?.level ?? this.currentLevel + 1;
                this.startLevel(nextLevel);
            }
        }
        if (code === 'KeyL') {
            if (window.__playerMonitor) {
                window.__playerMonitor.printStatus(this.world);
                window.__playerMonitor.exportLog();
            }
        }
    }
}

// =============================================================================
// 模块级函数：敌人生成（由 SpawnTimer.onSpawn 调用）
// =============================================================================

function _spawnEnemy(world, env, st) {
    const maxEnemies = env.maxEnemies;

    // 检查是否已达到本关最大敌人数
    if (env.enemiesSpawned >= maxEnemies) {
        // 所有敌人都已生成完毕，移除 SpawnTimer（不再循环）
        // 但需要找到 spawner 实体 ID
        for (const spawnerId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
            world.removeComponent(spawnerId, COMP.SPAWN_TIMER);
        }
        return;
    }

    const spawns = env.config.spawn.ENEMY;
    const spawnIdx = env.enemiesSpawned % spawns.length;
    const spawn = spawns[spawnIdx];
    const enemyId = world.createEntity();

    const colorKeys = ['enemy1', 'enemy2', 'enemy3', 'enemy4'];
    const colorKey = colorKeys[env.enemiesSpawned % colorKeys.length];

    const enemyShootCd = env.config.combat.ENEMY_SHOOT_CD;
    const enemyProtectFrames = env.config.combat.SPAWN_PROTECT_ENEMY;
    const killScore = env.config.combat.KILL_SCORE;

    world.addComponent(enemyId, COMP.POSITION, Components.createPosition(spawn.x, spawn.y));
    world.addComponent(enemyId, COMP.DIRECTION, Components.createDirection(2));
    world.addComponent(enemyId, COMP.VELOCITY, Components.createVelocity());
    world.addComponent(enemyId, COMP.COLLISION, Components.createCollision(7, 7));
    world.addComponent(enemyId, COMP.TANK_TYPE, Components.createTankType('enemy', colorKey));
    world.addComponent(enemyId, COMP.HP, Components.createHP(1));
    world.addComponent(enemyId, COMP.SHOOT_COOLDOWN, Components.createShootCooldown(0, enemyShootCd));
    world.addComponent(enemyId, COMP.AI_CTRL, Components.createAIController('patrol'));
    world.addComponent(enemyId, COMP.RENDER, Components.createRender('tank', colorKey, 1));
    world.addComponent(enemyId, COMP.SPAWN_PROTECT, Components.createSpawnProtect(enemyProtectFrames));
    // ★ 声明式组件：击杀此实体给予击杀者 killScore 分
    world.addComponent(enemyId, COMP.KILL_REWARD, Components.createKillReward(killScore));

    env.enemiesSpawned++;
    st.activeCount++;
    env.enemyCount = (env.enemyCount || 0) + 1;
}
