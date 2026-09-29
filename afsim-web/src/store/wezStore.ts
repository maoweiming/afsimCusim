import { create } from 'zustand';

export interface WezEntry {
  platformIndex: number;
  weaponName: string;
  rangeKm: number;
  maxOffAxisDeg: number;
  probabilityOfKill: number; // 0-1
  side: 'blue' | 'red' | 'neutral';
}

interface WezState {
  zones: Map<string, WezEntry>; // key: `${platformIndex}:${weaponName}`
  setZones: (entries: WezEntry[]) => void;
  addZone: (entry: WezEntry) => void;
  removeZone: (key: string) => void;
  clearAll: () => void;
}

export const useWezStore = create<WezState>((set) => ({
  zones: new Map(),

  setZones: (entries) =>
    set(() => {
      const zones = new Map<string, WezEntry>();
      for (const entry of entries) {
        zones.set(`${entry.platformIndex}:${entry.weaponName}`, entry);
      }
      return { zones };
    }),

  addZone: (entry) =>
    set((state) => {
      const zones = new Map(state.zones);
      zones.set(`${entry.platformIndex}:${entry.weaponName}`, entry);
      return { zones };
    }),

  removeZone: (key) =>
    set((state) => {
      const zones = new Map(state.zones);
      zones.delete(key);
      return { zones };
    }),

  clearAll: () => set({ zones: new Map() }),
}));
