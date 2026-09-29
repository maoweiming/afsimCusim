import { create } from 'zustand';
import type { TrackData, TrackId, TrackUpdatePayload } from '../api/types';

function trackKey(id: TrackId): string {
  return `${id.originator_index}:${id.target_index}:${id.sensor_name}`;
}

interface TrackStore {
  tracks: Map<string, TrackData>;

  addTrack: (track: TrackData) => void;
  addTracks: (tracks: TrackData[]) => void;
  updateTrack: (update: TrackUpdatePayload) => void;
  removeTrack: (id: TrackId) => void;
  clearAll: () => void;
}

export const useTrackStore = create<TrackStore>((set) => ({
  tracks: new Map(),

  addTrack: (track) =>
    set((state) => {
      const next = new Map(state.tracks);
      next.set(trackKey(track.id), track);
      return { tracks: next };
    }),

  addTracks: (tracks) =>
    set(() => {
      const next = new Map<string, TrackData>();
      for (const t of tracks) {
        next.set(trackKey(t.id), t);
      }
      return { tracks: next };
    }),

  updateTrack: (update) =>
    set((state) => {
      const key = trackKey(update.id);
      const existing = state.tracks.get(key);
      if (!existing) return state;
      const next = new Map(state.tracks);
      next.set(key, { ...existing, ...update });
      return { tracks: next };
    }),

  removeTrack: (id) =>
    set((state) => {
      const next = new Map(state.tracks);
      next.delete(trackKey(id));
      return { tracks: next };
    }),

  clearAll: () => set({ tracks: new Map() }),
}));

export { trackKey };
