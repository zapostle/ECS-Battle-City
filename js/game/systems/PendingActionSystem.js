// =============================================================================
// 待执行动作系统 - "事件即实体"的核心执行引擎
//
// 设计哲学：
//   实体不是"个体"，实体是"事情"。
//   PendingAction 是一个"N帧后对目标执行动作"的事件实体，
//   本系统只做一件事：倒计时到期 → 执行动作 → 销毁自身。
//
// 本系统不包含任何业务知识：
//   - 不知道"出生保护"、"爆炸"、"闪烁"是什么
//   - 只知道：frames-- → 归零时按 action 类型执行操作
//
// action 类型：
//   'removeComp'  → world.removeComponent(targetId, componentType)
//   'addComp'     → world.addComponent(targetId, componentType, value)
//   'setField'    → world.getComponent(targetId, componentType)[field] = value
//   'callback'    → value(world, env, targetId)
//
// 通用规则：Explosion.timer++（动画进度递增，非业务逻辑）
//
// Natural Order: 在 DamageSystem 之后运行
// =============================================================================

import { COMP } from '../Constants.js';

export function PendingActionSystem(world, env) {
    // ==================== 通用规则：动画进度递增 ====================
    // Explosion.timer++ 是纯数据驱动的通用动画进度，不涉及业务判断
    for (const entityId of world.getEntitiesWith(COMP.EXPLOSION)) {
        const exp = world.getComponent(entityId, COMP.EXPLOSION);
        if (exp) exp.timer++;
    }

    // ==================== 核心逻辑：PendingAction 倒计时与执行 ====================
    for (const entityId of world.getEntitiesWith(COMP.PENDING_ACTION)) {
        const pa = world.getComponent(entityId, COMP.PENDING_ACTION);
        if (!pa) continue;

        // ---- 倒计时递减 ----
        pa.frames--;

        if (pa.frames > 0) continue;  // 还没到期

        // ---- 执行动作 ----
        const targetId = pa.targetId;
        const action = pa.action;
        const compType = pa.componentType;

        switch (action) {
            case 'removeComp':
                if (targetId != null && world.hasComponent(targetId, compType)) {
                    world.removeComponent(targetId, compType);
                }
                break;

            case 'addComp':
                if (targetId != null) {
                    world.addComponent(targetId, compType, pa.value || {});
                }
                break;

            case 'setField':
                if (targetId != null && pa.field) {
                    const comp = world.getComponent(targetId, compType);
                    if (comp) {
                        comp[pa.field] = pa.value;
                    }
                }
                break;

            case 'callback':
                if (typeof pa.value === 'function') {
                    pa.value(world, env, targetId);
                }
                break;
        }

        // ---- 事件完成，自我销毁 ----
        world.addComponent(entityId, COMP.DESTROYED, {});
    }
}
