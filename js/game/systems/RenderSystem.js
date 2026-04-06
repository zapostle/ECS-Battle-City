// Render System: Draws all game entities on the Canvas
// Natural ordering: Reads all Position + Render components, outputs to screen

import { COMP, TILE_SIZE, MAP_W, MAP_H, DIR, DIR_VEC, TANK_COLORS, TILE_EMPTY, TILE_BRICK, TILE_STEEL, TILE_WATER, TILE_GRASS, TILE_ICE, TILE_BASE, TILE_BASE_DEAD } from '../Constants.js';

export function createRenderSystem(ctx, scale = 2) {
    return function RenderSystem(world) {
        const W = MAP_W * TILE_SIZE * scale;
        const H = MAP_H * TILE_SIZE * scale;
        const ts = TILE_SIZE * scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        // === Draw Map Tiles ===
        const stageComp = world.getComponent(1, COMP.STAGE);
        if (stageComp && stageComp.mapData) {
            const mapData = stageComp.mapData;
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    const tile = mapData[y][x];
                    if (tile === TILE_EMPTY) continue;
                    drawTile(ctx, x * ts, y * ts, ts, tile);
                }
            }
        }

        // === Draw Grass layer (above tanks) ===
        // Grass is drawn after tanks for FC authenticity

        // === Collect all renderable entities ===
        const renderList = [];
        for (const entityId of world.getEntitiesWithAll(COMP.POSITION, COMP.RENDER)) {
            const pos = world.getComponent(entityId, COMP.POSITION);
            const render = world.getComponent(entityId, COMP.RENDER);
            if (!pos || !render) continue;

            renderList.push({
                entityId, pos, render,
                dir: world.getComponent(entityId, COMP.DIRECTION),
                tankType: world.getComponent(entityId, COMP.TANK_TYPE),
                explosion: world.getComponent(entityId, COMP.EXPLOSION),
                anim: world.getComponent(entityId, COMP.ANIMATION),
                spawnProtect: world.getComponent(entityId, COMP.SPAWN_PROTECT),
            });
        }

        // Sort by zIndex (ground layer first)
        renderList.sort((a, b) => (a.render.zIndex || 0) - (b.render.zIndex || 0));

        // Draw non-grass items, then grass, then grass-overlay items
        const grassTiles = [];
        if (stageComp && stageComp.mapData) {
            const mapData = stageComp.mapData;
            for (let y = 0; y < MAP_H; y++) {
                for (let x = 0; x < MAP_W; x++) {
                    if (mapData[y][x] === TILE_GRASS) {
                        grassTiles.push({ x: x * ts, y: y * ts });
                    }
                }
            }
        }

        // Draw ground entities
        for (const item of renderList) {
            if (item.render.type === 'tank') {
                drawTank(ctx, item, scale);
            } else if (item.render.type === 'bullet') {
                drawBullet(ctx, item.pos, item.dir, scale);
            } else if (item.render.type === 'explosion') {
                drawExplosion(ctx, item.pos, item.explosion, scale);
            }
        }

        // Draw grass layer on top
        for (const gt of grassTiles) {
            drawTile(ctx, gt.x, gt.y, ts, TILE_GRASS);
        }

        // === Draw HUD ===
        drawHUD(ctx, world, W, scale);
    };
}

function drawTile(ctx, x, y, size, tileType) {
    switch (tileType) {
        case TILE_BRICK:
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 1;
            // Brick pattern
            const half = size / 2;
            ctx.strokeRect(x, y, half, half);
            ctx.strokeRect(x + half, y, half, half);
            ctx.strokeRect(x, y + half, half, half);
            ctx.strokeRect(x + half, y + half, half, half);
            // Offset bricks
            ctx.beginPath();
            ctx.moveTo(x + half, y); ctx.lineTo(x + half, y + half);
            ctx.moveTo(x, y + half); ctx.lineTo(x + size, y + half);
            ctx.moveTo(x + half, y + half); ctx.lineTo(x + half, y + size);
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case TILE_STEEL:
            ctx.fillStyle = '#A0A0A0';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
            ctx.fillStyle = '#808080';
            ctx.fillRect(x + size / 2 - 1, y, 2, size);
            ctx.fillRect(x, y + size / 2 - 1, size, 2);
            break;

        case TILE_WATER:
            ctx.fillStyle = '#1a3a5c';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#2a5a8c';
            for (let i = 0; i < 3; i++) {
                const waveY = y + (size / 4) * i + 2;
                ctx.fillRect(x, waveY, size, 2);
            }
            break;

        case TILE_GRASS:
            ctx.fillStyle = '#2d5a1e';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#3a7a28';
            for (let i = 0; i < 4; i++) {
                const gx = x + Math.floor(i * size / 4);
                ctx.fillRect(gx + 1, y, 2, size);
            }
            break;

        case TILE_ICE:
            ctx.fillStyle = '#b0d4f1';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#d4eaf7';
            ctx.fillRect(x + 2, y + 2, size / 2 - 2, size / 2 - 2);
            ctx.fillRect(x + size / 2 + 1, y + size / 2 + 1, size / 2 - 3, size / 2 - 3);
            break;

        case TILE_BASE:
            // Eagle/Phoenix - draw a simple eagle icon
            ctx.fillStyle = '#555555';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            ctx.fillStyle = '#FF8C00';
            ctx.fillRect(x + size * 0.35, y + size * 0.35, size * 0.3, size * 0.3);
            break;

        case TILE_BASE_DEAD:
            ctx.fillStyle = '#555555';
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#333333';
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            break;
    }
}

