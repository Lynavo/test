import { create } from 'zustand';
import type { DeviceFileLedgerDTO } from '@syncflow/contracts';

export type SortField = 'name' | 'size' | 'completedAt' | 'createdAt' | 'duration';
export type SortDirection = 'asc' | 'desc';

export interface DeviceDetailState {
  files: DeviceFileLedgerDTO[];
  selectedDate: string;
  availableDates: string[];
  sortField: SortField;
  sortDirection: SortDirection;
  loading: boolean;
  fetchDeviceFiles(deviceId: string, date?: string): Promise<void>;
  setDate(date: string): void;
  setAvailableDates(dates: string[]): void;
  toggleSort(field: SortField): void;
  setFiles(files: DeviceFileLedgerDTO[]): void;
}

export const useDeviceDetailStore = create<DeviceDetailState>((set, get) => ({
  files: [],
  selectedDate: '',
  availableDates: [],
  sortField: 'completedAt',
  sortDirection: 'desc',
  loading: false,

  fetchDeviceFiles: async (deviceId: string, date?: string) => {
    const api = window.electronAPI;
    if (!api) return;
    set({ loading: true });
    try {
      const selectedDate = date || get().selectedDate;
      const [files, datesRes] = await Promise.all([
        api.sidecar.getDeviceFiles(deviceId, selectedDate),
        api.sidecar.getDeviceDates(deviceId),
      ]);
      set({
        files,
        availableDates: datesRes.dates,
        selectedDate,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to fetch device files:', err);
      set({ loading: false });
    }
  },

  setDate: (date) => set({ selectedDate: date }),

  setAvailableDates: (dates) => set({ availableDates: dates }),

  toggleSort: (field) =>
    set((state) => ({
      sortField: field,
      sortDirection:
        state.sortField === field && state.sortDirection === 'asc'
          ? 'desc'
          : 'asc',
    })),

  setFiles: (files) => set({ files }),
}));
