// =============================================================================
// UIRenderer - UI 渲染器主类
// 从 ECS 系统中彻底独立出来，通过 WorldView 只读查询 ECS 数据
// 设计原则：
//   - 不注册为 ECS 系统，在 world.tick() 外独立调用
//   - 通过 WorldView 查询组件数据，不直接修改任何 ECS 状态
//   - 通过 DataChannel 订阅数据变化（可选，用于增量更新场景）
//   - 场景路由：根据 GameState 组件决定渲染哪个画面
// =============================================================================

import { COMP } from '../Constants.js';
import { TitleScene } from './TitleScene.js';
import { PlayingScene } from './PlayingScene.js';
import { GameOverScene } from './GameOverScene.js';
import { VictoryScene } from './VictoryScene.js';

export class UIRenderer {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     */
    constructor(ctx, scale) {
        this.ctx = ctx;
        this.scale = scale;

        this.scenes = {
            title: new TitleScene(ctx, scale),
            playing: new PlayingScene(ctx, scale),
            gameover: new GameOverScene(ctx, scale),
            victory: new VictoryScene(ctx, scale),
        };
    }

    /**
     * 渲染当前帧
     * @param {import('../../ecs/WorldView.js').WorldView} view - 只读世界视图
     * @param {string} fallbackState - 外部状态回退（如 title 状态时尚无 World）
     */
    render(view, fallbackState) {
        const state = fallbackState || this._getGameState(view);
        const scene = this.scenes[state];
        if (scene) {
            scene.render(view);
        }
    }

    /**
     * 从 World 中查询游戏状态（优先级：GameState 组件 > env.state）
     * @param {import('../../ecs/WorldView.js').WorldView} view
     * @returns {string}
     */
    _getGameState(view) {
        // 优先查询 GameState 单例组件
        const stateId = view.findEntity(COMP.GAME_STATE);
        if (stateId) {
            const gs = view.getComponent(stateId, COMP.GAME_STATE);
            if (gs) return gs.state;
        }
        // 回退到 env.state（兼容过渡期）
        return view.env?.state ?? 'playing';
    }
}
