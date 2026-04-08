// =============================================================================
// EntityMonitor - ECS 实体组件监控框架
// 功能:
//   1. 监控指定实体的所有组件（增/删/改）
//   2. 每帧自动对比检测变更
//   3. 控制台实时输出 + 内存日志缓冲
//   4. 支持导出为本地 .log 文件
// 用法:
//   const monitor = new EntityMonitor(entityId, '玩家');
//   monitor.start();              // 开始监控
//   monitor.tick(world);          // 每帧调用（放入游戏循环）
//   monitor.stop();               // 停止监控
//   monitor.exportLog();          // 导出日志文件
// =============================================================================

export class EntityMonitor {
    /**
     * 创建实体监控器
     * @param {number} entityId - 要监控的实体ID
     * @param {string} label - 实体标签（用于日志标识）
     */
    constructor(entityId, label = `Entity#${entityId}`) {
        this.entityId = entityId;
        this.label = label;
        this.enabled = false;           // 监控开关
        this.tickCount = 0;             // 已执行帧数
        this.logBuffer = [];            // 日志缓冲区
        this.prevSnapshot = null;       // 上一帧的组件快照
        this.maxBufferSize = 10000;     // 最大日志条数（防内存溢出）
        this.ignoreComponents = new Set();  // 组件黑名单（被忽略的组件名不打印）

        // 统计数据
        this.stats = {
            totalTicks: 0,
            totalChanges: 0,
            adds: 0,
            removes: 0,
            modifies: 0,
            filtered: 0,               // 被过滤掉的变更数
            startTime: null,
        };
    }

    // ==================== 控制方法 ====================

    /** 启动监控 */
    start() {
        if (this.enabled) return;
        this.enabled = true;
        this.stats.startTime = Date.now();
        this._log('SYSTEM', '🔔', `监控已启动 | 实体ID: ${this.entityId} | 标签: ${this.label}`);
        console.log(`%c[EntityMonitor] %c🔔 监控已启动 | 实体: ${this.label} (ID:${this.entityId})`,
            'color:#888', 'color:#00BFFF;font-weight:bold');
    }

