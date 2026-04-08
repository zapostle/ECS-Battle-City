// =============================================================================
// 伤害系统 - 处理 DamageInfo 事件组件
// Natural Order 核心模式的最佳体现：
//   - 触发条件: HP组件 和 DamageInfo组件 同时存在于同一实体上
//   - 处理流程: Add( CollisionSystem添加 ) → Process( 本系统处理 ) → Remove( 移除 )
//   - DamageInfo 只存在一帧，天然保证伤害只处理一次
// =============================================================================

import { COMP } from '../Constants.js';

export function DamageSystem(world) {
    const stageId = world.findEntity(COMP.STAGE);
    const stageComp = stageId ? world.getComponent(stageId, COMP.STAGE) : null;
    if (!stageComp) return;

    // 遍历所有同时拥有 HP 和 DamageInfo 组件的实体（即刚受到伤害的实体）
    for (const entityId of world.getEntitiesWithAll(COMP.HP, COMP.DAMAGE_INFO)) {
        const hp = world.getComponent(entityId, COMP.HP);
        const dmgInfo = world.getComponent(entityId, COMP.DAMAGE_INFO);

        if (!hp || !dmgInfo) continue;

        // ---- 扣除生命值 ----
        hp.hp -= dmgInfo.damage;

        // ---- 触发受击闪烁效果 ----
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render) render.flash = 4;  // 闪烁4帧（白色闪白）

        // ---- 死亡判定 ----
        if (hp.hp <= 0) {
            // 在死亡位置生成大型爆炸效果
            const pos = world.getComponent(entityId, COMP.POSITION);
            if (pos) {
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: pos.x, y: pos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 2, timer: 0, maxTimer: 20 });  // 大爆炸20帧
                world.addComponent(expId, COMP.RENDER, { type: 'explosion', color: '#FF4500', zIndex: 2, flash: 0 });
            }

            // 判断死亡的是否是敌人坦克 → 加分
            const tankType = world.getComponent(entityId, COMP.TANK_TYPE);
            if (tankType && tankType.type === 'enemy') {
                stageComp.enemyCount--;  // 减少剩余敌人数
                // 给所有拥有 Score 组件的实体加分（通常是玩家）
                for (const pid of world.getEntitiesWith(COMP.SCORE)) {
                    const score = world.getComponent(pid, COMP.SCORE);
                    score.value += 100;  // 击杀一个敌人得100分
                }
            }

            // 判断死亡的是否是玩家 → 扣命或游戏结束
            if (tankType && tankType.type === 'player') {
                const stageId = world.findEntity(COMP.STAGE);
                const playerData = stageId ? world.getComponent(stageId, COMP.PLAYER_DATA) : null;
                if (playerData) {
                    playerData.lives--;  // 扣除一条命
                    // 保存当前分数（复活时恢复）
                    const scoreComp = world.getComponent(entityId, COMP.SCORE);
                    if (scoreComp) playerData.score = scoreComp.value;
                    if (playerData.lives > 0) {
                        // 还有命 → 设置复活计时器（90帧后自动复活）
                        playerData.respawnTimer = 90;
                    } else {
                        // 无命可复 → 游戏结束
                        stageComp.state = 'gameover';
                    }
                }
            }

            // 标记实体为待销毁（由 StageSystem 在帧末统一清理）
            world.addComponent(entityId, COMP.DESTROYED, {});
        }

        // ★★★ 关键步骤: 消费（移除）事件组件 ★★★
        // 这就是 Natural Order ECS 的核心模式 —— DamageInfo 是一个 EVENT 组件：
        //   - CollisionSystem 在碰撞时 ADD 它
        //   - DamageSystem 在这里 PROCESS 并 REMOVE 它
        //   - 下一帧 DamageInfo 不再存在 → DamageSystem 不会再触发 → 伤害不会重复计算
        world.removeComponent(entityId, COMP.DAMAGE_INFO);
    }
}
