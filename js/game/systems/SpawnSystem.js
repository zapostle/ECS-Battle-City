// =============================================================================
// 生成系统 - 根据生成计时器组件创建新实体
// Natural Order ECS 理念：系统只根据筛选规则改变组件数据，不硬编码游戏实体类型
//
// 职责：
//   - 遍历所有 SpawnTimer 组件，递减计时
//   - 计时归零时：执行生成回调（通过组件数据描述要创建的实体）
//   - 生成后重置计时器（循环生成）或移除组件（单次生成）
//
// 解耦设计：
//   - 本系统不知道"敌人"、"玩家"、"道具"等游戏概念
//   - 生成什么实体、在哪里生成、生成后配置什么组件，全部由 SpawnTimer 组件数据决定
//   - SpawnTimer.template 描述实体模板，SpawnTimer.onSpawn 回调负责具体创建
// =============================================================================

import { COMP } from '../Constants.js';

export function SpawnSystem(world, env) {
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
        const st = world.getComponent(entityId, COMP.SPAWN_TIMER);

        // 检查生成条件：maxActive 限制场上同类实体数量
        if (st.maxActive > 0 && st.activeCount >= st.maxActive) {
            continue;  // 场上实体已满，跳过本帧
        }

        // 递减计时器
        st.timer--;

        if (st.timer <= 0) {
            // 执行生成：调用 onSpawn 回调创建新实体
            if (typeof st.onSpawn === 'function') {
                st.onSpawn(world, env, st);
            }

            // 重置或移除
            if (st.repeat) {
                st.timer = st.interval;  // 循环生成：重置计时器
            } else {
                world.removeComponent(entityId, COMP.SPAWN_TIMER);  // 单次生成：移除组件
            }
        }
    }
}
