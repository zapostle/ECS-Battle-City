// =============================================================================
// 计时系统 - 纯数据转换：递减/递增组件中的计时字段
// Natural Order ECS 核心理念：系统不知道游戏的存在，只根据筛选规则改变组件数据
//
// 职责（全部是纯数据转换，零游戏概念）：
//   1. SpawnProtect.frames-- → 0 时移除组件
//   2. Explosion.timer++ → >= maxTimer 时添加 Destroyed
//   3. Render.flash-- → 0 时归零
// =============================================================================

import { COMP } from '../Constants.js';

export function TimerSystem(world, env) {
    // ==================== 1. 出生保护倒计时 ====================
    // 纯数据规则：SpawnProtect.frames > 0 → 递减，归零则移除
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_PROTECT)) {
        const sp = world.getComponent(entityId, COMP.SPAWN_PROTECT);
        sp.frames--;
        if (sp.frames <= 0) {
            world.removeComponent(entityId, COMP.SPAWN_PROTECT);
        }
    }

    // ==================== 2. 爆炸动画计时 ====================
    // 纯数据规则：Explosion.timer 递增，到达 maxTimer → 添加 Destroyed 事件组件
    // Natural Order: Destroyed 的出现自然驱动 CleanupSystem 去销毁实体
    for (const entityId of world.getEntitiesWith(COMP.EXPLOSION)) {
        const exp = world.getComponent(entityId, COMP.EXPLOSION);
        exp.timer++;
        if (exp.timer >= exp.maxTimer) {
            world.addComponent(entityId, COMP.DESTROYED, {});
        }
    }

    // ==================== 3. 渲染闪烁倒计时 ====================
    // 纯数据规则：Render.flash > 0 → 递减
    for (const entityId of world.getEntitiesWith(COMP.RENDER)) {
        const render = world.getComponent(entityId, COMP.RENDER);
        if (render.flash > 0) render.flash--;
    }
}
