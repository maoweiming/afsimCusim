/**
 * 数据总线
 * 提供统一的数据发布/订阅和同步机制
 * 连接前端各模块与数据中间平台
 */
import { eventBus } from './EventBus';
import type { EventBus, Unsubscribe } from './EventBus';

// ============ 类型定义 ============

export interface DataSource {
  id: string;
  name: string;
  type: 'equipment' | 'scenario' | 'simulation' | 'terrain' | 'replay';
  endpoint: string;
}

export interface DataMessage<T = any> {
  id: string;
  topic: string;
  source: string;
  timestamp: number;
  data: T;
  version?: number;
}

export type DataTransformer<TInput, TOutput> = (input: TInput) => TOutput;

export interface SyncOptions {
  mode: 'realtime' | 'periodic' | 'manual';
  interval?: number; // ms, for periodic mode
  conflictResolution: 'server-wins' | 'client-wins' | 'manual';
}

// ============ 数据源注册 ============

interface RegisteredSource {
  source: DataSource;
  connected: boolean;
  lastSync: number;
}

// ============ 数据总线实现 ============

export class DataBus {
  private eventBus: EventBus;
  private sources: Map<string, RegisteredSource> = new Map();
  private transforms: Map<string, { input: string; output: string; transformer: DataTransformer<any, any> }> = new Map();
  private syncTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ============ 数据源管理 ============

  /**
   * 注册数据源
   */
  registerSource(source: DataSource): void {
    this.sources.set(source.id, {
      source,
      connected: false,
      lastSync: 0,
    });

    this.eventBus.emit('datasource:registered', source);
  }

  /**
   * 移除数据源
   */
  unregisterSource(sourceId: string): void {
    this.stopSync(sourceId);
    this.sources.delete(sourceId);
    this.eventBus.emit('datasource:unregistered', sourceId);
  }

  /**
   * 获取已注册的数据源
   */
  getSources(): DataSource[] {
    return Array.from(this.sources.values()).map(s => s.source);
  }

  /**
   * 标记数据源已连接
   */
  markConnected(sourceId: string): void {
    const entry = this.sources.get(sourceId);
    if (entry) {
      entry.connected = true;
      this.eventBus.emit('datasource:connected', sourceId);
    }
  }

  /**
   * 标记数据源断开
   */
  markDisconnected(sourceId: string): void {
    const entry = this.sources.get(sourceId);
    if (entry) {
      entry.connected = false;
      this.eventBus.emit('datasource:disconnected', sourceId);
    }
  }

  // ============ 数据发布/订阅 ============

  /**
   * 发布数据到主题
   */
  publish<T>(topic: string, data: T, source = 'local'): void {
    const message: DataMessage<T> = {
      id: this.generateId(),
      topic,
      source,
      timestamp: Date.now(),
      data,
    };

    this.eventBus.emit(`data:${topic}`, message);

    // 触发数据转换链
    this.processTransforms(topic, data);
  }

  /**
   * 订阅主题数据
   */
  subscribe<T>(topic: string, callback: (data: T, message: DataMessage<T>) => void): Unsubscribe {
    return this.eventBus.on<DataMessage<T>>(`data:${topic}`, (message) => {
      callback(message.data, message);
    });
  }

  /**
   * 订阅主题数据（只触发一次）
   */
  subscribeOnce<T>(topic: string, callback: (data: T, message: DataMessage<T>) => void): Unsubscribe {
    return this.eventBus.once<DataMessage<T>>(`data:${topic}`, (message) => {
      callback(message.data, message);
    });
  }

  /**
   * 请求-响应模式
   */
  async request<TRequest, TResponse>(
    topic: string,
    data: TRequest,
    timeout = 30000
  ): Promise<TResponse> {
    const requestId = this.generateId();
    const responseTopic = `response:${topic}:${requestId}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventBus.off(responseTopic);
        reject(new Error(`DataBus.request timeout: "${topic}"`));
      }, timeout);

      this.eventBus.once<DataMessage<TResponse>>(responseTopic, (message) => {
        clearTimeout(timer);
        resolve(message.data);
      });

      this.publish(`request:${topic}`, { requestId, data });
    });
  }

  // ============ 数据转换 ============

  /**
   * 注册数据转换器
   * 当 inputTopic 有数据发布时，自动转换并发布到 outputTopic
   */
  registerTransform<TInput, TOutput>(
    name: string,
    inputTopic: string,
    outputTopic: string,
    transformer: DataTransformer<TInput, TOutput>
  ): void {
    this.transforms.set(name, { input: inputTopic, output: outputTopic, transformer });
  }

  /**
   * 移除数据转换器
   */
  unregisterTransform(name: string): void {
    this.transforms.delete(name);
  }

  private processTransforms(topic: string, data: any): void {
    for (const [, transform] of this.transforms) {
      if (transform.input === topic) {
        try {
          const transformed = transform.transformer(data);
          this.publish(transform.output, transformed, 'transform');
        } catch (error) {
          console.error(`DataBus transform error (${transform.input} -> ${transform.output}):`, error);
        }
      }
    }
  }

  // ============ 数据同步 ============

  /**
   * 启动数据同步
   */
  startSync(sourceId: string, options: SyncOptions): void {
    this.stopSync(sourceId);

    if (options.mode === 'periodic' && options.interval) {
      const timer = setInterval(() => {
        this.eventBus.emit('sync:tick', sourceId);
      }, options.interval);

      this.syncTimers.set(sourceId, timer);
    }

    this.eventBus.emit('sync:started', { sourceId, options });
  }

  /**
   * 停止数据同步
   */
  stopSync(sourceId: string): void {
    const timer = this.syncTimers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(sourceId);
    }
  }

  /**
   * 手动触发同步
   */
  triggerSync(sourceId: string): void {
    const entry = this.sources.get(sourceId);
    if (entry) {
      entry.lastSync = Date.now();
      this.eventBus.emit('sync:triggered', sourceId);
    }
  }

  // ============ 工具方法 ============

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理所有资源
   */
  dispose(): void {
    for (const [sourceId] of this.syncTimers) {
      this.stopSync(sourceId);
    }
    this.sources.clear();
    this.transforms.clear();
  }
}

// 全局单例
export const dataBus = new DataBus(eventBus);
export default dataBus;
