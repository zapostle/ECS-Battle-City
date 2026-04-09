// =============================================================================
// 游戏常量定义 - Battle City
// 定义所有游戏中使用的数值常量、方向枚举、瓦片类型、组件类型名等
// =============================================================================

export const TILE = 16;          // 瓦片单位大小（每个瓦片 = 16x16 游戏单位）
export const TILE_SIZE = 16;     // 显示时每个瓦片的像素尺寸
export const MAP_W = 26;         // 地图宽度（以瓦片为单位，共26格）
export const MAP_H = 26;         // 地图高度（行0~25，包含基地区域）
export const GAME_W = MAP_W * TILE;  // 游戏区域实际宽度 = 416 像素
export const GAME_H = MAP_H * TILE;  // 游戏区域实际高度 = 416 像素
// Canvas 总高度 = 地图高度 + HUD 状态栏额外空间（2行瓦片）
// 确保基地(行24~25)完全可见，HUD 绘制在地图下方
export const CANVAS_EXTRA_ROWS = 2;   // HUD 额外占用的行数
export const CANVAS_TOTAL_H = (MAP_H + CANVAS_EXTRA_ROWS) * TILE;  // 总画布高度 = 28*16 = 448px

// 实体碰撞尺寸（半宽/半高）
export const PLAYER_SIZE = 14;   // 玩家坦克尺寸
export const ENEMY_SIZE = 14;    // 敌人坦克尺寸
export const BULLET_SIZE = 4;   // 子弹尺寸

// 移动速度（每帧像素数）
export const PLAYER_SPEED = 1.2;// 玩家移动速度
export const ENEMY_SPEED = 0.6; // 敌人移动速度（比玩家慢）
export const BULLET_SPEED = 3;  // 子弹飞行速度

// 方向枚举：0=上, 1=右, 2=下, 3=左
export const DIR = {
    NONE: -1,
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// 方向向量映射表: [dx, dy] — 用于根据方向计算位移增量
export const DIR_VEC = {
    0: [0, -1],  // UP    向上：Y轴负方向
    1: [1, 0],   // RIGHT 向右：X轴正方向
    2: [0, 1],   // DOWN  向下：Y轴正方向
    3: [-1, 0]   // LEFT  向左：X轴负方向
};

// ==================== 地图瓦片类型常量 ====================
export const TILE_EMPTY = 0;     // 空地 - 可通行
export const TILE_BRICK = 1;     // 砖墙 - 可被子弹摧毁
export const TILE_STEEL = 2;     // 钢墙 - 无法被子弹摧毁
export const TILE_WATER = 3;     // 水域 - 不可通行
export const TILE_GRASS = 4;     // 草地 - 可通行但遮挡视线（渲染在坦克上层）
export const TILE_ICE = 5;       // 冰面 - 可通行，增加滑行效果（预留）
export const TILE_BASE = 6;      // 基地(老鹰) - 被击中则游戏结束
export const TILE_BASE_DEAD = 7; // 已被摧毁的基地

// 坦克类型标识
export const TANK_PLAYER = 'player';  // 玩家坦克
export const TANK_ENEMY = 'enemy';   // 敌人坦克

// 坦克颜色配置（用于 Canvas 绘制）
export const TANK_COLORS = {
    player: '#FFD700',   // 金色 - 玩家坦克
    enemy1: '#C0C0C0',   // 银色 - 普通敌人
    enemy2: '#FF6B6B',   // 红色 - 快速敌人（预留）
    enemy3: '#32CD32',   // 绿色 - 重型敌人（预留）
    enemy4: '#87CEEB'    // 浅蓝色 - 特殊敌人（预留）
};

// ==================== 组件类型名称常量 ====================
// 用于在 SparseSet 中标识不同类型的组件数据
export const COMP = {
    POSITION: 'Position',        // 位置组件 - 存储x,y坐标
    DIRECTION: 'Direction',      // 方向组件 - 存储朝向(0-3)
    VELOCITY: 'Velocity',        // 速度组件 - 存储移动状态
    TANK_TYPE: 'TankType',       // 坦克类型 - 区分玩家/敌人及颜色
    HP: 'HP',                    // 生命值 - 血量和最大血量
    COLLISION: 'Collision',      // 碰撞体 - AABB碰撞盒半尺寸
    BULLET: 'Bullet',            // 子弹标记 - 标识实体为子弹及所有者信息
    DAMAGE_INFO: 'DamageInfo',   // 伤害事件 - 一次性事件组件（Natural Order核心模式）
    SHOOT_COOLDOWN: 'ShootCooldown', // 射击冷却 - 射击间隔计时器
    SHOOT_REQUEST: 'ShootRequest',   // 射击请求 - AI触发的射击事件
    PLAYER_INPUT: 'PlayerInput',     // 玩家输入 - 键盘输入状态
    AI_CTRL: 'AIController',         // AI控制器 - 敌人AI行为参数
    RENDER: 'Render',                // 渲染信息 - 绘制类型、颜色、层级
    TILE: 'Tile',                    // 地图瓦片 - 静态地图元素
    ANIMATION: 'Animation',          // 动画状态 - 帧动画控制
    DESTROYED: 'Destroyed',          // 销毁标记 - 延迟销毁标志
    SPAWN_PROTECT: 'SpawnProtect',   // 出生保护 - 无敌帧计时
    EXPLOSION: 'Explosion',          // 爆炸效果 - 视觉特效参数
    POWERUP: 'PowerUp',              // 道具拾取 - 能力增强道具（预留）
    SCORE: 'Score',                  // 分数 - 玩家得分记录
    STAGE: 'Stage',                  // 关卡状态 - 关卡进度和游戏状态
    PLAYER_DATA: 'PlayerData',       // 玩家数据 - 生命数、总分数等持久数据
};
