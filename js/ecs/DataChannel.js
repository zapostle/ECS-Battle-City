// =============================================================================
// DataChannel - 数据变化订阅通道
// UI 层可订阅特定数据路径的变化，仅在实际值改变时收到通知
// 设计原则：
//   - 脏检测机制：每帧对比快照值，仅在值变化时触发回调
//   - 与 WorldView 配合：queryFn 通过 WorldView 查询，回调通知 UI 更新
//   - 完全在 ECS tick 外运行，不影响系统性能
// =============================================================================

export class DataChannel {
    /**
     * @param {import('./WorldView.js').WorldView} worldView - 只读世界视图
     */
    constructor(worldView) {
        this._worldView = worldView;
        this._subscribers = new Map();   // key → { queryFn, callbacks[] }
        this._snapshots = new Map();     // key → 上一次的值（用于脏检测）
    }

    /**
     * 订阅某个数据路径的变化
     * @param {string} key - 数据标识（如 'playerScore', 'enemyCount', 'gameState'）
     * @param {(worldView: WorldView) => any} queryFn - 从 WorldView 中提取值的函数
     * @param {(newValue: any, oldValue: any, key: string) => void} callback - 值变化时的回调
     */
    subscribe(key, queryFn, callback) {
        if (!this._subscribers.has(key)) {
            this._subscribers.set(key, { queryFn, callbacks: [] });
        }
        this._subscribers.get(key).callbacks.push(callback);
    }

    /**
     * 取消订阅
     * @param {string} key - 数据标识
     * @param {Function} callback - 之前注册的回调引用
     */
    unsubscribe(key, callback) {
        const sub = this._subscribers.get(key);
        if (!sub) return;
        const idx = sub.callbacks.indexOf(callback);
        if (idx >= 0) sub.callbacks.splice(idx, 1);
        if (sub.callbacks.length === 0) {
            this._subscribers.delete(key);
            this._snapshots.delete(key);
        }
    }

    /**
     * 每帧调用一次：检测变化，通知订阅者
     * 应在 ECS tick 之后、UI render 之前调用
     */
    tick() {
        for (const [key, sub] of this._subscribers) {
            const newValue = sub.queryFn(this._worldView);
            const oldValue = this._snapshots.get(key);

            // 使用 Object.is 进行严格比较（处理 NaN 等边界情况）
            if (!Object.is(newValue, oldValue)) {
                this._snapshots.set(key, newValue);
                for (const cb of sub.callbacks) {
                    cb(newValue, oldValue, key);
                }
            }
        }
    }

    /**
     * 强制触发指定 key 的所有回调（不管值是否变化）
     * 用于初始化场景时立即同步一次数据
     * @param {string} key - 数据标识
     */
    forceNotify(key) {
        const sub = this._subscribers.get(key);
        if (!sub) return;
        const newValue = sub.queryFn(this._worldView);
        const oldValue = this._snapshots.get(key);
        this._snapshots.set(key, newValue);
        for (const cb of sub.callbacks) {
            cb(newValue, oldValue, key);
        }
    }

    /**
     * 强制触发所有订阅的回调（场景切换时使用）
     */
    forceNotifyAll() {
        for (const key of this._subscribers.keys()) {
            this.forceNotify(key);
        }
    }

    /**
     * 重置所有快照值（场景切换时调用，避免脏检测误判）
     */
    reset() {
        this._snapshots.clear();
    }
}
