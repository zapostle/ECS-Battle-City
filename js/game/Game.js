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
import { CollisionSystem } from './systems/CollisionSystem.js';
import { ShootSystem } from './systems/ShootSystem.js';
import { DamageSystem } from './systems/DamageSystem.js';
import { createRenderSystem } from './systems/RenderSystem.js';
import { StageSystem } from './systems/StageSystem.js';

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
        // 将 GameConfig 配置表注入 Environment（只读全局数据源）
        this.world = new World(GameConfig);
        const env = this.world.env;

        // ==================== 初始化环境运行时状态 ====================
        const levelData = LEVELS[this.currentLevel % LEVELS.length];
        const mapData = levelData.map(row => [...row]);  // 深拷贝地图数据

        env.reset(this.currentLevel + 1, mapData);       // 设置关卡和地图
        env.playerLives = 3;                              // 初始生命数
        env.maxEnemies = env.config.combat.MAX_ENEMIES_PER_STAGE;
        env.spawnTimer = env.config.combat.FIRST_SPAWN_DELAY;

        // ==================== 注册所有游戏系统（按执行顺序）====================
        this.world.addSystem(createInputSystem(this.keyState), 'InputSystem');
        this.world.addSystem(AISystem, 'AISystem');
        this.world.addSystem(MovementSystem, 'MovementSystem');
        this.world.addSystem(ShootSystem, 'ShootSystem');
        this.world.addSystem(CollisionSystem, 'CollisionSystem');
        this.world.addSystem(DamageSystem, 'DamageSystem');
        this.world.addSystem(StageSystem, 'StageSystem');
        this.world.addSystem(createRenderSystem(this.ctx, this.scale), 'RenderSystem');

        // ---- 创建玩家坦克实体（不再需要舞台单例实体！）----
        this.playerEntityId = this.world.createEntity();
        const spawn = env.config.spawn.PLAYER[0];
        this.world.addComponent(this.playerEntityId, COMP.POSITION, Components.createPosition(spawn.x, spawn.y));
        this.world.addComponent(this.playerEntityId, COMP.DIRECTION, Components.createDirection(0));
        this.world.addComponent(this.playerEntityId, COMP.VELOCITY, Components.createVelocity());
        this.world.addComponent(this.playerEntityId, COMP.COLLISION, Components.createCollision(7, 7));
        this.world.addComponent(this.playerEntityId, COMP.TANK_TYPE, Components.createTankType('player', 'player'));
        this.world.addComponent(this.playerEntityId, COMP.HP, Components.createHP(env.config.combat.PLAYER_HP));
        this.world.addComponent(this.playerEntityId, COMP.SHOOT_COOLDOWN,
            Components.createShootCooldown(0, env.config.combat.PLAYER_SHOOT_CD));
        this.world.addComponent(this.playerEntityId, COMP.PLAYER_INPUT, Components.createPlayerInput());
        this.world.addComponent(this.playerEntityId, COMP.RENDER, Components.createRender('tank', 'player', 1));
        this.world.addComponent(this.playerEntityId, COMP.SPAWN_PROTECT,
            Components.createSpawnProtect(env.config.combat.SPAWN_PROTECT_PLAYER));
        this.world.addComponent(this.playerEntityId, COMP.SCORE, Components.createScore());

        // 启动玩家监控器
        const playerMonitor = new EntityMonitor(this.playerEntityId, '玩家坦克');
        playerMonitor.ignore('SpawnProtect');
        this.world.registerMonitor(playerMonitor);
        playerMonitor.start();
        window.__playerMonitor = playerMonitor;
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

        // ★ 从环境读取状态变化（不再查询 stage 实体组件）
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
    // （保持不变，与之前一致）
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

        // ★ 从环境读取分数
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

        // ★ 从环境读取关卡数
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
