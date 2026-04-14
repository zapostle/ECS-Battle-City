// ============================================================================= 
// GameConfig - 游戏配置表（静态只读数据）
// Natural Order ECS 中 Environment.config 的数据源。
// 聚合所有游戏数值参数、方向映射、颜色配置等。
// 设计原则：
//   - 所有值为原始类型或冻结对象，保证不可变性
//   - 系统通过 env.getConfig('path') 读取
//   - 方便后续从外部 JSON/Excel 加载替换
// =============================================================================

// ==================== 地图与画布配置 ====================
export const MAP_CONFIG = {
    TILE: 16,                // 瓦片单位大小（每个瓦片 = 16x16 游戏单位）
    TILE_SIZE: 16,           // 显示时每个瓦片的像素尺寸
    MAP_W: 26,               // 地图宽度（瓦片数）
    MAP_H: 26,               // 地图高度（行0~25，包含基地区域）
    CANVAS_EXTRA_ROWS: 2,    // HUD 状态栏额外占用的行数
};

// 派生值（从 MAP_CONFIG 计算，避免手动同步）
MAP_CONFIG.GAME_W = MAP_CONFIG.MAP_W * MAP_CONFIG.TILE;
MAP_CONFIG.GAME_H = MAP_CONFIG.MAP_H * MAP_CONFIG.TILE;
MAP_CONFIG.CANVAS_TOTAL_H = (MAP_CONFIG.MAP_H + MAP_CONFIG.CANVAS_EXTRA_ROWS) * MAP_CONFIG.TILE;

// ==================== 实体碰撞尺寸 ====================
export const COLLISION_SIZE = {
    PLAYER: 14,   // 玩家坦克碰撞半尺寸
    ENEMY: 14,    // 敌人坦克碰撞半尺寸
    BULLET: 4,    // 子弹碰撞半尺寸
};

// ==================== 移动速度（每帧像素数）====================
export const SPEED = {
    PLAYER: 1.2,   // 玩家移动速度
    ENEMY: 0.6,    // 敌人移动速度（比玩家慢）
    BULLET: 3,     // 子弹飞行速度
};

// ==================== 方向枚举 ====================
export const DIR = {
    NONE: -1,
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3,
};

// 方向向量映射表: [dx, dy] — 根据方向计算位移增量
export const DIR_VEC = {
    [DIR.UP]:    [0, -1],   // 向上：Y轴负方向
    [DIR.RIGHT]: [1, 0],    // 向右：X轴正方向
    [DIR.DOWN]:  [0, 1],    // 向下：Y轴正方向
    [DIR.LEFT]:  [-1, 0],   // 向左：X轴负方向
};

// ==================== 地图瓦片类型 ====================
export const TILE_TYPE = {
    EMPTY:      0,   // 空地 - 可通行
    BRICK:      1,   // 砖墙 - 可被子弹摧毁
    STEEL:      2,   // 钢墙 - 无法被子弹摧毁
    WATER:      3,   // 水域 - 不可通行
    GRASS:      4,   // 草地 - 可通行但遮挡视线
    ICE:        5,   // 冰面 - 可通行，增加滑行效果（预留）
    BASE:       6,   // 基地(老鹰) - 被击中则游戏结束
    BASE_DEAD:  7,   // 已被摧毁的基地
};

// ==================== 坦克配置 ====================
export const TANK_TYPE = {
    PLAYER: 'player',   // 玩家坦克标识
    ENEMY: 'enemy',     // 敌人坦克标识
};

// 坦克颜色配置（用于 Canvas 绘制）
export const TANK_COLORS = Object.freeze({
    player: '#FFD700',    // 金色 - 玩家坦克
    enemy1: '#C0C0C0',    // 银色 - 普通敌人
    enemy2: '#FF6B6B',    // 红色 - 快速敌人（预留）
    enemy3: '#32CD32',    // 绿色 - 重型敌人（预留）
    enemy4: '#87CEEB',    // 浅蓝色 - 特殊敌人（预留）
});

// ==================== 战斗参数 ====================
export const COMBAT = {
    PLAYER_HP: 1,              // 玩家血量（1血即死）
    PLAYER_LIVES: 3,           // 玩家初始生命数
    ENEMY_HP: 1,               // 敌人血量
    BULLET_POWER: 1,           // 子弹威力
    PLAYER_SHOOT_CD: 20,       // 玩家射击冷却帧数
    ENEMY_SHOOT_CD: 60,        // 敌人射击冷却帧数
    KILL_SCORE: 100,           // 击杀敌人得分
    SPAWN_PROTECT_PLAYER: 120, // 玩家出生保护帧数
    SPAWN_PROTECT_ENEMY: 60,   // 敌人出生保护帧数
    RESPAWN_DELAY: 30,         // 玩家复活延迟帧数
    ENEMY_SPAWN_INTERVAL: 180, // 敌人生成间隔帧数
    MAX_ENEMIES_ON_SCREEN: 4,  // 场上最大敌人数
    MAX_ENEMIES_PER_STAGE: 20, // 每关最大敌人数
    FIRST_SPAWN_DELAY: 60,     // 首次敌人生成延迟
};

// ==================== AI 参数 ====================
export const AI_CONFIG = {
    THINK_MIN: 60,             // 最小思考间隔（帧）
    THINK_MAX: 180,            // 最大思考间隔（帧）
    CHASE_CHANCE: 0.3,         // 追踪玩家概率
    SHOOT_CHANCE: 0.02,        // 每帧射击概率（约2%）
    DEFAULT_BEHAVIOR: 'patrol', // 默认行为模式
};

// ==================== 动画参数 ====================
export const ANIMATION = {
    EXPLOSION_SMALL_FRAMES: 8,   // 小爆炸持续帧数
    EXPLOSION_LARGE_FRAMES: 20,  // 大爆炸持续帧数
    HIT_FLASH_FRAMES: 4,         // 受击闪烁帧数
};

// ==================== 出生点配置 ====================
export const SPAWN_POINTS = {
    PLAYER: [
        { x: 8 * 16 + 8, y: 20 * 16 + 8 },   // 主出生点
        { x: 16 * 16 + 8, y: 20 * 16 + 8 },  // 备用出生点
    ],
    ENEMY: [
        { x: 0 * 16 + 8, y: 1 * 16 + 8 },    // 左侧
        { x: 12 * 16 + 8, y: 1 * 16 + 8 },   // 中间
        { x: 24 * 16 + 8, y: 1 * 16 + 8 },   // 右侧
    ],
    BASE: { x: 12 * 16 + 8, y: 24 * 16 + 8 }, // 基地中心点
};

// =============================================================================
// 统一导出：合并为单个 config 对象，供 Environment 使用
// =============================================================================

/** @type {Object} 完整的游戏配置表 */
export const GameConfig = Object.freeze({
    map:       MAP_CONFIG,
    collision: COLLISION_SIZE,
    speed:     SPEED,
    dir:       Object.freeze({ ...DIR }),
    dirVec:    Object.freeze({ ...DIR_VEC }),
    tile:      Object.freeze({ ...TILE_TYPE }),
    tank:      Object.freeze({ ...TANK_TYPE }),
    colors:    TANK_COLORS,
    combat:    Object.freeze({ ...COMBAT }),
    ai:        Object.freeze({ ...AI_CONFIG }),
    animation: Object.freeze({ ...ANIMATION }),
    spawn:     Object.freeze({ ...SPAWN_POINTS }),
});
