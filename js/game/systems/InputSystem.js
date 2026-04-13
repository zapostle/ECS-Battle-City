// =============================================================================
// 输入系统 - 键盘输入捕获与处理
// Natural Order: 作为第一个执行的系统，为后续系统提供玩家输入数据
// 职责: 监听键盘事件，将按键状态写入 PlayerInput 组件
// =============================================================================

import { COMP } from '../Constants.js';

// 创建输入系统（工厂函数，接收外部管理的 keyState 对象）
export function createInputSystem(keyState) {
    return function InputSystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
        const DIR = env.config.dir;
        // 遍历所有拥有 PlayerInput 组件的实体（即玩家）
        for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
            // 跳过已标记销毁的实体
            if (world.hasComponent(entityId, COMP.DESTROYED)) continue;

            const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
            const prevDir = input.dir;  // 记录上一帧的方向，用于检测方向变化
            const prevShoot = input.shoot;

            // 先重置每帧的输入状态
            input.dir = DIR.NONE;       // -1 表示无方向输入（静止）
            input.shoot = false;

            // 根据按键状态确定移动方向（优先级: 上 > 下 > 左 > 右）
            if (keyState.up) input.dir = DIR.UP;
            else if (keyState.down) input.dir = DIR.DOWN;
            else if (keyState.left) input.dir = DIR.LEFT;
            else if (keyState.right) input.dir = DIR.RIGHT;

            // 射击指令
            if (keyState.shoot) input.shoot = true;

            // 方向名称映射表
            const dirNames = { [-1]: '静止', [0]: '上↑', [1]: '右→', [2]: '下↓', [3]: '左←' };
            const currDirName = dirNames[input.dir];
            const prevDirName = dirNames[prevDir];

            // 仅在输入发生变化时输出日志（避免刷屏）
            if (prevDir !== input.dir || prevShoot !== input.shoot) {
                console.log(
                    `[InputSystem] 🎮 玩家输入变化 | ` +
                    `方向: ${prevDirName} → ${currDirName} | ` +
                    `射击: ${prevShoot ? '🔥' : '—'} → ${input.shoot ? '🔥' : '—'} | ` +
                    `按键状态 [${keyState.up ? 'W' : '_'} ${keyState.down ? 'S' : '_'} ${keyState.left ? 'A' : '_'} ${keyState.right ? 'D' : '_'} ${keyState.shoot ? 'J' : '_'}]`
                );
            }
        }
    };
}

// 创建键盘状态对象（初始化所有按键为 false）
export function createKeyState() {
    return { up: false, down: false, left: false, right: false, shoot: false };
}

// 设置键盘事件监听器，将按键映射到 keyState 对象
// 返回清理函数用于移除监听器（防止内存泄漏）
export function setupKeyListeners(keyState) {
    // 按下时设置对应标志为 true
    const onKeyDown = (e) => {
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': keyState.up = true; break;     // 上 / W
            case 'ArrowDown': case 'KeyS': keyState.down = true; break;   // 下 / S
            case 'ArrowLeft': case 'KeyA': keyState.left = true; break;   // 左 / A
            case 'ArrowRight': case 'KeyD': keyState.right = true; break; // 右 / D
            case 'Space': case 'KeyJ': keyState.shoot = true; break;      // 空格 / J 射击
        }
    };
    // 松开时重置对应标志为 false
    const onKeyUp = (e) => {
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': keyState.up = false; break;
            case 'ArrowDown': case 'KeyS': keyState.down = false; break;
            case 'ArrowLeft': case 'KeyA': keyState.left = false; break;
            case 'ArrowRight': case 'KeyD': keyState.right = false; break;
            case 'Space': case 'KeyJ': keyState.shoot = false; break;
        }
    };

    // 注册全局键盘事件监听
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // 返回清理函数：调用时可移除所有事件监听器
    return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
    };
}
