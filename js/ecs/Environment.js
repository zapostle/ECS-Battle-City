// ============================================================================= 
// Environment - 环境容器（Resources / Singleton Component）
// Natural Order ECS 中的"环境"概念：
//   存储不属于任何特定实体、但所有系统可见的全局信息。
//   ★ "动态变量=组件"原则：
//     所有动态变化的值（level/state/mapData/enemiesSpawned/maxEnemies）
//     已迁移至对应的 ECS 组件中，env 不再持有任何可变游戏数据。
//   保留的内容：
//     1. config — 静态只读参数（速度/尺寸/颜色等），不可变
//     2. providers — 服务访问点（随机数生成器等），无状态
//     3. frameCount/deltaTime — 帧时间状态，ECS 引擎运行时必需
// =============================================================================

export class Environment {
    /**
     * @param {Object} config - 游戏配置表（只读，建议 Object.freeze）
     */
    constructor(config = {}) {
        // ==================== 1. 只读配置表 ====================
        /** @type {Object} 静态游戏配置（速度/尺寸/颜色等）*/
        this.config = config || {};

        // ==================== 2. 帧时间状态（ECS 引擎运行时必需，非游戏逻辑数据）====================
        /** @type {number} 当前帧索引（从0开始递增，用于调试/动画同步）*/
        this.frameCount = 0;
        /** @type {number} 距离上一帧的时间差（毫秒），默认60FPS=16.67ms */
        this.deltaTime = 1000 / 60;

        // ==================== 3. 服务访问点（providers）====================
        // 遵循 Natural Order ECS Rule 6: 所有外部依赖通过 Environment 注入
        // 可替换的提供者，方便单元测试时注入确定性实现
        
        /** @type {Object} 服务提供者集合 */
        this.providers = {
            /** @type {() => number} 随机数生成器，返回 [0, 1) 的随机数 */
            random: Math.random.bind(Math),
        };
    }

    // ====== 便捷访问：随机数生成器（委托到 providers.random）======
    /** @type {() => number} 返回 [0, 1) 的随机数 */
    get random() {
        return this.providers.random;
    }

    set random(fn) {
        this.providers.random = fn;
    }

    // ====== 便捷访问方法：读取配置值 ======
    
    /**
     * 获取配置值（支持路径访问，如 'tank.playerSpeed'）
     * @param {string} path - 点分隔的配置路径
     * @param {*} fallback - 找不到时的默认值
     */
    getConfig(path, fallback = undefined) {
        const keys = path.split('.');
        let val = this.config;
        for (const key of keys) {
            if (val == null) return fallback;
            val = val[key];
        }
        return val !== undefined ? val : fallback;
    }
}
