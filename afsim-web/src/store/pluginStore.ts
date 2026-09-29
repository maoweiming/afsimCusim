/**
 * pluginStore - Zustand store for plugin system state
 * 跟踪当前角色、已注册插件、活跃贡献
 */
import { create } from 'zustand';
import type { UserRole, PluginContribution, PluginInfo } from '../core/plugin/types';

interface PluginState {
  role: UserRole;
  plugins: PluginInfo[];
  contributions: PluginContribution;

  setRole: (role: UserRole) => void;
  setPlugins: (plugins: PluginInfo[]) => void;
  setContributions: (contributions: PluginContribution) => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  role: 'viewer',
  plugins: [],
  contributions: {
    routes: [],
    navItems: [],
    sidebarPanels: [],
    layers: [],
    dataSources: [],
    eventSubscriptions: [],
  },

  setRole: (role) => set({ role }),
  setPlugins: (plugins) => set({ plugins }),
  setContributions: (contributions) => set({ contributions }),
}));
