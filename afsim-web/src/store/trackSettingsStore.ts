// ============================================================
// Track Display Settings Store
// 管理轨迹显示设置：轨迹线、长度、着色模式、标签等
// ============================================================

import { create } from 'zustand';

interface TrackSettingsState {
  showTrackLines: boolean;
  trackLength: number; // seconds
  colorMode: 'side' | 'status';
  showLabels: boolean;
  showVelocityVectors: boolean;
  showRoutes: boolean;
  setShowTrackLines: (v: boolean) => void;
  setTrackLength: (v: number) => void;
  setColorMode: (v: 'side' | 'status') => void;
  setShowLabels: (v: boolean) => void;
  setShowVelocityVectors: (v: boolean) => void;
  setShowRoutes: (v: boolean) => void;
}

export const useTrackSettingsStore = create<TrackSettingsState>((set) => ({
  showTrackLines: true,
  trackLength: 30,
  colorMode: 'side',
  showLabels: true,
  showVelocityVectors: false,
  showRoutes: true,
  setShowTrackLines: (v) => set({ showTrackLines: v }),
  setTrackLength: (v) => set({ trackLength: v }),
  setColorMode: (v) => set({ colorMode: v }),
  setShowLabels: (v) => set({ showLabels: v }),
  setShowVelocityVectors: (v) => set({ showVelocityVectors: v }),
  setShowRoutes: (v) => set({ showRoutes: v }),
}));
