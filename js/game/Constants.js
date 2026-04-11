// =============================================================================
// 游戏常量定义 - Battle City
//
// 设计原则：
//   - COMP: 组件类型名称（ECS 架构标识符，非配置数据）
//   - 画布尺寸常量: 仅用于 Game.js 入口层初始化 Canvas（在 World 创建之前执行）
//   - ★ 所有游戏数值参数已迁移至 GameConfig.js，通过 env.config 访问 (Rule 6)
//
// 注意：TILE/MAP_W/MAP_H 与 GameConfig.map 存在数值重复是有意的——
//       Canvas 初始化发生在 World 构造之前，此时 env 尚不存在，
//       因此入口层需要独立的尺寸常量。
// =============================================================================

// ==================== 画布与地图尺寸（Canvas 初始化用 — 非 ECS 配置）====================
export const TILE = 16;          // 瓦片单位大小
export const TILE_SIZE = 16;     // 显示时每个瓦片的像素尺寸
export const MAP_W = 26;         // 地图宽度
export const MAP_H = 26;         // 地图高度
export const CANVAS_EXTRA_ROWS = 2;   // HUD 额外占用的行数
export const CANVAS_TOTAL_H = (MAP_H + CANVAS_EXTRA_ROWS) * TILE;

// ==================== 组件类型名称常量 ====================
// Natural Order ECS 的核心：组件类型标识符
// 这些是架构定义（Type Name），不是游戏配置数据，所以保留在此文件

export const COMP = {
    POSITION: 'Position',        // 位置组件
    DIRECTION: 'Direction',      // 方向组件
    VELOCITY: 'Velocity',        // 速度组件
    TANK_TYPE: 'TankType',       // 坦克类型
    HP: 'HP',                    // 生命值
    COLLISION: 'Collision',      // 碰撞体
    BULLET: 'Bullet',            // 子弹标记
    DAMAGE_INFO: 'DamageInfo',   // 伤害事件（EVENT 组件）
    SHOOT_COOLDOWN: 'ShootCooldown',
    SHOOT_REQUEST: 'ShootRequest',
    PLAYER_INPUT: 'PlayerInput',
    AI_CTRL: 'AIController',
    RENDER: 'Render',
    TILE: 'Tile',
    ANIMATION: 'Animation',
    DESTROYED: 'Destroyed',
    SPAWN_PROTECT: 'SpawnProtect',
    EXPLOSION: 'Explosion',
    POWERUP: 'PowerUp',
    SCORE: 'Score',
};
