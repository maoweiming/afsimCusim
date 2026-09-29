import { create } from 'zustand'

export interface SensorInfo {
  name: string
  type: string
  isOn: boolean
  detections?: number[]
}

export interface MissionStatus {
  type: 'patrol' | 'strike' | 'escort' | 'recon' | 'cargo' | 'cap' | 'cas'
  status: 'en_route' | 'on_station' | 'engaging' | 'rtb' | 'completed' | 'aborted'
  waypointsRemaining: number
  eta?: number
  progress: number
}

export interface CombatStatus {
  weaponsReady: number
  weaponsExpended: number
  engagementState: 'safe' | 'caution' | 'weapons_free' | 'engaged'
  ammoRemaining: Record<string, number>
}

export interface CommunicationsStatus {
  datalink: { connected: boolean; networkId: string; nodes: number[] }
  radio: Array<{ channel: string; frequency: number; active: boolean; encrypted: boolean }>
}

export interface OperationalStatus {
  readiness: 'full' | 'degraded' | 'limited' | 'incapable'
  maintenanceState: 'operational' | 'minor_fault' | 'major_fault' | 'non_mission_capable'
  sortieCount: number
  flightHours?: number
}

export interface PlatformInfo {
  index: number
  name: string
  typeId: string
  side: string
  lat: number
  lon: number
  alt: number
  heading?: number
  pitch?: number
  roll?: number
  velN?: number
  velE?: number
  velD?: number
  damageFactor: number
  broken?: boolean
  initialized?: boolean
  sensors: Record<string, SensorInfo>
  fuel: Record<string, number>
  mission?: MissionStatus
  combat?: CombatStatus
  communications?: CommunicationsStatus
  operational?: OperationalStatus
}

interface PlatformState {
  platforms: Record<number, PlatformInfo>
  selectedPlatformIndex: number | null
  addPlatform: (p: Partial<PlatformInfo> & { index: number }) => void
  updatePlatform: (index: number, updates: Partial<PlatformInfo>) => void
  removePlatform: (index: number) => void
  updateSensor: (platformIndex: number, sensorName: string, update: Partial<SensorInfo>) => void
  updateFuel: (platformIndex: number, fuelName: string, quantity: number) => void
  selectPlatform: (index: number | null) => void
  clearAll: () => void
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  platforms: {},
  selectedPlatformIndex: null,

  addPlatform: (p) =>
    set((state) => ({
      platforms: {
        ...state.platforms,
        [p.index]: {
          index: p.index,
          name: p.name ?? '',
          typeId: p.typeId ?? '',
          side: p.side ?? '',
          lat: p.lat ?? 0,
          lon: p.lon ?? 0,
          alt: p.alt ?? 0,
          heading: p.heading,
          pitch: p.pitch,
          roll: p.roll,
          velN: p.velN,
          velE: p.velE,
          velD: p.velD,
          damageFactor: p.damageFactor ?? 0,
          broken: p.broken,
          initialized: p.initialized,
          sensors: {},
          fuel: {},
        },
      },
    })),

  updatePlatform: (index, updates) =>
    set((state) => {
      const existing = state.platforms[index]
      if (!existing) return state
      return {
        platforms: {
          ...state.platforms,
          [index]: { ...existing, ...updates },
        },
      }
    }),

  removePlatform: (index) =>
    set((state) => {
      const { [index]: _, ...rest } = state.platforms
      return { platforms: rest }
    }),

  updateSensor: (platformIndex, sensorName, update) =>
    set((state) => {
      const platform = state.platforms[platformIndex]
      if (!platform) return state
      const existing = platform.sensors[sensorName] || { name: sensorName, type: '', isOn: false }
      return {
        platforms: {
          ...state.platforms,
          [platformIndex]: {
            ...platform,
            sensors: {
              ...platform.sensors,
              [sensorName]: { ...existing, ...update },
            },
          },
        },
      }
    }),

  updateFuel: (platformIndex, fuelName, quantity) =>
    set((state) => {
      const platform = state.platforms[platformIndex]
      if (!platform) return state
      return {
        platforms: {
          ...state.platforms,
          [platformIndex]: {
            ...platform,
            fuel: { ...platform.fuel, [fuelName]: quantity },
          },
        },
      }
    }),

  clearAll: () => set({ platforms: {} }),

  selectPlatform: (index) => set({ selectedPlatformIndex: index }),
}))
