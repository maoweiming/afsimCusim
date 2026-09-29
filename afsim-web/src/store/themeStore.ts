/**
 * Theme store — manages active theme preset with localStorage persistence
 *
 * Storage keys:
 *   truesim:theme        — user's manual theme override (takes priority)
 *   truesim:theme:role   — role's default theme (set on role switch, no manual override)
 */
import { create } from 'zustand';
import { THEME_PRESETS, DEFAULT_THEME_ID, getThemeById } from '../shared/theme/themes';
import type { ThemePreset } from '../shared/theme/themes';

const MANUAL_KEY = 'truesim:theme';
const ROLE_KEY = 'truesim:theme:role';

function loadSavedThemeId(): string {
  try {
    // Manual override takes priority
    const manual = localStorage.getItem(MANUAL_KEY);
    if (manual && THEME_PRESETS.some((t) => t.id === manual)) return manual;

    // Role default fallback
    const roleDefault = localStorage.getItem(ROLE_KEY);
    if (roleDefault && THEME_PRESETS.some((t) => t.id === roleDefault)) return roleDefault;
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_THEME_ID;
}

interface ThemeState {
  activeThemeId: string;
  hasManualOverride: boolean;
  setTheme: (id: string) => void;
  setRoleDefault: (id: string) => void;
  getActivePreset: () => ThemePreset;
  getAllPresets: () => ThemePreset[];
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  activeThemeId: loadSavedThemeId(),
  hasManualOverride: !!localStorage.getItem(MANUAL_KEY),

  setTheme: (id: string) => {
    const preset = getThemeById(id);
    try {
      localStorage.setItem(MANUAL_KEY, preset.id);
    } catch { /* ignore */ }
    set({ activeThemeId: preset.id, hasManualOverride: true });
  },

  setRoleDefault: (id: string) => {
    // Only apply if user hasn't manually overridden
    if (get().hasManualOverride) return;
    const preset = getThemeById(id);
    try {
      localStorage.setItem(ROLE_KEY, preset.id);
    } catch { /* ignore */ }
    set({ activeThemeId: preset.id });
  },

  getActivePreset: () => getThemeById(get().activeThemeId),

  getAllPresets: () => THEME_PRESETS,
}));
