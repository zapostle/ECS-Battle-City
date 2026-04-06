// Main Game Module - Natural Order ECS Battle City
// Entry point that wires up ECS world, systems, and game loop

import { World } from '../ecs/World.js';
import { COMP, PLAYER_SPAWNS, LEVELS, MAP_W, MAP_H, TILE_SIZE } from './Constants.js';
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
        this.ctx = canvas.getContext('2d');
        this.scale = 2;

        canvas.width = MAP_W * TILE_SIZE * this.scale;
        canvas.height = MAP_H * TILE_SIZE * this.scale;

        this.world = new World();
        this.keyState = createKeyState();
        this.cleanupFn = setupKeyListeners(this.keyState);

        this.currentLevel = 0;
        this.running = false;
        this.gameState = 'title'; // title, playing, gameover, victory, stageclear

        this._init();
    }

    _init() {
        // Setup systems (order groups related functionality but doesn't affect correctness)
        this.world.addSystem(createInputSystem(this.keyState), 'InputSystem');
        this.world.addSystem(AISystem, 'AISystem');
        this.world.addSystem(MovementSystem, 'MovementSystem');
        this.world.addSystem(ShootSystem, 'ShootSystem');
        this.world.addSystem(CollisionSystem, 'CollisionSystem');
        this.world.addSystem(DamageSystem, 'DamageSystem');
        this.world.addSystem(StageSystem, 'StageSystem');
        this.world.addSystem(createRenderSystem(this.ctx, this.scale), 'RenderSystem');

        // Entity 1 = Stage/Manager entity (holds game state)
        this.world.addComponent(1, COMP.STAGE, Components.createStage(1));
        this.world.addComponent(1, COMP.PLAYER_DATA, {
            lives: 3,
            score: 0,
            spawnIdx: 0,
            respawnTimer: 0
        });
    }

    startLevel(levelIdx = 0) {
        this.currentLevel = levelIdx;
        this._resetWorld();
        this.gameState = 'playing';
    }

    _resetWorld() {
        // Create new world to clear everything
        this.world = new World();

        // Re-add systems
        this.world.addSystem(createInputSystem(this.keyState), 'InputSystem');
        this.world.addSystem(AISystem, 'AISystem');
        this.world.addSystem(MovementSystem, 'MovementSystem');
        this.world.addSystem(ShootSystem, 'ShootSystem');
        this.world.addSystem(CollisionSystem, 'CollisionSystem');
        this.world.addSystem(DamageSystem, 'DamageSystem');
        this.world.addSystem(StageSystem, 'StageSystem');
        this.world.addSystem(createRenderSystem(this.ctx, this.scale), 'RenderSystem');

        // Load level map
        const levelData = LEVELS[this.currentLevel % LEVELS.length];
        // Deep copy the map so we can modify tiles
        const mapData = levelData.map(row => [...row]);

        // Stage entity (id=1)
        this.world.addComponent(1, COMP.STAGE, {
            level: this.currentLevel + 1,
            state: 'playing',
            enemyCount: 0,
            enemiesSpawned: 0,
            maxEnemies: 20,
            spawnTimer: 60,
            mapData
        });
        this.world.addComponent(1, COMP.PLAYER_DATA, {
            lives: 3,
            score: 0,
            spawnIdx: 0,
            respawnTimer: 0
        });

        // Player entity (id=2)
        const spawn = PLAYER_SPAWNS[0];
        this.world.addComponent(2, COMP.POSITION, Components.createPosition(spawn.x, spawn.y));
        this.world.addComponent(2, COMP.DIRECTION, Components.createDirection(0));
        this.world.addComponent(2, COMP.VELOCITY, Components.createVelocity());
        this.world.addComponent(2, COMP.COLLISION, Components.createCollision(7, 7));
        this.world.addComponent(2, COMP.TANK_TYPE, Components.createTankType('player', 'player'));
        this.world.addComponent(2, COMP.HP, Components.createHP(1));
        this.world.addComponent(2, COMP.SHOOT_COOLDOWN, Components.createShootCooldown(0, 20));
        this.world.addComponent(2, COMP.PLAYER_INPUT, Components.createPlayerInput());
        this.world.addComponent(2, COMP.RENDER, Components.createRender('tank', 'player', 1));
        this.world.addComponent(2, COMP.SPAWN_PROTECT, Components.createSpawnProtect(120));
        this.world.addComponent(2, COMP.SCORE, Components.createScore());
    }

    tick() {
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

        this.world.tick();

        // Check game state transitions
        const stage = this.world.getComponent(1, COMP.STAGE);
        if (stage) {
            if (stage.state === 'gameover') {
                this.gameState = 'gameover';
            } else if (stage.state === 'victory') {
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

    stop() {
        this.running = false;
    }

    destroy() {
        this.stop();
        if (this.cleanupFn) this.cleanupFn();
    }

    _drawTitle() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const s = this.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // Title
        ctx.fillStyle = '#FF4500';
        ctx.font = `bold ${32 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('BATTLE CITY', W / 2, H * 0.3);

        ctx.fillStyle = '#FFD700';
        ctx.font = `${16 * s}px monospace`;
        ctx.fillText('Natural Order ECS', W / 2, H * 0.3 + 30 * s);

        // Draw a tank icon
        this._drawTitleTank(ctx, W / 2, H * 0.5, s);

        // Instructions
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

        const score = this.world.getComponent(2, COMP.SCORE);
        if (score) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${14 * s}px monospace`;
            ctx.fillText(`SCORE: ${score.value}`, W / 2, H * 0.55);
        }

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

        const stage = this.world.getComponent(1, COMP.STAGE);
        if (stage) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${14 * s}px monospace`;
            ctx.fillText(`STAGE ${stage.level} COMPLETE`, W / 2, H * 0.55);
        }

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
                const stage = this.world.getComponent(1, COMP.STAGE);
                const nextLevel = stage ? stage.level : this.currentLevel + 1;
                this.startLevel(nextLevel);
            }
        }
    }
}
