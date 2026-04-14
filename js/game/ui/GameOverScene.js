// =============================================================================
// 游戏结束画面 - 从 Game._drawGameOver() 拆出，纯 UI 渲染逻辑
// 只从 WorldView 读取数据，不写入任何 ECS 组件
// =============================================================================

import { COMP } from '../Constants.js';

export class GameOverScene {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     */
    constructor(ctx, scale) {
        this.ctx = ctx;
        this.scale = scale;
    }

    /**
     * @param {import('../../ecs/WorldView.js').WorldView} view - 只读世界视图
     */
    render(view) {
        const ctx = this.ctx;
        const s = this.scale;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#FF0000';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H * 0.4);

        // ★ 从 WorldView 查询分数（替代 env.playerScore）
        const playerId = view.findEntity(COMP.PLAYER_INPUT);
        const scoreComp = playerId ? view.getComponent(playerId, COMP.SCORE) : null;
        const score = scoreComp ? scoreComp.value : 0;

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
}
