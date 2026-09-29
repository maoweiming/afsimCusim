import { create } from 'zustand';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ErrorSource = 'websocket' | 'api' | 'render' | 'simulation' | 'unknown';

export interface AppError {
  id: string;
  timestamp: number;
  source: ErrorSource;
  severity: ErrorSeverity;
  message: string;
  detail?: string;
  stack?: string;
  context?: Record<string, unknown>;
  resolved: boolean;
}

interface ErrorState {
  errors: AppError[];
  maxErrors: number;
  addError: (error: Omit<AppError, 'id' | 'timestamp' | 'resolved'>) => void;
  resolveError: (id: string) => void;
  clearResolved: () => void;
  clearAll: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: [],
  maxErrors: 200,

  addError: (error) =>
    set((state) => {
      const newError: AppError = {
        ...error,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        resolved: false,
      };
      const errors = [newError, ...state.errors];
      if (errors.length > state.maxErrors) {
        errors.pop();
      }
      return { errors };
    }),

  resolveError: (id) =>
    set((state) => ({
      errors: state.errors.map((e) => (e.id === id ? { ...e, resolved: true } : e)),
    })),

  clearResolved: () =>
    set((state) => ({
      errors: state.errors.filter((e) => !e.resolved),
    })),

  clearAll: () => set({ errors: [] }),
}));
