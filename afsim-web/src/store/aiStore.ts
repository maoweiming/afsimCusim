import { create } from 'zustand';

export type OodaPhase = 'observe' | 'orient' | 'decide' | 'act';

export interface PlatformAiState {
  platformIndex: number;
  oodaPhase: OodaPhase;
  oodaPhaseStartTime: number;
  threatScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  engagementDecision: 'hold' | 'engage' | 'evade' | 'rtb';
  aiBehaviorMode: string;
  lastDecisionTime: number;
}

export interface IadsC2State {
  battleManagerId: string;
  engagementAuthority: boolean;
  shotDoctrine: 'shoot-look-shoot' | 'shoot-shoot' | 'salvo';
  activeEngagements: number;
  pendingEngagements: number;
}

export interface EwState {
  platformIndex: number;
  isJamming: boolean;
  jammingType: string;
  jammingTarget?: number;
  emitters: Array<{
    name: string;
    type: string;
    isOn: boolean;
    frequency?: number;
    power?: number;
  }>;
}

interface AiState {
  platformAi: Map<number, PlatformAiState>;
  iadsC2: Map<string, IadsC2State>;
  ewStates: Map<number, EwState>;

  updatePlatformAi: (index: number, update: Partial<PlatformAiState>) => void;
  updateIadsC2: (id: string, update: Partial<IadsC2State>) => void;
  updateEwState: (index: number, update: Partial<EwState>) => void;
  clearAll: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  platformAi: new Map(),
  iadsC2: new Map(),
  ewStates: new Map(),

  updatePlatformAi: (index, update) =>
    set((state) => {
      const platformAi = new Map(state.platformAi);
      const existing = platformAi.get(index);
      if (existing) {
        platformAi.set(index, { ...existing, ...update });
      } else if (update.platformIndex !== undefined) {
        platformAi.set(index, update as PlatformAiState);
      }
      return { platformAi };
    }),

  updateIadsC2: (id, update) =>
    set((state) => {
      const iadsC2 = new Map(state.iadsC2);
      const existing = iadsC2.get(id);
      if (existing) {
        iadsC2.set(id, { ...existing, ...update });
      } else if (update.battleManagerId !== undefined) {
        iadsC2.set(id, update as IadsC2State);
      }
      return { iadsC2 };
    }),

  updateEwState: (index, update) =>
    set((state) => {
      const ewStates = new Map(state.ewStates);
      const existing = ewStates.get(index);
      if (existing) {
        ewStates.set(index, { ...existing, ...update });
      } else if (update.platformIndex !== undefined) {
        ewStates.set(index, update as EwState);
      }
      return { ewStates };
    }),

  clearAll: () =>
    set({
      platformAi: new Map(),
      iadsC2: new Map(),
      ewStates: new Map(),
    }),
}));
