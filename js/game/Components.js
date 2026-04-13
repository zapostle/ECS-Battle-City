// =============================================================================
// 组件工厂函数 - 纯数据容器（使用引用语义）
// Natural Order ECS 中 C(Component) = Data Carrier 的具体实现
// 每个函数返回一个纯数据对象，不包含任何行为逻辑
// =============================================================================

// ------------------- 位置与运动相关组件 -------------------

// 位置组件: 存储 x,y 坐标（单位：游戏像素）
export function createPosition(x, y) {
    return { x: x || 0, y: y || 0 };
}

// 方向组件: 存储当前朝向 (0=上, 1=右, 2=下, 3=左)
// 注意: 这是纯朝向（用于渲染），不控制是否移动
export function createDirection(dir = 0) {
    return { dir };
}

// 速度组件: 存储移动速度和是否正在移动的标志
export function createVelocity() {
    return { speed: 0, moving: false };
}

// ------------------- 坦克身份相关组件 -------------------

// 坦克类型组件: 标识是玩家还是敌人，以及对应的颜色key
export function createTankType(type, colorKey) {
    return { type, colorKey: colorKey || 'enemy1' };
}

// 生命值组件: 当前HP和最大HP
export function createHP(hp) {
    return { hp, maxHp: hp };
}

// 碰撞体组件: AABB(轴对齐包围盒)的半宽半高，以及阻挡等级
export function createCollision(halfW, halfH, blockLevel = 1) {
    return { halfW: halfW || 7, halfH: halfH || 7, blockLevel };
}

// ------------------- 战斗相关组件 -------------------

// 子弹组件: 标记实体为子弹，记录所有者ID和威力
export function createBullet(ownerId, power = 1) {
    return { ownerId, power };
}

// 伤害信息组件: EVENT组件 - 由 CollisionSystem 产生，DamageSystem 消费并移除
// 这是 Natural Order ECS 核心模式的体现：事件组件只存在一帧
export function createDamageInfo(attackerId, damage, tags = []) {
    return { attackerId, damage, tags };
}

// 射击冷却组件: 记录距离下次可射击的剩余帧数和最大冷却时间
export function createShootCooldown(frames = 0, maxCooldown = 30) {
    return { cooldown: frames, maxCooldown };
}

// ------------------- 输入与AI相关组件 -------------------

// 玩家输入组件: 由 InputSystem 每帧更新，存储期望的移动方向和射击指令
export function createPlayerInput() {
    return { dir: -1, shoot: false };  // dir=-1 表示无输入
}

// AI控制器组件: 敌人坦克的人工智能行为参数
export function createAIController(behavior = 'patrol') {
    return {
        behavior,       // 行为模式: 'patrol'(巡逻) | 'chase'(追踪) | 'guard'(守卫)
        thinkTimer: 0,  // 思考倒计时: 距离下次AI决策的帧数
        moveTimer: 0,   // 移动计时: 当前移动动作的持续帧数
        moveDir: 2,     // 移动方向: 默认向下(DOWN=2)
        shootChance: 0.02 // 每帧射击概率 (约2%)
    };
}

// ------------------- 渲染相关组件 -------------------

// 渲染信息组件: 控制实体的绘制方式
export function createRender(type, color, zIndex = 0) {
    return { type, color, zIndex, flash: 0 };  // flash: 受击闪烁剩余帧数
}

// 地图瓦片组件: 静态地图元素的类型标识
export function createTile(tileType) {
    return { tileType };
}

// 动画组件: 基于帧的动画状态机
export function createAnimation(totalFrames, loop = true) {
    return { frame: 0, totalFrames, loop, timer: 0, done: false };
}

// ------------------- 状态管理组件 -------------------

// 销毁标记组件: 标记实体将在帧末被延迟销毁
export function createDestroyed() {
    return {};
}

// 出生保护组件: 刷新后的一段无敌时间（帧数）
export function createSpawnProtect(frames = 120) {
    return { frames };
}

// 爆炸效果组件: 视觉爆炸动画参数（size=1小爆炸, size=2大爆炸）
export function createExplosion(size = 1) {
    return { size, timer: 0, maxTimer: size === 1 ? 8 : 20 };  // 小爆炸8帧, 大爆炸20帧
}

// 道具组件: 地图上的能力增强道具（预留功能）
export function createPowerUp(powerType) {
    return { powerType, timer: 600 };  // 600帧后自动消失（约10秒@60FPS）
}

// 分数组件: 追踪玩家得分
export function createScore() {
    return { value: 0, combo: 0 };
}

// 生成计时器组件: 驱动 SpawnSystem 周期性创建实体
// 系统不硬编码"生成什么"，而是通过 template 和 onSpawn 描述
export function createSpawnTimer({ timer, interval, repeat = true, maxActive = 0, activeCount = 0, onSpawn = null }) {
    return { timer, interval, repeat, maxActive, activeCount, onSpawn };
}

// 复活组件: 驱动 RespawnSystem 在倒计时归零后重建实体
// 替代 env.respawnTimer —— 将复活状态从全局环境移到实体组件上
// 复活模板存储在 Lives.respawnTemplate 上（闭包注入），而非此组件
export function createRespawn(frames) {
    return { frames };
}

// 击杀奖励组件: 声明击杀此实体后给予击杀者的分数奖励
// DamageSystem 死亡处理时检查此组件，将奖励加到击杀者的 Score 上
export function createKillReward(score) {
    return { score: score || 0 };
}

// 生命数组件: 声明实体的剩余生命数
// DamageSystem 死亡处理时检查此组件：
//   - lives > 0 → 添加 Respawn 组件（而非直接销毁）
//   - lives <= 0 → 彻底销毁（不再复活）
export function createLives(lives) {
    return { lives: lives ?? 1 };
}
