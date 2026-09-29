/**
 * PluginContext - React Context for plugin system
 * 提供 usePluginRegistry, useActiveContributions, useUserRole hooks
 */
import { createContext, useContext, useSyncExternalStore, useCallback, useRef, type ReactNode } from 'react';
import { PluginRegistry } from './PluginRegistry';
import type { UserRole, PluginContribution, PluginInfo } from './types';

interface PluginContextValue {
  registry: PluginRegistry;
  role: UserRole;
  contributions: PluginContribution;
  plugins: PluginInfo[];
  setRole: (role: UserRole) => Promise<void>;
}

interface Snapshot {
  role: UserRole;
  contributions: PluginContribution;
  plugins: PluginInfo[];
}

const Ctx = createContext<PluginContextValue | null>(null);

export function PluginProvider({ children }: { children: ReactNode }) {
  const registry = PluginRegistry.getInstance();

  const subscribe = useCallback((onStoreChange: () => void) => {
    return registry.subscribe(onStoreChange);
  }, [registry]);

  // Cache snapshot using version counter from registry.
  // useSyncExternalStore uses Object.is — returning a new object every call
  // causes infinite re-render. We only recompute when registry version changes.
  const cachedRef = useRef<Snapshot>(null!);
  const versionRef = useRef(-1);

  const getSnapshot = useCallback((): Snapshot => {
    const ver = registry.getVersion();
    if (ver === versionRef.current) {
      return cachedRef.current;
    }
    versionRef.current = ver;
    const snap: Snapshot = {
      role: registry.getCurrentRole(),
      contributions: registry.getActiveContributions(),
      plugins: registry.getAllPlugins(),
    };
    cachedRef.current = snap;
    return snap;
  }, [registry]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setRole = useCallback(async (role: UserRole) => {
    await registry.setRole(role);
  }, [registry]);

  const value: PluginContextValue = {
    registry,
    ...snapshot,
    setRole,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ============ Hooks ============

function usePluginCtx(): PluginContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePluginContext must be used within PluginProvider');
  return ctx;
}

export function usePluginRegistry(): PluginRegistry {
  return usePluginCtx().registry;
}

export function useActiveContributions(): PluginContribution {
  return usePluginCtx().contributions;
}

export function useUserRole(): [UserRole, (role: UserRole) => Promise<void>] {
  const { role, setRole } = usePluginCtx();
  return [role, setRole];
}

export function usePluginInfo(): PluginInfo[] {
  return usePluginCtx().plugins;
}
