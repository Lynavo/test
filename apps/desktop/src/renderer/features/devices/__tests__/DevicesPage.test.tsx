import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DesktopManagedDeviceDTO } from '@syncflow/contracts';
import { DevicesPage } from '../DevicesPage';
import { useManagementStore } from '@renderer/stores/management-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';

const authorizedDevice: DesktopManagedDeviceDTO = {
  desktopDeviceId: 'desktop-1',
  clientId: 'client-1',
  clientIdShort: 'client-1234',
  displayName: 'iPhone 15 Pro',
  platform: 'ios',
  lastIp: '192.168.1.20',
  authorizedAt: '2026-06-01T08:00:00Z',
  lastSeenAt: '2026-06-15T09:30:00Z',
  authorizationStatus: 'authorized',
  blockStatus: 'none',
  failedAttemptCount: 0,
  todayFileCount: 4,
  todayBytes: 4096,
  totalFileCount: 20,
  totalBytes: 8192,
};

const blockedDevice: DesktopManagedDeviceDTO = {
  ...authorizedDevice,
  desktopDeviceId: 'desktop-2',
  clientId: 'blocked-client',
  clientIdShort: 'blocked-client',
  displayName: 'Galaxy S24',
  platform: 'android',
  authorizationStatus: 'revoked',
  blockStatus: 'active',
  failedAttemptCount: 5,
  blockedAt: '2026-06-15T09:00:00Z',
  blockReason: 'too_many_failed_attempts',
};

function resetStore() {
  useManagementStore.setState({
    devices: [],
    syncRecords: [],
    accessRecords: [],
    devicesLoading: false,
    syncRecordsLoading: false,
    accessRecordsLoading: false,
    devicesError: null,
    syncRecordsError: null,
    accessRecordsError: null,
  });
  useDashboardStore.setState({
    devices: [],
  });
}

describe('DevicesPage', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(useManagementStore.getState(), 'loadDevices').mockResolvedValue();
  });

  it('displays authorized device', () => {
    useManagementStore.setState({ devices: [authorizedDevice] });
    // Mock the dashboard state to show the device is connected
    useDashboardStore.setState({
      devices: [
        {
          deviceId: 'client-1',
          stableDeviceId: 'client-1',
          displayName: 'iPhone 15 Pro',
          clientName: 'iPhone',
          platform: 'ios',
          ip: '192.168.1.100',
          status: 'connected_idle',
          todayFileCount: 0,
          todayBytes: 0,
          storageLeft: '10 GB',
          storagePath: '/tmp',
          devicePath: '/tmp/client-1',
        },
      ],
    });

    render(<DevicesPage />);

    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getAllByText('已连接').length).toBeGreaterThan(0);
  });

  it('displays blocked device with manual unblock action', () => {
    useManagementStore.setState({ devices: [blockedDevice] });

    render(<DevicesPage />);

    expect(screen.getByText('Galaxy S24')).toBeInTheDocument();
    expect(screen.getAllByText('已禁用').length).toBeGreaterThan(0);
    expect(screen.getByText('输错连接码超过 5 次，已自动禁用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消禁用' })).toBeInTheDocument();
  });

  it('renders a real empty state', () => {
    render(<DevicesPage />);

    expect(screen.getByText('尚无设备')).toBeInTheDocument();
    expect(screen.getByText('通过连接码授权后的移动端设备会显示在这里。')).toBeInTheDocument();
  });

  it('clicking unblock calls store action', async () => {
    const unblockDevice = vi
      .spyOn(useManagementStore.getState(), 'unblockDevice')
      .mockResolvedValue();
    useManagementStore.setState({ devices: [blockedDevice], unblockDevice });

    render(<DevicesPage />);
    fireEvent.click(screen.getByRole('button', { name: '取消禁用' }));

    await waitFor(() => {
      expect(unblockDevice).toHaveBeenCalledWith(blockedDevice.clientId);
    });
  });
});
