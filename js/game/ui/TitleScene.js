// =============================================================================
// 标题画面 - 从 Game._drawTitle() 拆出，纯 UI 渲染逻辑
// 只从 WorldView 读取数据，不写入任何 ECS 组件
// =============================================================================

export class TitleScene {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     */
    constructor(ctx, scale) {
        this.ctx = ctx;
        this.scale = scale;
    }

    render() {
        const ctx = this.ctx;
        const s = this.scale;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

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
}
