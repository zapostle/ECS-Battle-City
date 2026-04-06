// =============================================================================
// 游戏主模块 - Natural Order ECS 坦克大战
// 作为程序入口，负责：
//   1. 初始化 Canvas 画布和渲染上下文
//   2. 创建并配置 ECS World（实体容器）
//   3. 注册所有游戏系统（按执行顺序）
//   4. 运行游戏主循环（requestAnimationFrame）
//   5. 管理游戏状态转换（标题/游戏中/通关/游戏结束）
// =============================================================================

import { World } from '../ecs/World.js';
import { COMP, MAP_W, MAP_H, TILE_SIZE } from './Constants.js';
import { PLAYER_SPAWNS, LEVELS } from './Levels.js';
import * as Components from './Components.js';
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
        this.ctx = canvas.getContext('2d');  // 获取 D 渲染上下文
        this.scale = 2;                      // 渲染缩放倍数（2x像素化风格）

        // 设置 Canvas 实际像素尺寸
        canvas.width = MAP_W * TILE_SIZE * this.scale;   // 832px
        canvas.height = MAP_H * TILE_SIZE * this.scale;   // 832px

        // 初始化键盘输入状态管理
        this.keyState = createKeyState();
        this.cleanupFn = setupKeyListeners(this.keyState);  // 返回清理函数用于卸载

        this.currentLevel = 0;     // 当前关卡索引
        this.running = false;      // 游戏运行标志
        // 游戏状态: title(标题画面) | playing(游戏中) | gameover(游戏结束) | victory(胜利) | stageclear(过关)
        this.gameState = 'title';
    }

    // 开始指定关卡（重置整个ECS世界）
    startLevel(levelIdx = 0) {
        this.currentLevel = levelIdx;
        this._setupWorld();         // 重新创建 World 和所有实体
        this.gameState = 'playing'; // 切换到游戏进行中状态
    }

    // ====== 内部方法：初始化 ECS 世界 ======
    _setupWorld() {
        // 创建新的 ECS World 容器
        this.world = new World();

        // ==================== 注册所有游戏系统（按执行顺序）====================
        this.world.addSystem(createInputSystem(this.keyState), 'InputSystem');    // 1. 输入系统 - 捕获键盘
        this.world.addSystem(AISystem, 'AISystem');                               // 2. AI系统 - 敌人决策
        this.world.addSystem(MovementSystem, 'MovementSystem');                   // 3. 移动系统 - 应用位移
        this.world.addSystem(ShootSystem, 'ShootSystem');                         // 4. 射击系统 - 子弹生成与移动
        this.world.addSystem(CollisionSystem, 'CollisionSystem');                 // 5. 碰撞系统 - 碰撞检测
        this.world.addSystem(DamageSystem, 'DamageSystem');                       // 6. 伤害系统 - 处理伤害事件
        this.world.addSystem(StageSystem, 'StageSystem');                         // 7. 关卡系统 - 生成/清理
        this.world.addSystem(createRenderSystem(this.ctx, this.scale), 'RenderSystem'); // 8. 渲染系统 - 绘制画面

        // 加载当前关卡的地图数据（深拷贝避免修改原始数据）
        const levelData = LEVELS[this.currentLevel % LEVELS.length];
        const mapData = levelData.map(row => [...row]);

        // ---- 创建舞台/全局实体 (entityId = 1) ----
        // 存储关卡状态、玩家数据等全局信息
        this.world.addComponent(1, COMP.STAGE, {
            level: this.currentLevel + 1,
            state: 'playing',
            enemyCount: 0,
            enemiesSpawned: 0,
            maxEnemies: 20,       // 每关最多生成20个敌人
            spawnTimer: 60,       // 首次敌人生成倒计时
            mapData
        });
        // 玩家持久数据（跨复活保留）：生命数、总分数等
        this.world.addComponent(1, COMP.PLAYER_DATA, {
            lives: 3,             // 初始生命数
            score: 0,
            spawnIdx: 0,
            respawnTimer: 0       // 复活倒计时
        });

        // ---- 创建玩家坦克实体 (entityId = 2) ----
        const spawn = PLAYER_SPAWNS[0];
        this.world.addComponent(2, COMP.POSITION, Components.createPosition(spawn.x, spawn.y));      // 位置
        this.world.addComponent(2, COMP.DIRECTION, Components.createDirection(0));                    // 方向：默认向上
        this.world.addComponent(2, COMP.VELOCITY, Components.createVelocity());                      // 速度
        this.world.addComponent(2, COMP.COLLISION, Components.createCollision(7, 7));                // 碰撞体
        this.world.addComponent(2, COMP.TANK_TYPE, Components.createTankType('player', 'player'));   // 坦克类型
        this.world.addComponent(2, COMP.HP, Components.createHP(1));                                // HP：1血即死
        this.world.addComponent(2, COMP.SHOOT_COOLDOWN, Components.createShootCooldown(0, 20));      // 射击冷却20帧
        this.world.addComponent(2, COMP.PLAYER_INPUT, Components.createPlayerInput());               // 输入接收器
        this.world.addComponent(2, COMP.RENDER, Components.createRender('tank', 'player', 1));       // 渲染信息
        this.world.addComponent(2, COMP.SPAWN_PROTECT, Components.createSpawnProtect(120));          // 出生保护2秒
        this.world.addComponent(2, COMP.SCORE, Components.createScore());                            // 分数记录
    }

    // ====== 每帧更新（游戏循环核心）======
    tick() {
        // 根据游戏状态分发到不同的绘制逻辑
        if (this.gameState === 'title') {
            this._drawTitle();
            return;
        }
        if (this.gameState === 'gameover') {
            this._drawGameOver();
            return;
        }
        if (this.gameState === 'stageclear') {
            this._drawStageClear();
            return;
        }

        // 正常游戏状态：执行 ECS 世界的一帧更新
        this.world.tick();

        // 检查关卡系统的状态变化，同步到游戏层面
        const stage = this.world.getComponent(1, COMP.STAGE);
        if (stage) {
            if (stage.state === 'gameover') {
                this.gameState = 'gameover';           // 基地被毁或玩家无命 → 游戏结束
            } else if (stage.state === 'victory') {
                this.gameState = 'stageclear';         // 所有敌人被消灭 → 过关
            }
        }
    }

    // 启动游戏主循环（使用 requestAnimationFrame 实现60FPS）
    run() {
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.tick();                    // 执行一帧
            requestAnimationFrame(loop);    // 请求下一帧
        };
        requestAnimationFrame(loop);
    }

    // 停止游戏循环
    stop() {
        this.running = false;
    }

    // 销毁游戏实例，清理事件监听
    destroy() {
        this.stop();
        if (this.cleanupFn) this.cleanupFn();
    }

    // ==================== UI 绘制方法 ====================

    // 绘制标题画面
    _drawTitle() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        // 清屏为黑色
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // 标题文字 "BATTLE CITY"
        ctx.fillStyle = '#FF4500';  // 橙红色
        ctx.font = `bold ${32 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('BATTLE CITY', W / 2, H * 0.3);

        // 副标题 - 显示架构名称
        ctx.fillStyle = '#FFD700';  // 金色
        ctx.font = `${16 * s}px monospace`;
        ctx.fillText('Natural Order ECS', W / 2, H * 0.3 + 30 * s);

        // 绘制装饰性坦克图标
        this._drawTitleTank(ctx, W / 2, H * 0.5, s);

        // 操作说明
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${10 * s}px monospace`;
        ctx.fillText('WASD / Arrow Keys: Move', W / 2, H * 0.7);
        ctx.fillText('Space / J: Shoot', W / 2, H * 0.7 + 16 * s);

        // 闪烁的"按回车开始"提示
        ctx.fillStyle = '#FFD700';
        ctx.font = `bold ${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;  // 500ms闪烁周期
        if (blink) {
            ctx.fillText('PRESS ENTER TO START', W / 2, H * 0.85);
        }
        ctx.textAlign = 'left';
    }

    // 在标题画面上绘制装饰性坦克图标
    _drawTitleTank(ctx, cx, cy, s) {
        ctx.save();
        ctx.translate(cx, cy);
        const size = 20 * s;
        // 坦克主体
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-size / 2, -size / 2, size, size);
        // 履带
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(-size / 2, -size / 2, size * 0.25, size);
        ctx.fillRect(size / 2 - size * 0.25, -size / 2, size * 0.25, size);
        // 炮塔
        ctx.fillStyle = '#DAA520';
        const turretSize = size * 0.4;
        ctx.fillRect(-turretSize / 2, -turretSize / 2, turretSize, turretSize);
        // 炮管
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(-size * 0.07, -size / 2 - 4, size * 0.15, size / 2 + 4);
        ctx.restore();
    }

    // 绘制游戏结束画面
    _drawGameOver() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // "GAME OVER" 红色大字
        ctx.fillStyle = '#FF0000';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H * 0.4);

        // 显示最终得分
        const score = this.world.getComponent(2, COMP.SCORE);
        if (score) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${14 * s}px monospace`;
            ctx.fillText(`SCORE: ${score.value}`, W / 2, H * 0.55);
        }

        // 闪烁的重启提示
        ctx.fillStyle = '#FFD700';
        ctx.font = `${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.fillText('PRESS ENTER TO RESTART', W / 2, H * 0.7);
        }
        ctx.textAlign = 'left';
    }

    // 绘制过关画面
    _drawStageClear() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // "STAGE CLEAR!" 绿色大字
        ctx.fillStyle = '#00FF00';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR!', W / 2, H * 0.4);

        // 显示完成关卡数
        const stage = this.world.getComponent(1, COMP.STAGE);
        if (stage) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${14 * s}px monospace`;
            ctx.fillText(`STAGE ${stage.level} COMPLETE`, W / 2, H * 0.55);
        }

        // 闪烁的"按回车进入下一关"提示
        ctx.fillStyle = '#FFD700';
        ctx.font = `${12 * s}px monospace`;
        const blink = Math.floor(Date.now() / 500) % 2;
        if (blink) {
            ctx.fillText('PRESS ENTER FOR NEXT STAGE', W / 2, H * 0.7);
        }
        ctx.textAlign = 'left';
    }

    // 处理键盘按键事件（主要用于 Enter 键的状态切换）
    handleKeyPress(code) {
        if (code === 'Enter') {
            if (this.gameState === 'title') {
                this.startLevel(0);              // 从标题进入第1关
            } else if (this.gameState === 'gameover') {
                this.startLevel(0);              // 从游戏结束重新开始
            } else if (this.gameState === 'stageclear') {
                const stage = this.world.getComponent(1, COMP.STAGE);
                const nextLevel = stage ? stage.level : this.currentLevel + 1;
                this.startLevel(nextLevel);      // 进入下一关
            }
        }
    }
}