function drawTank(ctx, item, scale) {
    const { pos, dir, tankType, render, spawnProtect } = item;
    if (!dir || !tankType) return;

    const s = scale;
    const size = 14 * s;
    const x = pos.x * s - size / 2;
    const y = pos.y * s - size / 2;

    // Spawn protection effect (flashing shield)
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

    // Flash effect when hit
    if (render.flash > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
        return;
    }

    const color = TANK_COLORS[tankType.colorKey] || TANK_COLORS.enemy1;

    ctx.save();
    ctx.translate(pos.x * s, pos.y * s);
    // Rotate based on direction: 0=UP(0°), 1=RIGHT(90°), 2=DOWN(180°), 3=LEFT(270°)
    ctx.rotate(dir.dir * Math.PI / 2);

    const half = size / 2;

    // Tank body
    ctx.fillStyle = color;
    ctx.fillRect(-half, -half, size, size);

    // Tank tracks (darker)
    ctx.fillStyle = darkenColor(color, 0.5);
    ctx.fillRect(-half, -half, size * 0.25, size);
    ctx.fillRect(half - size * 0.25, -half, size * 0.25, size);

    // Track details
    ctx.fillStyle = darkenColor(color, 0.3);
    const trackW = size * 0.25;
    for (let i = 0; i < 3; i++) {
        const ty = -half + (size / 3) * i + size / 6 - 1;
        ctx.fillRect(-half, ty, trackW, 2);
        ctx.fillRect(half - trackW, ty, trackW, 2);
    }

    // Turret (center square)
    ctx.fillStyle = darkenColor(color, 0.8);
    const turretSize = size * 0.4;
    ctx.fillRect(-turretSize / 2, -turretSize / 2, turretSize, turretSize);

    // Gun barrel (pointing up in local space)
    ctx.fillStyle = darkenColor(color, 0.6);
    const barrelW = size * 0.15;
    const barrelH = half + 2;
    ctx.fillRect(-barrelW / 2, -barrelH, barrelW, barrelH);

    ctx.restore();
}

function drawBullet(ctx, pos, dir, scale) {
    const s = scale;
    const size = 4 * s;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pos.x * s - size / 2, pos.y * s - size / 2, size, size);
    // Bullet glow
    ctx.fillStyle = '#FFFF88';
    ctx.fillRect(pos.x * s - size / 4, pos.y * s - size / 4, size / 2, size / 2);
}

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

function drawHUD(ctx, world, canvasW, scale) {
    const stageComp = world.getComponent(1, COMP.STAGE);
    const playerData = world.getComponent(1, COMP.PLAYER_DATA);
    const score = world.getComponent(2, COMP.SCORE);

    if (!stageComp) return;

    // Status bar at the bottom (rows 24-25)
    const barY = 24 * 16 * scale;

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, barY, canvasW, 2 * 16 * scale);

    // Draw divider line
    ctx.fillStyle = '#FF4500';
    ctx.fillRect(0, barY, canvasW, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${12 * scale}px monospace`;

    if (score) {
        ctx.fillText(`SCORE: ${String(score.value).padStart(6, '0')}`, 10 * scale, barY + 14 * scale);
    }

    if (playerData) {
        // Lives
        ctx.fillStyle = '#FFD700';
        ctx.fillText('P1', 10 * scale, barY + 30 * scale);
        for (let i = 0; i < playerData.lives; i++) {
            ctx.fillRect((10 + 3 + i * 3) * scale, barY + 22 * scale, 2.5 * scale, 2.5 * scale);
        }
    }

    // Enemy count
    ctx.fillStyle = '#FFFFFF';
    const remaining = stageComp.enemyCount;
    ctx.fillText(`ENEMY: ${remaining}`, 200 * scale, barY + 14 * scale);

    // Level
    ctx.fillText(`STAGE ${stageComp.level}`, 200 * scale, barY + 30 * scale);
}

function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}
