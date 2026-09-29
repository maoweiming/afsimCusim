import { create } from 'zustand';

export interface ThreatAssessment {
  platformIndex: number;
  targetIndex: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  engagementStatus: 'tracking' | 'engaging' | 'defending' | 'evading';
  riskScore: number; // 0-1
  wezClosureRate?: number; // km/s
  timeToWez?: number; // seconds
  timestamp: number;
}

interface ThreatState {
  assessments: Map<string, ThreatAssessment>; // key: `${platformIndex}:${targetIndex}`
  addAssessment: (a: ThreatAssessment) => void;
  removeAssessment: (key: string) => void;
  clearAll: () => void;
}

export const useThreatStore = create<ThreatState>((set) => ({
  assessments: new Map(),

  addAssessment: (a) =>
    set((state) => {
      const assessments = new Map(state.assessments);
      assessments.set(`${a.platformIndex}:${a.targetIndex}`, a);
      return { assessments };
    }),

  removeAssessment: (key) =>
    set((state) => {
      const assessments = new Map(state.assessments);
      assessments.delete(key);
      return { assessments };
    }),

  clearAll: () => set({ assessments: new Map() }),
}));
