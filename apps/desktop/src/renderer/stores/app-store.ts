import { create } from 'zustand';
import type { DashboardDeviceDTO } from '@syncflow/contracts';

export interface AppState {
  currentView: 'dashboard' | 'settings';
  selectedDevice: DashboardDeviceDTO | null;
  isModalOpen: boolean;
  setView(view: 'dashboard' | 'settings'): void;
  openDeviceDetail(device: DashboardDeviceDTO): void;
  closeDeviceDetail(): void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedDevice: null,
  isModalOpen: false,

  setView: (view) => set({ currentView: view }),

  openDeviceDetail: (device) =>
    set({ selectedDevice: device, isModalOpen: true }),

  closeDeviceDetail: () =>
    set({ selectedDevice: null, isModalOpen: false }),
}));
