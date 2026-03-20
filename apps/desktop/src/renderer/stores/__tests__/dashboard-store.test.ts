import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '../dashboard-store';
import type { DashboardDeviceDTO, DashboardSummaryDTO } from '@syncflow/contracts';

describe('dashboard-store', () => {
  beforeEach(() => {
    useDashboardStore.getState().updateDevices([
      {
        deviceId: 'd4',
        clientName: 'GoPro Hero 12',
        ip: '192.168.1.188',
        status: 'offline',
        todayFileCount: 0,
        todayBytes: 0,
        storageLeft: '--',
        storagePath: '/Users/alice/SyncFlow/GoPro12',
      },
      {
        deviceId: 'd1',
        clientName: 'iPhone 15 Pro',
        ip: '192.168.1.201',
        status: 'transferring',
        todayFileCount: 12,
        todayBytes: 24.5 * 1024 ** 3,
        storageLeft: '1.2 TB',
        storagePath: '/Users/alice/SyncFlow/iPhone_15_Pro',
        currentFile: { filename: 'DJI_0421_4K_RAW.mp4', progress: 67, fileSize: 3_435_973_837 },
      },
      {
        deviceId: 'd2',
        clientName: 'Galaxy S24 Ultra',
        ip: '192.168.1.205',
        status: 'connected_idle',
        todayFileCount: 8,
        todayBytes: 16.3 * 1024 ** 3,
        storageLeft: '860 GB',
        storagePath: '/Users/alice/SyncFlow/GalaxyS24',
      },
    ]);
    useDashboardStore.setState({ diskWarningDismissed: false });
  });

  it('sorts devices: transferring > connected_idle > offline', () => {
    const devices = useDashboardStore.getState().devices;
    expect(devices[0].status).toBe('transferring');
    expect(devices[1].status).toBe('connected_idle');
    expect(devices[2].status).toBe('offline');
  });

  it('sorts devices correctly when updated with new list', () => {
    const unsorted: DashboardDeviceDTO[] = [
      {
        deviceId: 'x1',
        clientName: 'Offline Device',
        ip: '10.0.0.1',
        status: 'offline',
        todayFileCount: 0,
        todayBytes: 0,
        storageLeft: '--',
        storagePath: '/tmp',
      },
      {
        deviceId: 'x2',
        clientName: 'Active Device',
        ip: '10.0.0.2',
        status: 'transferring',
        todayFileCount: 5,
        todayBytes: 1024,
        storageLeft: '500 GB',
        storagePath: '/tmp',
        currentFile: { filename: 'test.mp4', progress: 50, fileSize: 100 },
      },
    ];
    useDashboardStore.getState().updateDevices(unsorted);
    const devices = useDashboardStore.getState().devices;
    expect(devices[0].deviceId).toBe('x2');
    expect(devices[1].deviceId).toBe('x1');
  });

  it('dismisses disk warning', () => {
    expect(useDashboardStore.getState().diskWarningDismissed).toBe(false);
    useDashboardStore.getState().dismissDiskWarning();
    expect(useDashboardStore.getState().diskWarningDismissed).toBe(true);
  });

  it('updates summary', () => {
    const newSummary: DashboardSummaryDTO = {
      todayUploadCount: 100,
      todayOccupiedBytes: 50 * 1024 ** 3,
      remainingBytes: 500 * 1024 ** 3,
      isDiskLow: true,
    };
    useDashboardStore.getState().updateSummary(newSummary);
    expect(useDashboardStore.getState().summary).toEqual(newSummary);
  });
});
