/**
 * 事件总线
 * 提供发布/订阅模式的事件通信机制
 */

export type EventCallback<T = any> = (data: T) => void;
export type Unsubscribe = () => void;

interface EventEntry {
  callback: EventCallback;
  once: boolean;
  priority: number;
}

export class EventBus {
  private events: Map<string, EventEntry[]> = new Map();
  private eventHistory: Map<string, any[]> = new Map();
  private maxHistorySize = 100;

  /**
   * 订阅事件
   * @param topic 事件主题
   * @param callback 回调函数
   * @param priority 优先级（越大越先执行）
   * @returns 取消订阅函数
   */
  on<T = any>(topic: string, callback: EventCallback<T>, priority = 0): Unsubscribe {
    return this.addListener(topic, callback, false, priority);
  }

  /**
   * 订阅事件（只触发一次）
   */
  once<T = any>(topic: string, callback: EventCallback<T>, priority = 0): Unsubscribe {
    return this.addListener(topic, callback, true, priority);
  }

  /**
   * 发布事件
   */
  emit<T = any>(topic: string, data?: T): void {
    const listeners = this.events.get(topic);
    if (!listeners || listeners.length === 0) return;

    // 记录历史
    this.addToHistory(topic, data);

    // 按优先级排序后执行
    const sorted = [...listeners].sort((a, b) => b.priority - a.priority);
    const toRemove: EventEntry[] = [];

    for (const listener of sorted) {
      try {
        listener.callback(data);
      } catch (error) {
        console.error(`EventBus error in topic "${topic}":`, error);
      }
      if (listener.once) {
        toRemove.push(listener);
      }
    }

    // 移除一次性监听器
    if (toRemove.length > 0) {
      const remaining = listeners.filter(l => !toRemove.includes(l));
      if (remaining.length > 0) {
        this.events.set(topic, remaining);
      } else {
        this.events.delete(topic);
      }
    }
  }

  /**
   * 移除指定主题的所有监听器
   */
  off(topic: string): void {
    this.events.delete(topic);
  }

  /**
   * 移除指定回调
   */
  offCallback<T = any>(topic: string, callback: EventCallback<T>): void {
    const listeners = this.events.get(topic);
    if (!listeners) return;

    const remaining = listeners.filter(l => l.callback !== callback);
    if (remaining.length > 0) {
      this.events.set(topic, remaining);
    } else {
      this.events.delete(topic);
    }
  }

  /**
   * 检查是否有监听器
   */
  hasListeners(topic: string): boolean {
    const listeners = this.events.get(topic);
    return !!listeners && listeners.length > 0;
  }

  /**
   * 获取监听器数量
   */
  listenerCount(topic: string): number {
    return this.events.get(topic)?.length ?? 0;
  }

  /**
   * 获取所有事件主题
   */
  topics(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * 获取事件历史
   */
  getHistory(topic: string): any[] {
    return this.eventHistory.get(topic) ?? [];
  }

  /**
   * 清除事件历史
   */
  clearHistory(topic?: string): void {
    if (topic) {
      this.eventHistory.delete(topic);
    } else {
      this.eventHistory.clear();
    }
  }

  /**
   * 等待事件（Promise 形式）
   */
  waitFor<T = any>(topic: string, timeout = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`EventBus.waitFor timeout: "${topic}" not received within ${timeout}ms`));
      }, timeout);

      const unsubscribe = this.once(topic, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // ============ 私有方法 ============

  private addListener<T = any>(
    topic: string,
    callback: EventCallback<T>,
    once: boolean,
    priority: number,
  ): Unsubscribe {
    if (!this.events.has(topic)) {
      this.events.set(topic, []);
    }

    const entry: EventEntry = { callback, once, priority };
    this.events.get(topic)!.push(entry);

    // 返回取消订阅函数
    return () => {
      const listeners = this.events.get(topic);
      if (!listeners) return;
      const index = listeners.indexOf(entry);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        this.events.delete(topic);
      }
    };
  }

  private addToHistory(topic: string, data: any): void {
    if (!this.eventHistory.has(topic)) {
      this.eventHistory.set(topic, []);
    }
    const history = this.eventHistory.get(topic)!;
    history.push(data);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }
}

// 全局单例
export const eventBus = new EventBus();
export default eventBus;
