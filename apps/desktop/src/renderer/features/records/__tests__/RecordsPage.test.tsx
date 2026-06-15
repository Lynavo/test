import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DesktopAccessRecordDTO } from '@syncflow/contracts';
import { RecordsPage } from '../RecordsPage';
import { useManagementStore } from '@renderer/stores/management-store';

const accessRecord1: DesktopAccessRecordDTO = {
  recordId: 'access-1',
  desktopDeviceId: 'desktop-1',
  clientId: 'client-1',
  displayName: 'Galaxy S24',
  resourceId: 'res-1',
  resourceKind: 'received_file',
  resourceName: 'clip.mp4',
  action: 'download',
  result: 'ok',
  accessedAt: '2026-06-15T10:10:00Z',
};

const accessRecord2: DesktopAccessRecordDTO = {
  recordId: 'access-2',
  desktopDeviceId: 'desktop-1',
  clientId: 'client-1',
  displayName: 'Galaxy S24',
  resourceId: 'res-2',
  resourceKind: 'received_file',
  resourceName: 'photo.jpg',
  action: 'download',
  result: 'ok',
  accessedAt: '2026-06-15T10:15:00Z',
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
}

describe('RecordsPage', () => {
  beforeEach(() => {
    resetStore();
    vi.spyOn(useManagementStore.getState(), 'loadAccessRecords').mockResolvedValue();
    vi.spyOn(useManagementStore.getState(), 'loadDevices').mockResolvedValue();
  });

  it('renders filter search and date inputs', () => {
    render(<RecordsPage />);
    expect(screen.getByPlaceholderText('搜索用户名、设备或 IP')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('yyyy/mm/dd')).toHaveLength(2);
  });

  it('groups access records by device and date and displays them', () => {
    useManagementStore.setState({
      accessRecords: [accessRecord1, accessRecord2],
      devices: [
        {
          desktopDeviceId: 'dev-1',
          clientId: 'client-1',
          clientIdShort: 'cl-1',
          displayName: 'Galaxy S24',
          platform: 'Android',
          stableDeviceId: 'client-1',
          authorizationStatus: 'authorized',
          blockStatus: 'none',
          failedAttemptCount: 0,
          todayFileCount: 0,
          todayBytes: 0,
          totalFileCount: 0,
          totalBytes: 0,
          lastIp: '192.168.1.112',
          authorizedAt: '2026-06-15T00:00:00Z',
          lastSeenAt: '2026-06-15T10:15:00Z',
        },
      ],
    });

    render(<RecordsPage />);

    expect(screen.getByText('Galaxy S24')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('2026-06-15')).toBeInTheDocument();
  });

  it('filters sessions by search query', () => {
    useManagementStore.setState({
      accessRecords: [accessRecord1],
      devices: [
        {
          desktopDeviceId: 'dev-1',
          clientId: 'client-1',
          clientIdShort: 'cl-1',
          displayName: 'Galaxy S24',
          platform: 'Android',
          stableDeviceId: 'client-1',
          authorizationStatus: 'authorized',
          blockStatus: 'none',
          failedAttemptCount: 0,
          todayFileCount: 0,
          todayBytes: 0,
          totalFileCount: 0,
          totalBytes: 0,
          lastIp: '192.168.1.112',
          authorizedAt: '2026-06-15T00:00:00Z',
          lastSeenAt: '2026-06-15T10:15:00Z',
        },
      ],
    });

    render(<RecordsPage />);

    const searchInput = screen.getByPlaceholderText('搜索用户名、设备或 IP');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.queryByText('Galaxy S24')).not.toBeInTheDocument();
    expect(screen.getByText('尚无访问记录')).toBeInTheDocument();
  });

  it('renders empty and error states', () => {
    const { rerender } = render(<RecordsPage />);
    expect(screen.getByText('尚无访问记录')).toBeInTheDocument();

    useManagementStore.setState({ accessRecordsError: 'load failed' });
    rerender(<RecordsPage />);
    expect(screen.getByText('load failed')).toBeInTheDocument();
  });
});
