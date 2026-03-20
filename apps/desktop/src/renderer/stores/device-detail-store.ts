import { create } from 'zustand';
import type { DeviceFileLedgerDTO } from '@syncflow/contracts';
import { mockFiles, mockAvailableDates } from '../mocks/files';

export type SortField = 'name' | 'size' | 'completedAt' | 'createdAt' | 'duration';
export type SortDirection = 'asc' | 'desc';

export interface DeviceDetailState {
  files: DeviceFileLedgerDTO[];
  selectedDate: string;
  availableDates: string[];
  sortField: SortField;
  sortDirection: SortDirection;
  setDate(date: string): void;
  setAvailableDates(dates: string[]): void;
  toggleSort(field: SortField): void;
  setFiles(files: DeviceFileLedgerDTO[]): void;
}

export const useDeviceDetailStore = create<DeviceDetailState>((set) => ({
  files: mockFiles,
  selectedDate: mockAvailableDates[0] ?? '',
  availableDates: mockAvailableDates,
  sortField: 'completedAt',
  sortDirection: 'desc',

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
