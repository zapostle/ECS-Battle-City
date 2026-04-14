// =============================================================================
// 游戏主模块 - Natural Order ECS 坦克大战
// 作为程序入口，负责：
//   1. 初始化 Canvas 画布和渲染上下文
//   2. 创建并配置 ECS World（实体容器 + 环境容器）
//   3. 注册所有游戏系统（按执行顺序）
//   4. 运行游戏主循环（requestAnimationFrame）
//   5. 管理游戏状态转换（标题/游戏中/通关/游戏结束）
//
// ★ "动态变量=组件"原则：
//   - 所有动态变化的值都在 ECS 组件中，env 只保留 config/providers
//   - GameState 组件：state + level + frameCount（替代 env.state/level/frameCount）
//   - GameMap 组件：地图数据（替代 env.mapData）
//   - SpawnTimer 组件：enemiesSpawned/maxEnemies（替代 env 同名字段）
//   - Score/Lives 组件：玩家分数/生命（替代 env.playerScore/playerLives）
//   - WorldView 提供只读查询接口，DataChannel 提供数据订阅
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

        canvas.width = MAP_W * TILE_SIZE * this.scale;
        canvas.height = CANVAS_TOTAL_H * this.scale;

        this.keyState = createKeyState();
        this.cleanupFn = setupKeyListeners(this.keyState);

        this.currentLevel = 0;
        this.running = false;
        this.gameState = 'title';  // 外部 UI 状态: 'title' | 'playing' | 'gameover' | 'victory'

        this.uiRenderer = new UIRenderer(this.ctx, this.scale);
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

        // ==================== ★ 创建 GameState 单例实体 ====================
        const levelNum = this.currentLevel + 1;
        const stateEntityId = this.world.createEntity();
        this.world.addComponent(stateEntityId, COMP.GAME_STATE, Components.createGameState('playing', levelNum));

        // ==================== ★ 创建 GameMap 单例实体 ====================
        const levelData = LEVELS[this.currentLevel % LEVELS.length];
        const mapData = levelData.map(row => [...row]);  // 深拷贝地图数据
        const mapEntityId = this.world.createEntity();
        this.world.addComponent(mapEntityId, COMP.GAME_MAP, Components.createGameMap(mapData));

        // ==================== 注册所有游戏系统（按执行顺序）====================
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
        const maxEnemies = env.config.combat.MAX_ENEMIES_PER_STAGE;
        const spawnInterval = env.config.combat.ENEMY_SPAWN_INTERVAL;
        const firstSpawnDelay = env.config.combat.FIRST_SPAWN_DELAY;
        const maxOnScreen = env.config.combat.MAX_ENEMIES_ON_SCREEN;

        const spawnerId = this.world.createEntity();
        this.world.addComponent(spawnerId, COMP.SPAWN_TIMER, Components.createSpawnTimer({
            timer: firstSpawnDelay,
            interval: spawnInterval,
            repeat: true,
            maxActive: maxOnScreen,
            activeCount: 0,
            onSpawn: (world, env, st) => {
                _spawnEnemy(world, env, st);
            },
            enemiesSpawned: 0,     // ★ 从 env 迁移到组件
            maxEnemies: maxEnemies, // ★ 从 env 迁移到组件
        }));

        // ==================== ★ 初始化 WorldView + DataChannel ====================
        this.worldView = new WorldView(this.world);
        this.dataChannel = new DataChannel(this.worldView);

        this.dataChannel.subscribe('gameState',
            (view) => view.getGameState(),
            (newState, oldState) => {
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
        const gameRef = this;
        world.addComponent(playerId, COMP.LIVES, Components.createLives(playerLives));
        world.getComponent(playerId, COMP.LIVES).respawnTemplate = (world, env, entityId) => {
            gameRef._initPlayerComponents(world, entityId, env);
        };
        world.addComponent(playerId, COMP.KILL_REWARD, Components.createKillReward(0));
    }

    tick() {
        if (this.gameState === 'title') {
            this.uiRenderer.render(null, 'title');
            return;
        }

        // ==================== ECS 逻辑 tick ====================
        this.world.tick();

        // ★ 同步帧计数到 GameState 组件（替代 env.frameCount 递增）
        const gameStateId = this.world.findEntity(COMP.GAME_STATE);
        const gameState = gameStateId ? this.world.getComponent(gameStateId, COMP.GAME_STATE) : null;
        if (gameState) gameState.frameCount = this.world.env.frameCount;

        // ==================== DataChannel 脏检测 ====================
        if (this.dataChannel) {
            this.dataChannel.tick();
        }

        // ==================== UI 渲染 ====================
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
                // ★ 从 GameState 组件读取关卡号（替代 env.level）
                const nextLevel = this.worldView?.getLevel() ?? this.currentLevel + 1;
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
// ★ enemiesSpawned 计数从 SpawnTimer 组件维护（替代 env.enemiesSpawned++）
// ★ maxEnemies 达到上限由 SpawnSystem 自动处理
// =============================================================================

function _spawnEnemy(world, env, st) {
    const spawns = env.config.spawn.ENEMY;
    const spawnIdx = st.enemiesSpawned % spawns.length;
    const spawn = spawns[spawnIdx];
    const enemyId = world.createEntity();

    const colorKeys = ['enemy1', 'enemy2', 'enemy3', 'enemy4'];
    const colorKey = colorKeys[st.enemiesSpawned % colorKeys.length];

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

    st.enemiesSpawned++;  // ★ 组件内维护，替代 env.enemiesSpawned++
    st.activeCount++;
}