    /** 停止监控 */
    stop() {
        if (!this.enabled) return;
        this.enabled = false;
        const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);
        this._log('SYSTEM', '⏹️', `监控已停止 | 运行时长: ${duration}s | 总帧数: ${this.stats.totalTicks} | 总变更数: ${this.stats.totalChanges} | 过滤: ${this.stats.filtered}`);
        console.log(`%c[EntityMonitor] %c⏹️ 监控已停止 | 时长: ${duration}s | 帧数: ${this.stats.totalTicks} | 变更: ${this.stats.totalChanges} (过滤: ${this.stats.filtered})`,
            'color:#888', 'color:#FF6B6B;font-weight:bold');
    }

    // ==================== 过滤配置 ====================

    /**
     * 添加要忽略的组件名（支持多个）
     * 被忽略的组件仍会被快照记录，但不会打印日志
     * @param  {...string} names - 组件名称列表，如: 'SpawnProtect', 'Position'
     * @returns {this} 支持链式调用
     *
     * @example
     * monitor.ignore('SpawnProtect', 'Position')  // 静默这两个组件的所有变更
     * monitor.unignore('Position')                // 重新启用 Position 的日志
     */
    ignore(...names) {
        for (const name of names) {
            this.ignoreComponents.add(name);
        }
        if (names.length > 0) {
            console.log(`%c[EntityMonitor] %c🔇 已静默组件: [${names.join(', ')}]`, 'color:#888', 'color:#888;font-style:italic');
        }
        return this;
    }

    /**
     * 取消对指定组件的忽略
     * @param  {...string} names - 组件名称列表
     * @returns {this} 支持链式调用
     */
    unignore(...names) {
        for (const name of names) {
            this.ignoreComponents.delete(name);
        }
        if (names.length > 0) {
            console.log(`%c[EntityMonitor] %c🔊 取消静默: [${names.join(', ')}]`, 'color:#888', 'color:#4CAF50');
        }
        return this;
    }

    /** 清空忽略列表（恢复全部组件日志） */
    clearIgnore() {
        const count = this.ignoreComponents.size;
        this.ignoreComponents.clear();
        console.log(`%c[EntityMonitor] %c🔓 已清除所有过滤 (${count}个组件恢复监控)`, 'color:#888', 'color:#4CAF50');
        return this;
    }

    /**
     * 每帧调用：对比组件快照，记录所有变更
     * 应在游戏主循环的 tick() 中、world.tick() 之后调用
     * @param {World} world - ECS World 实例
     */
    tick(world) {
        if (!this.enabled) return;
        this.tickCount++;
        this.stats.totalTicks++;

        // ---- 1. 获取当前帧的组件快照 ----
        const currentSnap = this._captureSnapshot(world);

        // 第一帧：只记录初始状态，不产生 diff
        if (!this.prevSnapshot) {
            this.prevSnapshot = currentSnap;
            this._printInitialReport(currentSnap);
            return;
        }

        // ---- 2. 对比快照，检测增删改 ----
        const prevKeys = new Set(Object.keys(this.prevSnapshot));
        const currKeys = new Set(Object.keys(currentSnap));

        let hasChange = false;

        // 检测新增组件
        for (const key of currKeys) {
            if (!prevKeys.has(key)) {
                hasChange = true;
                if (this.ignoreComponents.has(key)) {
                    this.stats.filtered++;
                    this._log('ADD[F]', '+', `[静默] 新增 [${key}]`, currentSnap[key]);
                } else {
                    this.stats.adds++;
                    this.stats.totalChanges++;
                    this._log('ADD', '+', `新增组件 [${key}]`, currentSnap[key]);
                    console.log(
                        `%c[EntityMonitor] %c+ ADD    %c[${key}]`,
                        'color:#888', 'color:#32CD32;font-weight:bold', 'color:#2E8B57',
                        currentSnap[key]
                    );
                }
            }
        }

        // 检测删除组件
        for (const key of prevKeys) {
            if (!currKeys.has(key)) {
                hasChange = true;
                if (this.ignoreComponents.has(key)) {
                    this.stats.filtered++;
                    this._log('REMOVE[F]', '-', `[静默] 移除 [${key}]`, this.prevSnapshot[key]);
                } else {
                    this.stats.removes++;
                    this.stats.totalChanges++;
                    const oldData = this.prevSnapshot[key];
                    this._log('REMOVE', '-', `移除组件 [${key}]`, oldData);
                    console.log(
                        `%c[EntityMonitor] %c- REMOVE %c[${key}]`,
                        'color:#888', 'color:#FF4444;font-weight:bold', 'color:#AA0000',
                        oldData
                    );
                }
            }
        }

        // 检测修改的组件（浅比较值）
        for (const key of currKeys) {
            if (prevKeys.has(key)) {
                const prevVal = this.prevSnapshot[key];
                const currVal = currentSnap[key];
                if (!this._deepEqual(prevVal, currVal)) {
                    hasChange = true;
                    if (this.ignoreComponents.has(key)) {
                        this.stats.filtered++;
                    } else {
                        this.stats.modifies++;
                        this.stats.totalChanges++;
                        this._log('MODIFY', '~', `组件变更 [${key}]`, { from: prevVal, to: currVal });
                        console.log(
                            `%c[EntityMonitor] %c~ MODIFY %c[${key}]`,
                            'color:#888', 'color:#FFA500;font-weight:bold', 'color:#CC8400',
                            '\n  旧值:', prevVal,
                            '\n  新值:', currVal
                        );
                    }
                }
            }
        }

        // 更新快照
        this.prevSnapshot = currentSnap;
    }

    /**
     * 打印实时的完整组件状态报告（可随时调用）
     * @param {World} world - ECS World 实例
     */
    printStatus(world) {
        const snap = this._captureSnapshot(world);
        const keys = Object.keys(snap);
        this._log('STATUS', '📊', `当前组件数: ${keys.length}`, snap);

        console.log(
            `%c╔══════════════════════════════════════╗\n%c║  📊 ${this.label} 组件状态报告 (Tick#${this.tickCount})\t   ║\n%c╠══════════════════════════════════════╣`,
            'color:#00BFFF', 'color:#00BFFF;font-weight:bold', 'color:#00BFFF'
        );

        if (keys.length === 0) {
            console.log('%c║  (无组件)\t\t\t\t   ║', 'color:#888');
        } else {
            for (const key of keys) {
                const val = snap[key];
                const preview = this._truncate(JSON.stringify(val), 50);
                console.log(
                    `%c║  %-16s │ %s\t   ║`,
                    'color:#FFD700',
                    `[${key}]`,
                    preview
                );
            }
        }
        console.log('%c╚══════════════════════════════════════╝', 'color:#00BFFF');
    }

    // ==================== 日志导出 ====================

    /** 导出全部日志为 .log 文件并触发浏览器下载 */
    exportLog() {
        if (this.logBuffer.length === 0) {
            console.warn('[EntityMonitor] 无日志可导出');
            return;
        }

        const header = [
            '='.repeat(70),
            `  Entity Monitor Log Export`,
            `  实体: ${this.label} (ID: ${this.entityId})`,
            `  导出时间: ${new Date().toLocaleString()}`,
            `  总帧数: ${this.stats.totalTicks}`,
            `  总变更: ${this.stats.totalChanges} (新增:${this.stats.adds} 移除:${this.stats.removes} 修改:${this.stats.modifies})`,
            '='.repeat(70),
            '',
        ].join('\n');

        const content = header + this.logBuffer.join('\n') + '\n';

        // 触发浏览器下载
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `entity-monitor_${this.label}_id${this.entityId}_${Date.now()}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`%c[EntityMonitor] 📥 日志已导出 | 文件大小: ${(content.length / 1024).toFixed(1)}KB | 条数: ${this.logBuffer.length}`,
            'color:#888');
    }

    /** 清空日志缓冲区 */
    clearLog() {
        this.logBuffer = [];
        this.stats = { totalTicks: 0, totalChanges: 0, adds: 0, removes: 0, modifies: 0, startTime: this.stats.startTime };
        console.log('[EntityMonitor] 日志缓冲区已清空');
    }

    // ==================== 内部方法 ====================

    /** 从 World 中捕获指定实体的所有组件快照 */
    _captureSnapshot(world) {
        const snapshot = {};
        // 遍历 World 的所有组件集合，查找该实体的组件
        if (world.componentSets) {
            for (const [typeName, set] of world.componentSets) {
                if (set.contains(this.entityId)) {
                    snapshot[typeName] = this._clone(set.get(this.entityId));
                }
            }
        }
        return snapshot;
    }

    /** 打印初始状态报告 */
    _printInitialReport(snap) {
        const keys = Object.keys(snap);
        this._log('INIT', '🎬', `初始组件快照 | 组件数: ${keys.length}`, snap);
        console.log(
            `%c[EntityMonitor] %c🎬 初始状态 | 实体: ${this.label} | 组件数: ${keys.length} | ${keys.map(k => '[' + k + ']').join(' ')}`,
            'color:#888', 'color:#9370DB;font-weight:bold'
        );
    }

    /** 写入一行日志到缓冲区 */
    _log(type, icon, message, data = null) {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const line = `[${ts}] [${type.padEnd(6)}] ${icon} ${message}` +
            (data !== null ? ` | ${JSON.stringify(data)}` : '');
        this.logBuffer.push(line);

        // 超过上限时移除最早的日志
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
    }

    /** 深度比较两个值是否相等 */
    _deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a === b;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return a === b;

        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!keysB.includes(key)) return false;
            if (!this._deepEqual(a[key], b[key])) return false;
        }
        return true;
    }

    /** 浅克隆对象（防止引用污染） */
    _clone(obj) {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch {
            return Object.assign({}, obj);
        }
    }

    /** 截断字符串到指定长度 */
    _truncate(str, maxLen) {
        if (str.length <= maxLen) return str;
        return str.substring(0, maxLen) + '...';
    }
}
