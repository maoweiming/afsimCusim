import { create } from 'zustand'

export type SimPhase = 'idle' | 'running' | 'paused' | 'complete'

interface SimState {
  phase: SimPhase
  simTime: number
  clockRate: number
  scenarioId: string | null
  simulationId: string | null
  connected: boolean

  setPhase: (phase: SimPhase) => void
  setSimTime: (t: number) => void
  setClockRate: (rate: number) => void
  setConnected: (c: boolean) => void
  startSimulation: (scenarioId: string, simId: string) => void
  reset: () => void
}

export const useSimStore = create<SimState>((set) => ({
  phase: 'idle',
  simTime: 0,
  clockRate: 1,
  scenarioId: null,
  simulationId: null,
  connected: false,

  setPhase: (phase) => set({ phase }),
  setSimTime: (simTime) => set({ simTime }),
  setClockRate: (clockRate) => set({ clockRate }),
  setConnected: (connected) => set({ connected }),
  startSimulation: (scenarioId, simulationId) =>
    set({ scenarioId, simulationId, phase: 'running', simTime: 0 }),
  reset: () =>
    set({ phase: 'idle', simTime: 0, clockRate: 1, scenarioId: null, simulationId: null }),
}))

// Event log store
export interface LogEntry {
  id: number
  time: number
  type: string
  message: string
}

interface EventLogState {
  entries: LogEntry[]
  nextId: number
  maxEntries: number
  addEntry: (time: number, type: string, message: string) => void
  clear: () => void
}

let entryCounter = 0

export const useEventLogStore = create<EventLogState>((set) => ({
  entries: [],
  nextId: 0,
  maxEntries: 500,

  addEntry: (time, type, message) => {
    const id = entryCounter++
    set((state) => {
      const entries = [...state.entries, { id, time, type, message }]
      if (entries.length > state.maxEntries) {
        entries.splice(0, entries.length - state.maxEntries)
      }
      return { entries, nextId: id + 1 }
    })
  },

  clear: () => set({ entries: [], nextId: 0 }),
}))
