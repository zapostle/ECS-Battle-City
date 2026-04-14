# 🎮 Battle City — Natural Order ECS

> 🤖 **Human Thought, AI Implementation** | 👨‍💻 人脑构思，AI实现  
> *Where ideas are born in human minds and brought to life by AI code!*

[中文](#中文) | [English](#english)

---

<a id="english"></a>

## Overview

A classic **Battle City** (tank battle) game built with a custom **Natural Order ECS** architecture in vanilla JavaScript. This project demonstrates how Entity-Component-System design principles can create clean, decoupled game logic where system execution order emerges **naturally from component state transitions** — without explicit `.before()` / `.after()` declarations.

## Architecture Highlights

### Natural Order ECS Philosophy

| Concept | Role | Implementation |
|---------|------|---------------|
| **E (Entity)** | Event, not object | Pure ID (integer) — zero-overhead identifier |
| **C (Component)** | Data Carrier | Reference-type objects shared across systems |
| **S (System)** | Pure Function | `fn(world, env) → void` — observes state, performs one atomic action |
| **Env (Environment)** | Context/Resource | Three-layer: `config` (static) + `state` (dynamic) + `providers` (side-effects) |

**Key Insight**: System execution order emerges from component lifecycle. When `DamageInfo` is added by `CollisionSystem`, `DamageSystem` naturally processes it because it queries for entities with both `HP` + `DamageInfo`. No explicit ordering needed.

### Component-Rule Theory

> "All dynamically changing values are Components. The rules governing their changes are Systems. Rules are the foundation of the world."

Each rule maps to code in a System:

```
Rule:  keyState + PlayerInput → Input direction
Rule:  Direction + speed → Position update
Rule:  Bullet vs Tank collision → DamageInfo event
Rule:  HP ≤ 0 + KillReward → Score increase
Rule:  Lives > 0 → Respawn component added
Rule:  No enemies alive → Victory state
```

Enumerating all rules = discovering all systems.

### UI-ECS Decoupling

UI rendering is completely separated from ECS logic via **unidirectional data flow**:

```
Systems (write components) → World → WorldView (read-only) → UIRenderer
                                                ↕
                                          DataChannel (subscribe)
```

| Pattern | Purpose |
|---------|---------|
| **WorldView** | Read-only query interface — UI never writes components |
| **DataChannel** | Dirty-check + subscription — notify UI on data changes |
| **GameState component** | Singleton entity — replaces `env.state` global variable |
| **Scene-based UI** | TitleScene / PlayingScene / GameOverScene / VictoryScene |

**Result**: Systems don't know UI exists. UI doesn't know systems exist.

## Project Structure

```
tankWebGL/
├── index.html                  # Entry point
├── serve.js                    # Dev server (Node.js)
├── start.bat                   # Windows quick-start script
└── js/
    ├── ecs/                    # ECS Framework Core
    │   ├── SparseSet.js        # O(1) entity-component mapping
    │   ├── World.js            # Entity container + system runner
    │   ├── Environment.js      # Global context (config/state/providers)
    │   ├── WorldView.js        # Read-only view for UI queries
    │   └── DataChannel.js      # Dirty-check subscription channel
    ├── game/
    │   ├── Game.js             # Main loop + state management
    │   ├── GameConfig.js       # Static game parameters (frozen)
    │   ├── Constants.js        # Component type names (COMP enum)
    │   ├── Components.js       # Component factory functions
    │   ├── Levels.js           # Level map data
    │   ├── EntityMonitor.js    # Entity debug monitor
    │   ├── systems/            # ECS Systems (pure functions)
    │   │   ├── InputSystem.js
    │   │   ├── AISystem.js
    │   │   ├── MovementSystem.js
    │   │   ├── ShootSystem.js
    │   │   ├── CollisionSystem.js
    │   │   ├── DamageSystem.js
    │   │   ├── TimerSystem.js
    │   │   ├── SpawnSystem.js
    │   │   ├── RespawnSystem.js
    │   │   ├── CleanupSystem.js
    │   │   └── VictorySystem.js
    │   └── ui/                 # UI Layer (decoupled from ECS)
    │       ├── UIRenderer.js   # Scene router
    │       ├── TitleScene.js
    │       ├── PlayingScene.js # Game rendering + HUD
    │       ├── GameOverScene.js
    │       └── VictoryScene.js
```

## System Pipeline (Natural Order)

```
InputSystem → AISystem → MovementSystem → ShootSystem → CollisionSystem
    → DamageSystem → TimerSystem → SpawnSystem → RespawnSystem
    → CleanupSystem → VictorySystem
```

Order emerges from component dependencies, not explicit declarations:

| System | Reads | Writes | Triggers When |
|--------|-------|--------|--------------|
| InputSystem | keyState | PlayerInput | PlayerInput exists |
| AISystem | AIController | Direction, ShootRequest | AIController exists |
| CollisionSystem | Position, Collision | DamageInfo, Destroyed | Entities overlap |
| DamageSystem | HP, DamageInfo | Score, Lives, Respawn, GameState | HP + DamageInfo coexist |
| CleanupSystem | Destroyed | Entity removal | Destroyed exists (no Respawn) |
| VictorySystem | SpawnTimer, AIController | GameState | No spawners + no AI alive |

## Design Rules

1. **One Tick = One Atomic Moment** — systems check current state, not processes
2. **Event Components Are Consumed Once** — DamageInfo: Add → Process → Remove
3. **Systems Query by Component Coexistence** — more components = more specific trigger
4. **Components Are Reference Types** — shared instances, no value copies
5. **No System Knows Another System** — no inter-system calls or state checks
6. **All External Dependencies Flow Through Environment** — no direct global access

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (any recent version)

### Run

```bash
# Option 1: Use the batch script (Windows)
start.bat

# Option 2: Manual start
node serve.js
```

Open `http://localhost:9000` in your browser.

### Controls

| Key | Action |
|-----|--------|
| `W/A/S/D` or Arrow Keys | Move |
| `Space` or `J` | Shoot |
| `Enter` | Start / Next Stage |
| `L` | Debug: Entity Monitor log |



## Data Flow (UI-ECS Decoupling)

### Before (Coupled)

```
System → env.playerScore → RenderSystem reads env → renders HUD
System → env.state → Game.tick() reads env → draws game over
```

### After (Decoupled)

```
System → writes Score component → World → WorldView → UIRenderer queries Score
System → writes GameState component → World → WorldView → UIRenderer queries GameState
```

| Old (env global) | New (Component + WorldView) |
|-----------------|----------------------------|
| `env.playerScore` | `Score.value` via `view.getComponent()` |
| `env.playerLives` | `Lives.lives` via `view.getComponent()` |
| `env.enemyCount` | `view.countAliveEntitiesWith(COMP.AI_CTRL)` |
| `env.state` | `GameState.state` singleton component |


## Acknowledgments

Thanks to "Monkey and Huaguoshan" (猴与花果山) on Zhihu for teaching ECS architecture knowledge, which gave me new insights into ECS.

## License

MIT

---

<a id="中文"></a>

## 概述

基于自研 **Natural Order ECS** 架构的经典 **坦克大战** 游戏，使用纯 JavaScript 实现。本项目演示了 ECS 设计原则如何创建清晰、解耦的游戏逻辑——系统执行顺序由**组件状态转换自然产生**，无需显式的 `.before()` / `.after()` 声明。

## 架构亮点

### 自然顺序 ECS 哲学

| 概念 | 角色 | 实现方式 |
|------|------|---------|
| **E (Entity)** | 事件，不是对象 | 纯 ID（整数）——零开销标识符 |
| **C (Component)** | 数据载体 | 引用类型对象，跨系统共享同一实例 |
| **S (System)** | 纯函数 | `fn(world, env) → void` ——观察状态，执行一个原子动作 |
| **Env (Environment)** | 上下文/资源 | 三层架构：`config`（静态）+ `state`（动态）+ `providers`（副作用） |

**核心洞察**：系统执行顺序由组件生命周期自然产生。当 `CollisionSystem` 添加 `DamageInfo` 时，`DamageSystem` 自然处理它，因为它查询同时拥有 `HP` + `DamageInfo` 的实体。无需显式排序。

### 组件规则理论

> "游戏中所有动态变化的值都是组件。组件变化的规则就是系统。规则是世界运行的根基。"

每条规则映射到系统中的代码：

```
规则: keyState + PlayerInput → 输入方向
规则: Direction + speed → 位置更新
规则: 子弹 vs 坦克碰撞 → DamageInfo 事件
规则: HP ≤ 0 + KillReward → 分数增加
规则: Lives > 0 → 添加 Respawn 组件
规则: 没有存活敌人 → 胜利状态
```

整理出所有规则 = 发现所有系统。

### UI-ECS 解耦

UI 渲染与 ECS 逻辑通过**单向数据流**完全分离：

```
系统（写组件） → World → WorldView（只读） → UIRenderer
                                    ↕
                              DataChannel（订阅）
```

| 模式 | 用途 |
|------|------|
| **WorldView** | 只读查询接口——UI 永远不写组件 |
| **DataChannel** | 脏检测+订阅——数据变化时通知 UI |
| **GameState 组件** | 单例实体——替代 `env.state` 全局变量 |
| **场景化 UI** | TitleScene / PlayingScene / GameOverScene / VictoryScene |

**结果**：系统不知道 UI 存在。UI 不知道系统存在。

## 项目结构

```
tankWebGL/
├── index.html                  # 入口文件
├── serve.js                    # 开发服务器 (Node.js)
├── start.bat                   # Windows 快速启动脚本
└── js/
    ├── ecs/                    # ECS 框架核心
    │   ├── SparseSet.js        # O(1) 实体-组件映射
    │   ├── World.js            # 实体容器 + 系统运行器
    │   ├── Environment.js      # 全局上下文（config/state/providers）
    │   ├── WorldView.js        # UI 只读查询视图
    │   └── DataChannel.js      # 脏检测订阅通道
    ├── game/
    │   ├── Game.js             # 主循环 + 状态管理
    │   ├── GameConfig.js       # 静态游戏参数（冻结对象）
    │   ├── Constants.js        # 组件类型名称（COMP 枚举）
    │   ├── Components.js       # 组件工厂函数
    │   ├── Levels.js           # 关卡地图数据
    │   ├── EntityMonitor.js    # 实体调试监控器
    │   ├── systems/            # ECS 系统（纯函数）
    │   │   ├── InputSystem.js
    │   │   ├── AISystem.js
    │   │   ├── MovementSystem.js
    │   │   ├── ShootSystem.js
    │   │   ├── CollisionSystem.js
    │   │   ├── DamageSystem.js
    │   │   ├── TimerSystem.js
    │   │   ├── SpawnSystem.js
    │   │   ├── RespawnSystem.js
    │   │   ├── CleanupSystem.js
    │   │   └── VictorySystem.js
    │   └── ui/                 # UI 层（与 ECS 解耦）
    │       ├── UIRenderer.js   # 场景路由器
    │       ├── TitleScene.js
    │       ├── PlayingScene.js # 游戏渲染 + HUD
    │       ├── GameOverScene.js
    │       └── VictoryScene.js
```

## 系统流水线（自然顺序）

```
InputSystem → AISystem → MovementSystem → ShootSystem → CollisionSystem
    → DamageSystem → TimerSystem → SpawnSystem → RespawnSystem
    → CleanupSystem → VictorySystem
```

顺序由组件依赖自然产生，非显式声明：

| 系统 | 读取 | 写入 | 触发条件 |
|------|------|------|---------|
| InputSystem | keyState | PlayerInput | PlayerInput 存在 |
| AISystem | AIController | Direction, ShootRequest | AIController 存在 |
| CollisionSystem | Position, Collision | DamageInfo, Destroyed | 实体重叠 |
| DamageSystem | HP, DamageInfo | Score, Lives, Respawn, GameState | HP + DamageInfo 共存 |
| CleanupSystem | Destroyed | 实体移除 | Destroyed 存在（无 Respawn） |
| VictorySystem | SpawnTimer, AIController | GameState | 无生成器 + 无存活 AI |

## 设计规则

1. **一帧 = 一个原子时刻** ——系统检查当前状态快照，不建模过程
2. **事件组件消费一次** ——DamageInfo：添加 → 处理 → 移除
3. **系统按组件共存查询** ——要求组件越多，触发条件越特定
4. **组件必须是引用类型** ——共享实例，不复制值
5. **系统互不知晓** ——无系统间调用或状态检查
6. **所有外部依赖通过 Environment 注入** ——不直接访问全局 API

## 快速开始

### 前提条件

- [Node.js](https://nodejs.org/)（任何近期版本）

### 运行

```bash
# 方式 1：使用批处理脚本（Windows）
start.bat

# 方式 2：手动启动
node serve.js
```

在浏览器中打开 `http://localhost:9000`。

### 操作方式

| 按键 | 功能 |
|------|------|
| `W/A/S/D` 或方向键 | 移动 |
| `空格` 或 `J` | 射击 |
| `Enter` | 开始 / 下一关 |
| `L` | 调试：实体监控器日志 |



## 数据流（UI-ECS 解耦）

### 之前（耦合）

```
System → env.playerScore → RenderSystem 读 env → 渲染 HUD
System → env.state → Game.tick() 读 env → 绘制游戏结束画面
```

### 之后（解耦）

```
System → 写 Score 组件 → World → WorldView → UIRenderer 查询 Score
System → 写 GameState 组件 → World → WorldView → UIRenderer 查询 GameState
```

| 旧来源（env 全局变量） | 新来源（组件 + WorldView） |
|---------------------|------------------------|
| `env.playerScore` | `Score.value`，通过 `view.getComponent()` 查询 |
| `env.playerLives` | `Lives.lives`，通过 `view.getComponent()` 查询 |
| `env.enemyCount` | `view.countAliveEntitiesWith(COMP.AI_CTRL)` 实时统计 |
| `env.state` | `GameState.state` 单例组件 |


## 致谢

感谢知乎的“猴与花果山”老师对ECS架构知识的传授，让我对ECS有了新的认识和理解。

## 许可证

MIT
