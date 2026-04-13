// =============================================================================
// 渲染系统 - 将所有游戏实体绘制到 Canvas 画布上
// Natural Order: 作为最后一个执行的系统，读取所有 Position + Render 组件输出到屏幕
// ★ 所有配置通过 env.config 访问 (Rule 6)，不直接导入 GameConfig
// =============================================================================

import { COMP } from '../Constants.js';

// 创建渲染系统（工厂函数，接收 canvas 2D上下文和缩放倍数）
export function createRenderSystem(ctx, scale = 2) {
    return function RenderSystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
        const TILE_SIZE = env.config.map.TILE_SIZE;
        const MAP_W = env.config.map.MAP_W;
        const MAP_H = env.config.map.MAP_H;
        const W = MAP_W * TILE_SIZE * scale;
        const H = MAP_H * TILE_SIZE * scale;
        const ts = TILE_SIZE * scale;

        // ★ 从 env.config 读取瓦片类型和颜色表（Rule 6: 不直接导入 GameConfig）
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
                drawTank(ctx, item, scale, TANK_COLORS);
            } else if (item.render.type === 'bullet') {
                drawBullet(ctx, item.pos, item.dir, scale);
            } else if (item.render.type === 'explosion') {
                drawExplosion(ctx, item.pos, item.explosion, scale);
            }
        }

        // ==================== 5. 绘制草地层 ====================
        for (const gt of grassTiles) {
            drawTile(ctx, gt.x, gt.y, ts, TT.GRASS, TT);
        }

        // ==================== 6. 绘制 HUD 状态栏 ====================
        drawHUD(ctx, env, world, W, scale);
    };
}

// ====== 绘制单个地图瓦片 ======
function drawTile(ctx, x, y, size, tileType, TT) {
    switch (tileType) {
        case TT.BRICK:
            // ---- 砖墙: 棕色底 + 深色砖缝纹理 ----
            ctx.fillStyle = '#8B4513';       // 深棕色基底
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = '#654321';      // 更深的砖缝色
            ctx.lineWidth = 1;
            // 将瓦片分为4小块，绘制十字形分割线
            const half = size / 2;
            ctx.strokeRect(x, y, half, half);
            ctx.strokeRect(x + half, y, half, half);
            ctx.strokeRect(x, y + half, half, half);
            ctx.strokeRect(x + half, y + half, half, half);
            // 偏移砖缝细节（模拟真实砖墙交错感）
            ctx.beginPath();
            ctx.moveTo(x + half, y); ctx.lineTo(x + half, y + half);
            ctx.moveTo(x, y + half); ctx.lineTo(x + size, y + half);
            ctx.moveTo(x + half, y + half); ctx.lineTo(x + half, y + size);
            ctx.strokeStyle = '#3E2723';
            ctx.lineWidth = 1;
            ctx.stroke();
            break;

        case TT.STEEL:
            // ---- 钢墙: 银灰色金属质感 + 十字高光 ----
            ctx.fillStyle = '#A0A0A0';       // 基底灰
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#C0C0C0';       // 内部亮面
            ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
            ctx.fillStyle = '#808080';       // 金属十字骨架
            ctx.fillRect(x + size / 2 - 1, y, 2, size);
            ctx.fillRect(x, y + size / 2 - 1, size, 2);
            break;

        case TT.WATER:
            // ---- 水域: 深蓝色 + 波纹线条动画效果 ----
            ctx.fillStyle = '#1a3a5c';       // 深蓝色水面
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#2a5a8c';       // 浅蓝波纹
            for (let i = 0; i < 3; i++) {
                const waveY = y + (size / 4) * i + 2;
                ctx.fillRect(x, waveY, size, 2);  // 3条水平波纹线
            }
            break;

        case TT.GRASS:
            // ---- 草地: 深绿色 + 竖条纹纹理 ----
            ctx.fillStyle = '#2d5a1e';       // 深绿底层
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#3a7a28';       // 浅绿草叶
            for (let i = 0; i < 4; i++) {
                const gx = x + Math.floor(i * size / 4);
                ctx.fillRect(gx + 1, y, 2, size);  // 4条竖向草叶
            }
            break;

        case TT.ICE:
            // ---- 冰面: 浅蓝色 + 方块高光（光滑反光感）----
            ctx.fillStyle = '#b0d4f1';       // 冰蓝底色
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#d4eaf7';       // 左上高光
            ctx.fillRect(x + 2, y + 2, size / 2 - 2, size / 2 - 2);
            ctx.fillStyle = '#d4eaf7';       // 右下高光
            ctx.fillRect(x + size / 2 + 1, y + size / 2 + 1, size / 2 - 3, size / 2 - 3);
            break;

        case TT.BASE:
            // ---- 基地(老鹰): 金色图标表示存活状态 ----
            ctx.fillStyle = '#555555';       // 深灰基座
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#FFD700';       // 金色老鹰外框
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            ctx.fillStyle = '#FF8C00';       // 橙色老鹰内芯
            ctx.fillRect(x + size * 0.35, y + size * 0.35, size * 0.3, size * 0.3);
            break;

        case TT.BASE_DEAD:
            // ---- 已毁基地: 暗灰色表示被摧毁 ----
            ctx.fillStyle = '#555555';       // 基座不变
            ctx.fillRect(x, y, size, size);
            ctx.fillStyle = '#333333';       // 内部变暗
            ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.6);
            break;
    }
}

