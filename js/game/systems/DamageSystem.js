// =============================================================================
// 伤害系统 - 处理 DamageInfo 事件组件
// Natural Order 核心模式的最佳体现：
//   - 触发条件: HP组件 和 DamageInfo组件 同时存在于同一实体上
//   - 处理流程: Add( CollisionSystem添加 ) → Process( 本系统处理 ) → Remove( 移除 )
//   - DamageInfo 只存在一帧，天然保证伤害只处理一次
// =============================================================================

import { COMP } from '../Constants.js';

export function DamageSystem(world, env) {  // ★ 规范签名: (world, env) — 直接使用 env 参数 (Rule 6)
    if (!env || env.state !== 'playing') return;

    const KILL_SCORE = env.config.combat.KILL_SCORE;
    const EXPLOSION_LARGE_FRAMES = env.config.animation.EXPLOSION_LARGE_FRAMES;
    const HIT_FLASH_FRAMES = env.config.animation.HIT_FLASH_FRAMES;
    const RESPAWN_DELAY = env.config.combat.RESPAWN_DELAY;

    // 遍历所有同时拥有 HP 和 DamageInfo 组件的实体
    for (const entityId of world.getEntitiesWithAll(COMP.HP, COMP.DAMAGE_INFO)) {
        const hp = world.getComponent(entityId, COMP.HP);
        const dmgInfo = world.getComponent(entityId, COMP.DAMAGE_INFO);

        if (!hp || !dmgInfo) continue;

        // ---- 扣除生命值 ----
        hp.hp -= dmgInfo.damage;

        // ---- 触发受击闪烁效果 ----
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render) render.flash = HIT_FLASH_FRAMES;

        // ---- 死亡判定 ----
        if (hp.hp <= 0) {
            const pos = world.getComponent(entityId, COMP.POSITION);
            if (pos) {
                const expId = world.createEntity();
                world.addComponent(expId, COMP.POSITION, { x: pos.x, y: pos.y });
                world.addComponent(expId, COMP.EXPLOSION, { size: 2, timer: 0, maxTimer: EXPLOSION_LARGE_FRAMES });
                world.addComponent(expId, COMP.RENDER, { type: 'explosion', color: '#FF4500', zIndex: 2, flash: 0 });
            }

            const tankType = world.getComponent(entityId, COMP.TANK_TYPE);
            if (tankType && tankType.type === 'enemy') {
                // ★ 通过环境修改全局状态
                env.enemyCount--;
                for (const pid of world.getEntitiesWith(COMP.SCORE)) {
                    const score = world.getComponent(pid, COMP.SCORE);
                    score.value += KILL_SCORE;
                }
            }

            if (tankType && tankType.type === 'player') {
                // ★ 通过环境读取/修改玩家数据（不再查 stage 实体）
                env.playerLives--;
                const scoreComp = world.getComponent(entityId, COMP.SCORE);
                if (scoreComp) env.playerScore = scoreComp.value;
                if (env.playerLives > 0) {
                    env.respawnTimer = RESPAWN_DELAY;
                } else {
                    env.state = 'gameover';
                }
            }

            world.addComponent(entityId, COMP.DESTROYED, {});
        }

        world.removeComponent(entityId, COMP.DAMAGE_INFO);
    }
}
