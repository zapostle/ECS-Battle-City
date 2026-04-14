// =============================================================================
// 胜利画面 - 纯 UI 渲染逻辑
// 只从 WorldView 读取组件数据，不写入任何 ECS 组件
// ★ 关卡号从 GameState 组件查询（替代 env.level）
// =============================================================================

export class VictoryScene {
    constructor(ctx, scale) {
        this.ctx = ctx;
        this.scale = scale;
    }

    render(view) {
        const ctx = this.ctx;
        const s = this.scale;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#00FF00';
        ctx.font = `bold ${28 * s}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('STAGE CLEAR!', W / 2, H * 0.4);

        // ★ 从 GameState 组件查询关卡号（替代 env.level）
        const level = view.getLevel();

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
}
