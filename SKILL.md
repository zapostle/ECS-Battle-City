# Natural Order ECS — Battle City 技能文档

## 核心哲学

### 四大基本真理

1. **E (Entity) = Event** — 实体是事件，不是对象。一个逻辑游戏对象可由多个 Entity 组成
2. **C (Component) = Data Carrier** — 组件是纯数据容器，使用引用语义跨系统共享
3. **S (System) = Pure Function** — 系统是纯函数 `fn(world, env) → void`，不知道其他系统存在
4. **Env (Environment) = Context** — 环境是全局上下文，三层：config（静态）+ providers（服务）+ frameCount/deltaTime（引擎运行时）

### ★ 核心原则：动态变量 = 组件

> **游戏中所有动态变化的值都是组件。组件变化的规则就是系统。规则是世界运行的根基。**

这条原则决定了数据存放的位置：

| 数据性质 | 存放位置 | 示例 |
|---------|---------|------|
| **静态配置**（运行时不变） | `env.config` | 速度、尺寸、颜色、冷却帧数 |
| **动态值**（运行时可变） | **ECS 组件** | 关卡号、地图数据、生成计数、游戏状态 |
| **引擎运行时**（框架级） | `env.frameCount/deltaTime` | 帧计数、帧间隔 |
| **服务提供者**（无状态） | `env.providers` | 随机数生成器 |

**env 中不应存在任何动态游戏数据** — 如果一个值在游戏运行中会改变，它必须是一个组件。

#### 迁移示例

| 旧位置（env 动态字段） | 新位置（组件） | 查询方式 |
|---------------------|-------------|---------|
| `env.state` | `GameState.state` | `view.getGameState()` |
| `env.level` | `GameState.level` | `view.getLevel()` |
| `env.mapData` | `GameMap.data` | `view.getMapData()` |
| `env.enemiesSpawned` | `SpawnTimer.enemiesSpawned` | `st.enemiesSpawned` |
| `env.maxEnemies` | `SpawnTimer.maxEnemies` | `st.maxEnemies` |
| `env.playerScore` | `Score.value` | `view.getComponent(id, COMP.SCORE)` |
| `env.playerLives` | `Lives.lives` | `view.getComponent(id, COMP.LIVES)` |

## 设计规则

### Rule 1: 一帧 = 一个原子时刻
系统检查当前状态快照，不建模过程

### Rule 2: 事件组件消费一次
DamageInfo / ShootRequest / Destroyed：Add → Process → Remove

### Rule 3: 系统按组件共存查询
要求组件越多，触发条件越特定

### Rule 4: 组件必须是引用类型
共享实例，不复制值

### Rule 5: 系统互不知晓
无系统间调用或状态检查

### Rule 6: 所有外部依赖通过 Environment 注入
不直接访问全局 API（random、config 等）

## 系统规则精化

每个系统只负责自己领域的规则，不越权写其他系统的组件：

### InputSystem（规则1-2）
- 规则1: `keyState + PlayerInput → Input.dir`
- 规则2: `keyState.shoot → Input.shoot`

### AISystem（规则3-6）
- 规则3: `AI_CTRL.thinkTimer--`（每帧递减）
- 规则4: `thinkTimer≤0 → AI_CTRL.moveDir=随机`
- 规则5: `random()<CHASE_CHANCE → 追踪玩家方向`
- 规则6: `random()<shootChance → ShootRequest`
- ★ **不写** `dirComp.dir` — 规则7归 MovementSystem

### MovementSystem（规则7-9）
- 规则7: `Input.dir / AI_CTRL.moveDir → Direction.dir`（同步朝向）
- 规则8: `dir + speed → Position.x/y 更新`
- 规则9: 边界检测 → Position 钳制

### ShootSystem（规则10-14）
- 规则10: `Input.shoot + CD就绪 → 创建子弹实体`
- 规则11: `ShootRequest存在 → 创建子弹实体`
- 规则12: `Bullet.Position += 方向×速度`
- 规则13: `子弹出界 → Destroyed`
- 规则14: `ShootCooldown.cooldown--`
- ★ **不检查** `mapData` — 子弹飞行不依赖地图

### CollisionSystem（规则15-18）
- 规则15: `Tank vs 地图碰撞 → Position回滚`
- 规则16: `Tank vs Tank → 互相推开Position`
- 规则17: `Bullet vs 地图 → Destroyed + 炸瓦片`
- 规则18: `Bullet vs Tank → DamageInfo事件`
- ★ **从 GameMap 组件读地图**（非 env.mapData）
- ★ **写 GameState 组件**（非 env.state）

### DamageSystem（规则19-26）
- 规则19: `HP.hp -= DamageInfo.damage`
- 规则20: `受击 → Render.flash = HIT_FLASH`
- 规则21: `HP≤0 → Explosion实体 + Destroyed`
- 规则22: `KillReward → Score.value += 奖励`
- 规则23: `AI死亡 → SpawnTimer.activeCount--`
- 规则24: `Lives>0 → Lives.lives-- + Respawn`
- 规则25: `Lives耗尽 → GameState.state='gameover'`
- 规则26: `消费DamageInfo（Rule 2）`

### TimerSystem（规则27-30）
- 规则27: `SpawnProtect.frames-- → 0移除`
- 规则28: `Explosion.timer++ → ≥maxTimer→Destroyed`
- 规则29: `Render.flash--`

### RespawnSystem（规则28-31）
- 规则28: `Respawn.frames--`
- 规则29: `归零→清除旧组件+重建模板`
- 规则30: `恢复Lives+Score数据`
- 规则31: `移除Respawn组件`

### SpawnSystem（规则32-33）
- 规则32: `SpawnTimer.timer--`
- 规则33: `归零+activeCount<maxActive → onSpawn创建实体`
- ★ **enemiesSpawned >= maxEnemies → 自动移除 SpawnTimer**

### CleanupSystem（规则33-34）
- 规则33: `Destroyed + !Respawn → 销毁实体`
- 规则34: `消费Destroyed事件组件`

### VictorySystem（规则35-36）
- 规则35: `!SpawnTimer存在 + !AI存活 → 胜利`
- 规则36: `胜利 → GameState.state='victory'`

## UI-ECS 解耦架构

### 单向数据流

```
System 写组件 → World 存储 → WorldView 只读 → UI Renderer
```

系统不知道 UI 存在，UI 不知道系统存在。

### WorldView 便捷查询

| 方法 | 数据源 | 替代 |
|------|--------|------|
| `view.getGameState()` | GameState 组件 | env.state |
| `view.getLevel()` | GameState.level | env.level |
| `view.getMapData()` | GameMap.data | env.mapData |
| `view.getFrameCount()` | GameState.frameCount | env.frameCount |
| `view.countAliveEntitiesWith(COMP.AI_CTRL)` | 实时统计 | env.enemyCount |

### Environment 精简后只保留

```
env.config    — 静态只读配置（GameConfig 冻结对象）
env.providers — 无状态服务（random 等）
env.frameCount — 引擎帧计数
env.deltaTime  — 引擎帧间隔
```

## 单例组件清单

| 组件 | 存储数据 | 创建位置 |
|------|---------|---------|
| `GameState` | state, level, frameCount | Game._setupWorld() |
| `GameMap` | data (26×26 瓦片数组) | Game._setupWorld() |
| `SpawnTimer` | timer, interval, activeCount, enemiesSpawned, maxEnemies | Game._setupWorld() |