// ====== 绘制坦克 ======
function drawTank(ctx, item, scale, TANK_COLORS) {
    const { pos, dir, tankType, render, spawnProtect } = item;
    if (!dir || !tankType) return;

    const s = scale;
    const size = 14 * s;             // 坦克基础大小(28px @2x)
    const x = pos.x * s - size / 2;  // 转换为屏幕坐标并居中
    const y = pos.y * s - size / 2;

    // ---- 出生保护光环效果（闪烁的蓝色圆圈）----
    if (spawnProtect && spawnProtect.frames > 0) {
        const flash = Math.floor(spawnProtect.frames / 4) % 2;  // 每4帧切换一次可见性
        if (flash) {
            ctx.strokeStyle = '#00BFFF';     // 天蓝色光环
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x * s, pos.y * s, size / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ---- 受击闪烁效果（白色闪白）----
    if (render.flash > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
        return;  // 闪烁期间跳过正常绘制
    }

    // 获取坦克颜色（根据 colorKey 从颜色表查找）
    const color = TANK_COLORS[tankType.colorKey] || TANK_COLORS.enemy1;

    // ---- 开始绘制坦克本体 ----
    ctx.save();
    // 移动原点到坦克中心
    ctx.translate(pos.x * s, pos.y * s);
    // 根据方向旋转坐标系: 0=上(0°), 1=右(90°), 2=下(180°), 3=左(270°)
    ctx.rotate(dir.dir * Math.PI / 2);

    const half = size / 2;

    // 坦克主体（正方形车体）
    ctx.fillStyle = color;
    ctx.fillRect(-half, -half, size, size);

    // 履带（两侧深色带，比主体暗50%）
    ctx.fillStyle = darkenColor(color, 0.5);
    ctx.fillRect(-half, -half, size * 0.25, size);          // 左履带
    ctx.fillRect(half - size * 0.25, -half, size * 0.25, size);  // 右履带

    // 履带纹理细节（每条履带上画3个短横线模拟轮子）
    ctx.fillStyle = darkenColor(color, 0.3);
    const trackW = size * 0.25;
    for (let i = 0; i < 3; i++) {
        const ty = -half + (size / 3) * i + size / 6 - 1;
        ctx.fillRect(-half, ty, trackW, 2);                   // 左履带轮子
        ctx.fillRect(half - trackW, ty, trackW, 2);           // 右履带轮子
    }

    // 炮塔（中心深色方块）
    ctx.fillStyle = darkenColor(color, 0.8);
    const turretSize = size * 0.4;
    ctx.fillRect(-turretSize / 2, -turretSize / 2, turretSize, turretSize);

    // 炮管（指向上方，在局部坐标系中沿-Y方向延伸）
    ctx.fillStyle = darkenColor(color, 0.6);
    const barrelW = size * 0.15;
    const barrelH = half + 2;
    ctx.fillRect(-barrelW / 2, -barrelH, barrelW, barrelH);

    ctx.restore();  // 恢复坐标系
}

// ====== 绘制子弹 ======
function drawBullet(ctx, pos, dir, scale) {
    const s = scale;
    const size = 4 * s;               // 子弹大小(8px @2x)
    ctx.fillStyle = '#FFFFFF';        // 白色弹体
    ctx.fillRect(pos.x * s - size / 2, pos.y * s - size / 2, size, size);
    // 内部发光核心
    ctx.fillStyle = '#FFFF88';        // 淡黄色发光
    ctx.fillRect(pos.x * s - size / 4, pos.y * s - size / 4, size / 2, size / 2);
}

// ====== 绘制爆炸效果 ======
function drawExplosion(ctx, pos, explosion, scale) {
    const s = scale;
    const progress = explosion.timer / explosion.maxTimer;  // 动画进度 (0→1)
    const maxRadius = (explosion.size === 2 ? 20 : 12) * s;  // 大爆炸20px, 小爆炸12px

    if (progress < 0.3) {
        // 阶段1 (0-30%): 白色快速膨胀
        const r = maxRadius * (progress / 0.3);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
    } else if (progress < 0.6) {
        // 阶段2 (30-60%): 橙色最大范围 + 黄色内核
        const r = maxRadius;
        ctx.fillStyle = '#FF8C00';         // 橙色外圈
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFF00';         // 黄色内核（半径50%）
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // 阶段3 (60-100%): 红色逐渐缩小淡出
        const r = maxRadius * (1 - (progress - 0.6) / 0.4);
        ctx.fillStyle = '#FF4500';
        ctx.globalAlpha = 1 - (progress - 0.6) / 0.4;  // 透明度渐变
        ctx.beginPath();
        ctx.arc(pos.x * s, pos.y * s, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;  // 恢复透明度
    }
}

// ====== 绘制 HUD 状态栏（地图区域下方的独立区域）======
function drawHUD(ctx, env, world, canvasW, scale) {
    if (!env) return;

    const MAP_H = env.config.map.MAP_H;
    const TILE_SIZE = env.config.map.TILE_SIZE;
    const playerId = (function() {
        for (const id of world.getEntitiesWith(COMP.PLAYER_INPUT)) return id;
        return null;
    })();
    const score = playerId ? world.getComponent(playerId, COMP.SCORE) : null;

    // 状态栏区域起始 Y 坐标
    const barY = MAP_H * TILE_SIZE * scale;

    ctx.fillStyle = '#333333';
    ctx.fillRect(0, barY, canvasW, 2 * 16 * scale);

    ctx.fillStyle = '#FF4500';
    ctx.fillRect(0, barY, canvasW, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${12 * scale}px monospace`;

    if (score) {
        ctx.fillText(`SCORE: ${String(score.value).padStart(6, '0')}`, 10 * scale, barY + 14 * scale);
    }

    if (env.playerLives != null) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('P1', 10 * scale, barY + 30 * scale);
        for (let i = 0; i < env.playerLives; i++) {
            ctx.fillRect((10 + 3 + i * 3) * scale, barY + 22 * scale, 2.5 * scale, 2.5 * scale);
        }
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`ENEMY: ${env.enemyCount}`, 200 * scale, barY + 14 * scale);
    ctx.fillText(`STAGE ${env.level}`, 200 * scale, barY + 30 * scale);
}

// ====== 辅助函数：将颜色变暗（用于绘制坦克不同部位）======
// factor: 0=纯黑, 0.5=半暗, 1.0=原色
function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}
