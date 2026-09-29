import { create } from 'zustand';

const STORAGE_KEY = 'truesim:help-onboarding';

interface HelpState {
  hasCompletedOnboarding: boolean;
  showKeyboardShortcuts: boolean;
  helpDrawerOpen: boolean;

  completeOnboarding: () => void;
  toggleKeyboardShortcuts: () => void;
  toggleHelpDrawer: () => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  hasCompletedOnboarding: localStorage.getItem(STORAGE_KEY) === 'true',
  showKeyboardShortcuts: false,
  helpDrawerOpen: false,

  completeOnboarding: () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    set({ hasCompletedOnboarding: true });
  },

  toggleKeyboardShortcuts: () =>
    set((state) => ({ showKeyboardShortcuts: !state.showKeyboardShortcuts })),

  toggleHelpDrawer: () =>
    set((state) => ({ helpDrawerOpen: !state.helpDrawerOpen })),
}));
