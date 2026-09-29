/**
 * MapEngine React Context
 * Provides map engine instance to all components
 */
import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';
import type { MapEngine, MapEngineType, MapOptions } from './MapEngine';
import { EngineFactory } from './EngineFactory';

interface MapEngineContextValue {
  engine: MapEngine | null;
  engineType: MapEngineType;
  isReady: boolean;
  initialize: (container: HTMLElement, options?: MapOptions) => Promise<void>;
  switchEngine: (type: MapEngineType) => Promise<void>;
  destroy: () => void;
}

const MapEngineContext = createContext<MapEngineContextValue | null>(null);

export interface MapEngineProviderProps {
  defaultEngine?: MapEngineType;
  children: ReactNode;
}

export function MapEngineProvider({ defaultEngine = 'cesium', children }: MapEngineProviderProps) {
  const engineRef = useRef<MapEngine | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef<MapOptions | undefined>(undefined);
  const [engineType, setEngineType] = useState<MapEngineType>(defaultEngine);
  const [isReady, setIsReady] = useState(false);

  const initialize = useCallback(async (container: HTMLElement, options?: MapOptions) => {
    containerRef.current = container;
    optionsRef.current = options;

    if (engineRef.current) {
      engineRef.current.destroy();
    }

    const engine = EngineFactory.create(engineType);
    await engine.initialize(container, options);
    engineRef.current = engine;
    setIsReady(true);
  }, [engineType]);

  const switchEngine = useCallback(async (type: MapEngineType) => {
    if (type === engineType && engineRef.current?.isReady()) return;

    setEngineType(type);

    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
      setIsReady(false);
    }

    if (containerRef.current) {
      const engine = EngineFactory.create(type);
      await engine.initialize(containerRef.current, optionsRef.current);
      engineRef.current = engine;
      setIsReady(true);
    }
  }, [engineType]);

  const destroy = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
      setIsReady(false);
    }
  }, []);

  const value: MapEngineContextValue = {
    engine: engineRef.current,
    engineType,
    isReady,
    initialize,
    switchEngine,
    destroy,
  };

  return (
    <MapEngineContext.Provider value={value}>
      {children}
    </MapEngineContext.Provider>
  );
}

/**
 * Hook to access the map engine instance
 */
export function useMapEngine(): MapEngineContextValue {
  const context = useContext(MapEngineContext);
  if (!context) {
    throw new Error('useMapEngine must be used within a MapEngineProvider');
  }
  return context;
}

/**
 * Hook to access the map engine instance (nullable)
 * Returns null if not inside a provider
 */
export function useMapEngineOptional(): MapEngineContextValue | null {
  return useContext(MapEngineContext);
}
