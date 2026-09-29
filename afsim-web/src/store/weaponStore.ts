import { create } from 'zustand';
import type { WeaponEngagement, WeaponFiredPayload } from '../api/types';

interface WeaponStore {
  weapons: Map<number, WeaponEngagement>;

  addWeapon: (payload: WeaponFiredPayload) => void;
  updateWeaponPosition: (index: number, lat: number, lon: number, alt: number) => void;
  weaponHit: (weaponIndex: number) => void;
  weaponMissed: (weaponIndex: number) => void;
  weaponTerminated: (weaponIndex: number) => void;
  clearAll: () => void;
}

export const useWeaponStore = create<WeaponStore>((set) => ({
  weapons: new Map(),

  addWeapon: (payload) =>
    set((state) => {
      const next = new Map(state.weapons);
      next.set(payload.weapon_platform_index, {
        weapon_platform_index: payload.weapon_platform_index,
        firing_platform_index: payload.firing_platform_index,
        weapon_name: payload.weapon_name,
        target_platform_index: payload.target_platform_index,
        launch_lat: payload.launch_lat,
        launch_lon: payload.launch_lon,
        launch_alt: payload.launch_alt,
        current_lat: payload.launch_lat,
        current_lon: payload.launch_lon,
        current_alt: payload.launch_alt,
        hit: undefined,
      });
      return { weapons: next };
    }),

  updateWeaponPosition: (index, lat, lon, alt) =>
    set((state) => {
      const existing = state.weapons.get(index);
      if (!existing) return state;
      const next = new Map(state.weapons);
      next.set(index, { ...existing, current_lat: lat, current_lon: lon, current_alt: alt });
      return { weapons: next };
    }),

  weaponHit: (weaponIndex) =>
    set((state) => {
      const existing = state.weapons.get(weaponIndex);
      if (!existing) return state;
      const next = new Map(state.weapons);
      next.set(weaponIndex, { ...existing, hit: true });
      // Remove after a short delay (handled by component or timer elsewhere)
      return { weapons: next };
    }),

  weaponMissed: (weaponIndex) =>
    set((state) => {
      const next = new Map(state.weapons);
      next.delete(weaponIndex);
      return { weapons: next };
    }),

  weaponTerminated: (weaponIndex) =>
    set((state) => {
      const next = new Map(state.weapons);
      next.delete(weaponIndex);
      return { weapons: next };
    }),

  clearAll: () => set({ weapons: new Map() }),
}));
