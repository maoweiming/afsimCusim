/**
 * BasePlugin - 插件抽象基类
 * 封装生命周期状态管理，子类只需实现 buildContribution()
 */
import type { Plugin, PluginManifest, PluginPhase, PluginContext, PluginContribution } from '../core/plugin/types';
import { PluginPhase as Phase } from '../core/plugin/types';

export abstract class BasePlugin implements Plugin {
  protected _phase: PluginPhase = Phase.Registered;
  protected context: PluginContext | null = null;
  private _contribution: PluginContribution = {};

  constructor(readonly manifest: PluginManifest) {}

  get phase(): PluginPhase { return this._phase; }

  async init(context: PluginContext): Promise<void> {
    this.context = context;
    this._phase = Phase.Initialized;
  }

  activate(): PluginContribution {
    this._phase = Phase.Active;
    this._contribution = this.buildContribution();
    return this._contribution;
  }

  deactivate(): void {
    this._phase = Phase.Inactive;
  }

  destroy(): void {
    this._phase = Phase.Destroyed;
    this.context = null;
  }

  protected abstract buildContribution(): PluginContribution;
}
