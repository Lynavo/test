import { create } from 'zustand';
import type { SettingsDTO } from '@syncflow/contracts';
import { mockSettings } from '../mocks/settings';

export interface SettingsState {
  settings: SettingsDTO;
  copiedField: string | null;
  updateSettings(settings: SettingsDTO): void;
  setCopied(field: string | null): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: mockSettings,
  copiedField: null,

  updateSettings: (settings) => set({ settings }),

  setCopied: (field) => set({ copiedField: field }),
}));
