// =============================================================================
// 游戏主模块 - Natural Order ECS 坦克大战
// 作为程序入口，负责：
//   1. 初始化 Canvas 画布和渲染上下文
//   2. 创建并配置 ECS World（实体容器 + 环境容器）
//   3. 注册所有游戏系统（按执行顺序）
//   4. 运行游戏主循环（requestAnimationFrame）
//   5. 管理游戏状态转换（标题/游戏中/通关/游戏结束）
//
// ★ UI-ECS 解耦设计：
//   - ECS 系统（world.tick）只写组件，不知道 UI 存在
//   - UI 渲染（uiRenderer.render）只读组件，不知道系统存在
//   - WorldView 提供只读查询接口，DataChannel 提供数据订阅
//   - 游戏状态存储在 GameState 单例组件中，UI 直接查询
// =============================================================================

import { World } from '../ecs/World.js';
import { WorldView } from '../ecs/WorldView.js';
import { DataChannel } from '../ecs/DataChannel.js';
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
import { UIRenderer } from './ui/UIRenderer.js';

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
        this.gameState = 'title';  // 外部 UI 状态: 'title' | 'playing' | 'gameover' | 'victory'

        // ★ UI 渲染器（与 ECS 完全解耦，通过 WorldView 只读查询）
        this.uiRenderer = new UIRenderer(this.ctx, this.scale);

        // ★ 只读世界视图 + 数据订阅通道
        this.worldView = null;
        this.dataChannel = null;
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

        // ==================== ★ 创建 GameState 单例实体 ====================
        // 游戏状态存储在 ECS 组件中，UI 层通过 WorldView 查询
        const stateEntityId = this.world.createEntity();
        this.world.addComponent(stateEntityId, COMP.GAME_STATE, Components.createGameState('playing'));

        // ==================== 注册所有游戏系统（按执行顺序）====================
        // ★ 不再包含 RenderSystem — 渲染由 UIRenderer 在 tick 外独立处理
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

        // ==================== 创建玩家坦克实体 ====================
        const playerId = this.world.createEntity();
        this._initPlayerComponents(this.world, playerId, env);

        // 启动玩家监控器
        const playerMonitor = new EntityMonitor(playerId, '玩家坦克');
        playerMonitor.ignore('SpawnProtect');
        this.world.registerMonitor(playerMonitor);
        playerMonitor.start();
        window.__playerMonitor = playerMonitor;

        // ==================== 创建敌人生成器实体 ====================
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

        env.maxEnemies = maxEnemies;
        env.enemiesSpawned = 0;

        // ==================== ★ 初始化 WorldView + DataChannel ====================
        this.worldView = new WorldView(this.world);
        this.dataChannel = new DataChannel(this.worldView);

        // 订阅游戏状态变化（从 GameState 组件读取）
        this.dataChannel.subscribe('gameState',
            (view) => view.getGameState(),
            (newState, oldState) => {
                // 同步外部 UI 状态
                if (newState === 'gameover') this.gameState = 'gameover';
                else if (newState === 'victory') this.gameState = 'victory';
                else if (newState === 'playing') this.gameState = 'playing';
            }
        );
    }

    /** 初始化/重建玩家的完整组件套件 */
    _initPlayerComponents(world, playerId, env) {
        const spawn = env.config.spawn.PLAYER[0];
        const playerShootCd = env.config.combat.PLAYER_SHOOT_CD;
        const playerProtectFrames = env.config.combat.SPAWN_PROTECT_PLAYER;
        const playerLives = env.config.combat.PLAYER_LIVES ?? 3;

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
        // ★ 声明式组件：告知系统"此实体有N条命"和"复活后如何重建"
        const gameRef = this;
        world.addComponent(playerId, COMP.LIVES, Components.createLives(playerLives));
        world.getComponent(playerId, COMP.LIVES).respawnTemplate = (world, env, entityId) => {
            gameRef._initPlayerComponents(world, entityId, env);
        };
        world.addComponent(playerId, COMP.KILL_REWARD, Components.createKillReward(0));
    }

    tick() {
        if (this.gameState === 'title') {
            // 标题画面：尚无 World，直接渲染
            this.uiRenderer.render(null, 'title');
            return;
        }

        // ==================== ECS 逻辑 tick（系统只写组件）====================
        this.world.tick();

        // ==================== DataChannel 脏检测（检测组件变化）====================
        if (this.dataChannel) {
            this.dataChannel.tick();
        }

        // ==================== UI 渲染（通过 WorldView 只读查询）====================
        if (this.worldView) {
            this.uiRenderer.render(this.worldView);
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

    handleKeyPress(code) {
        if (code === 'Enter') {
            if (this.gameState === 'title') {
                this.startLevel(0);
            } else if (this.gameState === 'gameover') {
                this.startLevel(0);
            } else if (this.gameState === 'victory') {
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

    if (env.enemiesSpawned >= maxEnemies) {
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
    world.addComponent(enemyId, COMP.KILL_REWARD, Components.createKillReward(killScore));

    env.enemiesSpawned++;
    st.activeCount++;
}
