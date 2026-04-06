// =============================================================================
// 射击系统 - 处理玩家和AI的射击请求，管理子弹的生成与飞行
// Natural Order: 当 ShootRequest 或 PlayerInput.shoot 存在时创建子弹实体
// 执行顺序: 在 MovementSystem 之后、CollisionSystem 之前
// =============================================================================

import { COMP, DIR, DIR_VEC, BULLET_SPEED, TILE } from '../Constants.js';
import { createPosition, createDirection, createVelocity, createCollision, createBullet, createRender, createAnimation } from '../Components.js';

export function ShootSystem(world) {
    const mapData = world.getComponent(1, COMP.STAGE)?.mapData;
    if (!mapData) return;

    // ==================== 处理玩家的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.PLAYER_INPUT)) {
        const input = world.getComponent(entityId, COMP.PLAYER_INPUT);
        const shootCd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (!input || !shootCd || !dir || !pos) continue;
        // 条件: 有射击输入 且 冷却结束
        if (!input.shoot || shootCd.cooldown > 0) continue;

        // 消费射击请求并重置冷却
        input.shoot = false;
        shootCd.cooldown = shootCd.maxCooldown;
        // 生成子弹实体
        spawnBullet(world, entityId, dir.dir, pos.x, pos.y);
    }

    // ==================== 处理 AI 的射击请求 ====================
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_REQUEST)) {
        const dir = world.getComponent(entityId, COMP.DIRECTION);
        const pos = world.getComponent(entityId, COMP.POSITION);

        if (dir && pos) {
            spawnBullet(world, entityId, dir.dir, pos.x, pos.y);
        }
        // 消费射击请求事件组件（一次性事件）
        world.removeComponent(entityId, COMP.SHOOT_REQUEST);
    }

    // ==================== 移动所有子弹 ====================
    for (const bulletId of world.getEntitiesWith(COMP.BULLET)) {
        const pos = world.getComponent(bulletId, COMP.POSITION);
        const dir = world.getComponent(bulletId, COMP.DIRECTION);
        const bullet = world.getComponent(bulletId, COMP.BULLET);

        if (!pos || !dir || !bullet) continue;

        // 沿子弹方向以 BULLET_SPEED 速度移动
        const vec = DIR_VEC[dir.dir];
        pos.x += vec[0] * BULLET_SPEED;
        pos.y += vec[1] * BULLET_SPEED;

        // 边界检查：飞出地图则标记销毁
        if (pos.x < 0 || pos.x > 26 * 16 || pos.y < 0 || pos.y > 26 * 16) {
            world.addComponent(bulletId, COMP.DESTROYED, {});
        }
    }

    // ==================== 更新所有射击冷却计时器 ====================
    for (const entityId of world.getEntitiesWith(COMP.SHOOT_COOLDOWN)) {
        const cd = world.getComponent(entityId, COMP.SHOOT_COOLDOWN);
        if (cd.cooldown > 0) cd.cooldown--;  // 冷却倒计时递减
    }
}

// 内部函数：在指定位置生成一颗子弹实体
function spawnBullet(world, ownerId, dir, x, y) {
    const vec = DIR_VEC[dir];
    const bulletId = world.createEntity();  // 创建新的子弹实体

    // 计算子弹出生偏移：在坦克炮管顶端（前方10单位处）生成
    const offset = 10;
    world.addComponent(bulletId, COMP.POSITION, createPosition(
        x + vec[0] * offset,
        y + vec[1] * offset
    ));
    // 子弹继承发射者的方向
    world.addComponent(bulletId, COMP.DIRECTION, createDirection(dir));
    world.addComponent(bulletId, COMP.VELOCITY, createVelocity());
    world.addComponent(bulletId, COMP.COLLISION, createCollision(3, 3));  // 小型碰撞体(3x3)
    world.addComponent(bulletId, COMP.BULLET, createBullet(ownerId, 1));  // 记录所有者和威力
    world.addComponent(bulletId, COMP.RENDER, createRender('bullet', '#FFFFFF'));  // 白色子弹
}
