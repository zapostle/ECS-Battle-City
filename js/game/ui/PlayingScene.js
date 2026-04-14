// =============================================================================
// 游戏画面 - 从 RenderSystem 拆出，纯 UI 渲染逻辑
// 只从 WorldView 读取组件数据，不写入任何 ECS 组件
// 包含：地图渲染、实体渲染、HUD 状态栏
// =============================================================================

import { COMP } from '../Constants.js';

export class PlayingScene {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     */
    constructor(ctx, scale) {
        this.ctx = ctx;
        this.scale = scale;
    }

    /**
     * 渲染游戏画面
     * @param {import('../../ecs/WorldView.js').WorldView} view - 只读世界视图
     */
    render(view) {
        const ctx = this.ctx;
        const s = this.scale;
        const env = view.env;
        const world = view._world;  // 需要访问原始 world 进行迭代器遍历

        const TILE_SIZE = env.config.map.TILE_SIZE;
        const MAP_W = env.config.map.MAP_W;
        const MAP_H = env.config.map.MAP_H;
        const W = MAP_W * TILE_SIZE * s;
        const H = MAP_H * TILE_SIZE * s;
        const ts = TILE_SIZE * s;

        const TT = env.config.tile;
        const TANK_COLORS = env.config.colors;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // ==================== 1. 绘制地图瓦片 ====================
        if (env && env.mapData) {
            const mapData = env.mapData;
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    const tile = mapData[y][x];
                    if (tile === TT.EMPTY) continue;
                    drawTile(ctx, x * ts, y * ts, ts, tile, TT);
                }
            }
        }

        // ==================== 2. 收集所有可渲染实体 ====================
        const renderList = [];
        for (const entityId of view.getEntitiesWithAll(COMP.POSITION, COMP.RENDER)) {
            const pos = view.getComponent(entityId, COMP.POSITION);
            const render = view.getComponent(entityId, COMP.RENDER);
            if (!pos || !render) continue;

            renderList.push({
                entityId, pos, render,
                dir: view.getComponent(entityId, COMP.DIRECTION),
                tankType: view.getComponent(entityId, COMP.TANK_TYPE),
                explosion: view.getComponent(entityId, COMP.EXPLOSION),
                anim: view.getComponent(entityId, COMP.ANIMATION),
                spawnProtect: view.getComponent(entityId, COMP.SPAWN_PROTECT),
            });
        }

        renderList.sort((a, b) => (a.render.zIndex || 0) - (b.render.zIndex || 0));

        // ==================== 3. 预收集草地块位置 ====================
        const grassTiles = [];
        if (env && env.mapData) {
            const mapData = env.mapData;
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    if (mapData[y][x] === TT.GRASS) {
                        grassTiles.push({ x: x * ts, y: y * ts });
                    }
                }
            }
        }

        // ==================== 4. 绘制地面层实体 ====================
        for (const item of renderList) {
            if (item.render.type === 'tank') {
                drawTank(ctx, item, s, TANK_COLORS);
            } else if (item.render.type === 'bullet') {
                drawBullet(ctx, item.pos, item.dir, s);
            } else if (item.render.type === 'explosion') {
                drawExplosion(ctx, item.pos, item.explosion, s);
            }
        }

        // ==================== 5. 绘制草地层 ====================
        for (const gt of grassTiles) {
            drawTile(ctx, gt.x, gt.y, ts, TT.GRASS, TT);
        }

        // ==================== 6. 绘制 HUD 状态栏 ====================
        this._drawHUD(view, W, s);
    }

    /**
     * 绘制 HUD — 从 WorldView 查询数据，不依赖 env 的 UI 冗余字段
     */
    _drawHUD(view, canvasW, scale) {
        const ctx = this.ctx;
        const env = view.env;
        const s = scale;

        const MAP_H = env.config.map.MAP_H;
        const TILE_SIZE = env.config.map.TILE_SIZE;
        const barY = MAP_H * TILE_SIZE * s;

        // ★ 从 WorldView 查询玩家数据（替代 env.playerScore / env.playerLives）
        const playerId = view.findEntity(COMP.PLAYER_INPUT);
        const score = playerId ? view.getComponent(playerId, COMP.SCORE) : null;
        const lives = playerId ? view.getComponent(playerId, COMP.LIVES) : null;

        // ★ 从 WorldView 统计存活敌人数量（替代 env.enemyCount）
        const enemyCount = view.countAliveEntitiesWith(COMP.AI_CTRL);

        ctx.fillStyle = '#333333';
        ctx.fillRect(0, barY, canvasW, 2 * 16 * s);

        ctx.fillStyle = '#FF4500';
        ctx.fillRect(0, barY, canvasW, 2);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${12 * s}px monospace`;

        if (score) {
            ctx.fillText(`SCORE: ${String(score.value).padStart(6, '0')}`, 10 * s, barY + 14 * s);
        }

        if (lives && lives.lives > 0) {
            ctx.fillStyle = '#FFD700';
            ctx.fillText('P1', 10 * s, barY + 30 * s);
            for (let i = 0; i < lives.lives; i++) {
                ctx.fillRect((10 + 3 + i * 3) * s, barY + 22 * s, 2.5 * s, 2.5 * s);
            }
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`ENEMY: ${enemyCount}`, 200 * s, barY + 14 * s);
        ctx.fillText(`STAGE ${env.level}`, 200 * s, barY + 30 * s);
    }
}

// ====== 绘制单个地图瓦片 ======
function drawTile(ctx, x, y, size, tileType, TT) {
    switch (tileType) {
        case TT.BRICK:
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            const half = size / 2;
            ctx.strokeRect(x, y, half, half);
            ctx.strokeRect(x + half, y, half, half);
            ctx.strokeRect(x, y + half, half, half);
            ctx.strokeRect(x + half, y + half, half, half);
            ctx.beginPath();
            ctx.moveTo(x + half, y); ctx.lineTo(x + half, y + half);
            ctx.moveTo(x, y + half); ctx.lineTo(x + size, y + half);
            ctx.moveTo(x + half, y + half); ctx.lineTo(x + half, y + size);
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case TT.STEEL:
            ctx.fillStyle = '#A0A0A0';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
            ctx.fillStyle = '#808080';
            ctx.fillRect(x + size / 2 - 1, y, 2, size);
            ctx.fillRect(x, y + size / 2 - 1, size, 2);
            break;

        case TT.WATER:
            ctx.fillStyle = '#1a3a5c';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#2a5a8c';
            for (let i = 0; i < 3; i++) {
                const waveY = y + (size / 4) * i + 2;
                ctx.fillRect(x, waveY, size, 2);
            }
            break;

        case TT.GRASS:
            ctx.fillStyle = '#2d5a1e';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#3a7a28';
            for (let i = 0; i < 4; i++) {
                const gx = x + Math.floor(i * size / 4);
                ctx.fillRect(gx + 1, y, 2, size);
            }
            break;

        case TT.ICE:
            ctx.fillStyle = '#b0d4f1';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#d4eaf7';
            ctx.fillRect(x + 2, y + 2, size / 2 - 2, size / 2 - 2);
            ctx.fillRect(x + size / 2 + 1, y + size / 2 + 1, size / 2 - 3, size / 2 - 3);
            break;

        case TT.BASE:
            ctx.fillStyle = '#555555';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            ctx.fillStyle = '#FF8C00';
            ctx.fillRect(x + size * 0.35, y + size * 0.35, size * 0.3, size * 0.3);
            break;

        case TT.BASE_DEAD:
            ctx.fillStyle = '#555555';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#333333';
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            break;
    }
}

// ====== 绘制坦克 ======
function drawTank(ctx, item, scale, TANK_COLORS) {
    const { pos, dir, tankType, render, spawnProtect } = item;
    if (!dir || !tankType) return;

    const s = scale;
    const size = 14 * s;
    const x = pos.x * s - size / 2;
    const y = pos.y * s - size / 2;

    if (spawnProtect && spawnProtect.frames > 0) {
        const flash = Math.floor(spawnProtect.frames / 4) % 2;
        if (flash) {
            ctx.strokeStyle = '#00BFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x * s, pos.y * s, size / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    if (render.flash > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
        return;
    }

    const color = TANK_COLORS[tankType.colorKey] || TANK_COLORS.enemy1;

    ctx.save();
    ctx.translate(pos.x * s, pos.y * s);
    ctx.rotate(dir.dir * Math.PI / 2);

    const half = size / 2;

    ctx.fillStyle = color;
    ctx.fillRect(-half, -half, size, size);

    ctx.fillStyle = darkenColor(color, 0.5);
    ctx.fillRect(-half, -half, size * 0.25, size);
    ctx.fillRect(half - size * 0.25, -half, size * 0.25, size);

    ctx.fillStyle = darkenColor(color, 0.3);
    const trackW = size * 0.25;
    for (let i = 0; i < 3; i++) {
        const ty = -half + (size / 3) * i + size / 6 - 1;
        ctx.fillRect(-half, ty, trackW, 2);
        ctx.fillRect(half - trackW, ty, trackW, 2);
    }

    ctx.fillStyle = darkenColor(color, 0.8);
    const turretSize = size * 0.4;
    ctx.fillRect(-turretSize / 2, -turretSize / 2, turretSize, turretSize);

    ctx.fillStyle = darkenColor(color, 0.6);
    const barrelW = size * 0.15;
    const barrelH = half + 2;
    ctx.fillRect(-barrelW / 2, -barrelH, barrelW, barrelH);

    ctx.restore();
}

// ====== 绘制子弹 ======
function drawBullet(ctx, pos, dir, scale) {
    const s = scale;
    const size = 4 * s;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pos.x * s - size / 2, pos.y * s - size / 2, size, size);
    ctx.fillStyle = '#FFFF88';
    ctx.fillRect(pos.x * s - size / 4, pos.y * s - size / 4, size / 2, size / 2);
}

// ====== 绘制爆炸效果 ======
function drawExplosion(ctx, pos, explosion, scale) {
    const s = scale;
    const progress = explosion.timer / explosion.maxTimer;
    const maxRadius = (explosion.size === 2 ? 20 : 12) * s;

    if (progress < 0.3) {
        const r = maxRadius * (progress / 0.3);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
    } else if (progress < 0.6) {
        const r = maxRadius;
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const r = maxRadius * (1 - (progress - 0.6) / 0.4);
        ctx.fillStyle = '#FF4500';
        ctx.globalAlpha = 1 - (progress - 0.6) / 0.4;
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ====== 辅助函数：将颜色变暗 ======
function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}
