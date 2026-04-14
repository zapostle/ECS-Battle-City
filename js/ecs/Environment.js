// ============================================================================= 
// Environment - 环境容器（Resources / Singleton Component）
// Natural Order ECS 中的"环境"概念：
//   存储不属于任何特定实体、但所有系统可见的全局信息。
//   三层结构：
//     1. config — 静态参数，只读（速度/尺寸/颜色等）
//     2. state  — 运行时全局状态（关卡进度、帧时间等）
//     3. providers — 服务访问点（随机数生成器、日志接口等）
//
// ★ UI-ECS 解耦原则：
//   - UI 专用数据（playerLives, playerScore, enemyCount）不再存放在此
//   - 这些数据由 ECS 组件提供，UI 层通过 WorldView 查询
//   - env 只保留 ECS 系统运行必需的全局状态
// =============================================================================

export class Environment {
    /**
     * @param {Object} config - 游戏配置表（只读，建议 Object.freeze）
     */
    constructor(config = {}) {
        // ==================== 1. 只读配置表 ====================
        /** @type {Object} 静态游戏配置（速度/尺寸/颜色等）*/
        this.config = config || {};

        // ==================== 2. 运行时状态（可变） ====================

        // ---- 关卡状态 ----
        /** @type {number} 当前关卡数（从1开始）*/
        this.level = 1;
        /** @type {string} 游戏阶段: 'playing' | 'victory' | 'gameover'
         *  ★ 兼容过渡期保留，新代码应通过 GameState 组件查询 */
        this.state = 'playing';

        // ---- 帧时间状态 (ECS 标准运行时数据) ----
        /** @type {number} 当前帧索引（从0开始递增，用于调试/动画同步）*/
        this.frameCount = 0;
        /** @type {number} 距离上一帧的时间差（毫秒），默认60FPS=16.67ms */
        this.deltaTime = 1000 / 60;
        /** @type {number} 已生成的敌人总数 */
        this.enemiesSpawned = 0;
        /** @type {number} 每关最大敌人生成数 */
        this.maxEnemies = 20;

        // ---- 地图数据（运行时可被修改，如砖墙被摧毁）----
        /** @type {number[][]} 26x26 二维瓦片数组 */
        this.mapData = null;

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

    /**
     * 重置环境到初始状态（用于切换关卡）
     * @param {number} level - 新关卡编号
     * @param {number[][]} mapData - 新地图数据（深拷贝）
     */
    reset(level, mapData) {
        this.level = level;
        this.state = 'playing';
        this.enemiesSpawned = 0;
        this.mapData = mapData;
    }
}
