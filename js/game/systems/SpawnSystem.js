// =============================================================================
// 生成系统 - 根据 SpawnTimer 组件创建新实体
// Natural Order ECS 理念：系统只根据筛选规则改变组件数据，不硬编码游戏实体类型
//
// 规则32: SpawnTimer.timer--
// 规则33: 归零+activeCount<maxActive → onSpawn回调创建实体
// ★ 新增规则: enemiesSpawned >= maxEnemies → 自动移除 SpawnTimer（替代 Game._spawnEnemy 中的逻辑）
//
// 重构：
//   - enemiesSpawned/maxEnemies 从 SpawnTimer 组件读取（替代 env 同名字段）
//   - 生成数达上限时自动移除 SpawnTimer 组件（替代外部检查）
// =============================================================================

import { COMP } from '../Constants.js';

export function SpawnSystem(world, env) {
    for (const entityId of world.getEntitiesWith(COMP.SPAWN_TIMER)) {
        const st = world.getComponent(entityId, COMP.SPAWN_TIMER);

        // ★ 规则: 已生成数达到上限 → 移除 SpawnTimer 组件
        if (st.maxEnemies > 0 && st.enemiesSpawned >= st.maxEnemies) {
            world.removeComponent(entityId, COMP.SPAWN_TIMER);
            continue;
        }

        // 检查生成条件：maxActive 限制场上同类实体数量
        if (st.maxActive > 0 && st.activeCount >= st.maxActive) {
            continue;
        }

        // 规则32: 递减计时器
        st.timer--;

        if (st.timer <= 0) {
            // 规则33: 执行生成回调
            if (typeof st.onSpawn === 'function') {
                st.onSpawn(world, env, st);
            }

            // 重置或移除
            if (st.repeat) {
                st.timer = st.interval;
            } else {
                world.removeComponent(entityId, COMP.SPAWN_TIMER);
            }
        }
    }
}
