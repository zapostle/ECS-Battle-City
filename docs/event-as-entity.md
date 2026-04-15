# 事件即实体 — ECS 设计原则

## 核心思想

**实体不是"个体"，实体是"事情"。**

当前项目中，实体仍停留在"个体"思维——一个坦克是一个实体，一颗子弹是一个实体。但这只是最浅层的用法。ECS 的真正力量在于：**一切动态过程都是实体**。

### 什么意思？

一个坦克有出生保护——这不是坦克的属性，这是一件"事情"：
- "在30帧后，移除实体#5的 SpawnProtect 组件"
- 这件事情有起始时间、有持续时间、有执行动作、有目标对象
- 它独立于坦克存在——坦克可以被击毁，但保护倒计时仍在运行
- 它可以被取消、加速、替换——只要修改/移除这个事件实体

### 对比

| 旧思维（组件字段） | 新思维（事件实体） |
|---|---|
| `SpawnProtect.frames = 30` 挂在坦克上 | 独立实体：`PendingAction{target=#5, removeComp:'SpawnProtect', frames:30}` |
| `Render.flash = 1` 挂在坦克上 | 独立实体：`PendingAction{target=#5, setComp:'Render.flash', value:0, frames:1}` |
| `Explosion.timer++` 内联计时 | 独立实体：`Explosion + PendingAction{self, addComp:'Destroyed', frames:5}` |
| `ShootCooldown.cooldown--` 内联计时 | 独立实体：`PendingAction{target=#5, setComp:'ShootCooldown.cooldown', value:0, frames:5}` |

### 优势

1. **系统无业务知识**：TimerSystem 不知道"出生保护"、"爆炸"、"闪烁"，只做一件事——倒计时到期执行动作
2. **事件可组合**：一个坦克可以同时有5个 PendingAction 实体指向它，各自独立
3. **事件可查询**："场上还有哪些保护罩？" → 查询所有 `PendingAction{removeComp:'SpawnProtect'}`
4. **事件可取消**："升级道具取消所有负面效果" → 移除所有指向玩家的 PendingAction
5. **事件可替换**："加速道具" → 修改 PendingAction 的 frames 字段

## 重构范围

### 第一阶段：TimerSystem → PendingActionSystem

当前的 TimerSystem 硬编码了三个业务概念：
```
for SpawnProtect → frames--
for Explosion → timer++ / check maxTimer
for Render.flash → flash--
```

重构为通用的 PendingAction 组件：

```js
// PendingAction 组件：一个"在N帧后对目标执行动作"的事件实体
createPendingAction({
    targetId,          // 目标实体ID
    action: 'removeComp' | 'addComponent' | 'setField',
    componentType,     // 操作的组件类型
    value,             // setField 时的值 / addComponent 时的组件数据
    frames,            // 剩余帧数（每帧递减）
})
```

系统逻辑极简：
```js
for entity with PendingAction:
    frames--
    if frames <= 0:
        execute action
        addComponent(entity, DESTROYED)  // 事件完成，自我销毁
```

### 被替换的组件变化

| 旧组件 | 变化 | 事件实体创建方式 |
|---|---|---|
| `SpawnProtect{frames}` | **移除** → 改为 `PendingAction{removeComp:'SpawnProtect'}` | 创建坦克时，额外创建一个事件实体 |
| `Explosion{timer, maxTimer}` | **简化** → 只保留 `size`，倒计时由 PendingAction 驱动 | 创建爆炸时，同时创建 PendingAction |
| `Render.flash` | **移除** → 改为 `PendingAction{setField:'flash', value:0}` | DamageSystem 受击时创建 |
| `ShootCooldown{cooldown}` | **保留字段但移除自减逻辑** → 由 PendingAction 归零 | 射击时创建 `PendingAction{setField:'cooldown', value:0}` |

### 为什么不把所有组件字段都变成事件？

不是所有字段都应该变成事件。判断标准：
- **会随时间自动变化的** → 应该是事件实体（保护倒计时、冷却倒计时、闪烁倒计时）
- **只在被触发时才变化的** → 保持为组件字段（HP扣减、方向变更、位置更新）

简单说：**时间驱动 = 事件实体，事件驱动 = 组件字段**。

## 后续扩展

有了 PendingAction 实体后，可以轻松实现：
- 延迟爆炸（地雷：创建后5秒爆炸）
- 中毒效果（每10帧扣1HP，重复N次）
- 冰冻效果（30帧内无法移动）
- 加速道具（60帧内速度×2）

这些都不需要新系统，只需要创建不同参数的 PendingAction 实体。
