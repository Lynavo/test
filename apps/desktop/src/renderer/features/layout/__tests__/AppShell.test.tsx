import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SidecarEvent } from '@syncflow/contracts';
import type { AuthSessionView } from '../../../../preload/api';
import { useAppStore } from '@renderer/stores/app-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { useDirectoryStore } from '@renderer/stores/directory-store';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';
import { INITIAL_SIDECAR_RUNTIME_STATE } from '../../../../shared/sidecar-runtime';
import { AppShell } from '../AppShell';

vi.mock('../Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock('../SidecarStatusBanner', () => ({
  SidecarStatusBanner: () => <div data-testid="sidecar-status-banner" />,
}));

vi.mock('@renderer/features/dashboard/Dashboard', () => ({
  Dashboard: () => <main>DashboardPage</main>,
}));

vi.mock('@renderer/features/settings/SettingsPage', () => ({
  SettingsPage: () => <main>SettingsPage</main>,
}));

vi.mock('@renderer/features/help/HelpDialog', () => ({
  HelpDialog: () => <div data-testid="help-dialog">HelpDialog</div>,
}));

vi.mock('@renderer/features/device-detail/DeviceDetailPage', () => ({
  DeviceDetailPage: () => <main>DeviceDetailPage</main>,
}));

vi.mock('@renderer/features/devices/DevicesPage', () => ({
  DevicesPage: () => <main>DevicesPage</main>,
}));

vi.mock('@renderer/features/records/RecordsPage', () => ({
  RecordsPage: () => <main>RecordsPage</main>,
}));

vi.mock('@renderer/features/shared/SharedResourcesPage', () => ({
  SharedResourcesPage: () => <main>SharedResourcesPage</main>,
}));

vi.mock('@renderer/features/library/ReceivedLibraryPage', () => ({
  ReceivedLibraryPage: () => <main>ReceivedLibraryPage</main>,
}));

vi.mock('@renderer/features/directory/DirectoryPage', () => ({
  DirectoryPage: () => <main data-testid="legacy-directory-page">DirectoryPage</main>,
}));

function installElectronAPI(
  session: AuthSessionView | null = { loggedIn: true, email: 'ada@example.com' },
) {
  let sidecarEventCallback: ((event: SidecarEvent) => void) | null = null;
  const onSidecarEvent = vi.fn((callback: (event: SidecarEvent) => void) => {
    sidecarEventCallback = callback;
    return vi.fn();
  });
  const onSidecarRuntimeState = vi.fn(() => vi.fn());

  (window as Window & { electronAPI?: unknown }).electronAPI = {
    sidecar: {
      getRuntimeState: vi.fn().mockResolvedValue(INITIAL_SIDECAR_RUNTIME_STATE),
    },
    events: {
      onSidecarEvent,
      onSidecarRuntimeState,
    },
    auth: {
      getAuthSession: vi.fn().mockResolvedValue(session),
      logout: vi.fn().mockResolvedValue({ ok: true }),
    },
  } as unknown as Window['electronAPI'];

  return {
    emitSidecarEvent(event: SidecarEvent) {
      if (!sidecarEventCallback) {
        throw new Error('AppShell did not subscribe to sidecar events');
      }
      sidecarEventCallback(event);
    },
    onSidecarEvent,
  };
}

describe('AppShell', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
    useAppStore.setState({
      currentView: 'dashboard',
      selectedDevice: null,
      isModalOpen: false,
      isHelpOpen: false,
    });
    useSidecarRuntimeStore.setState({ runtime: INITIAL_SIDECAR_RUNTIME_STATE });
    useAuthStore.setState({ session: null, loading: false });
    vi.restoreAllMocks();
  });

  it('renders the full-page login screen instead of the desktop shell when not authenticated', async () => {
    installElectronAPI(null);

    render(<AppShell />);

    expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByText('DashboardPage')).not.toBeInTheDocument();
  });

  it.each([
    ['shared', 'SharedResourcesPage'],
    ['library', 'ReceivedLibraryPage'],
    ['devices', 'DevicesPage'],
    ['records', 'RecordsPage'],
  ] as const)('renders the %s page', async (view, pageText) => {
    installElectronAPI();
    useAppStore.setState({ currentView: view });

    render(<AppShell />);

    expect(await screen.findByText(pageText)).toBeInTheDocument();
  });

  it('does not refresh the legacy directory store when shared.directory.changed arrives', async () => {
    const fetchSharedFiles = vi
      .spyOn(useDirectoryStore.getState(), 'fetchSharedFiles')
      .mockResolvedValue();
    const { emitSidecarEvent } = installElectronAPI();

    render(<AppShell />);

    await waitFor(() => {
      expect(window.electronAPI?.events.onSidecarEvent).toHaveBeenCalledTimes(1);
    });
    emitSidecarEvent({ type: 'shared.directory.changed', payload: { path: '/tmp/shared' } });

    expect(fetchSharedFiles).not.toHaveBeenCalled();
  });

  it('does not load the legacy directory page for desktop-local management views', () => {
    installElectronAPI();
    useAppStore.setState({ currentView: 'devices' });

    render(<AppShell />);

    expect(screen.queryByTestId('legacy-directory-page')).not.toBeInTheDocument();
  });

  it('opens help dialog when clicking help button', async () => {
    installElectronAPI();
    const setHelpOpenSpy = vi.spyOn(useAppStore.getState(), 'setHelpOpen');

    render(<AppShell />);

    const helpButton = await screen.findByRole('button', {
      name: /帮助|幫助|layout\.nav\.help/i,
    });
    helpButton.click();

    expect(setHelpOpenSpy).toHaveBeenCalledWith(true);
  });

  it('opens the mobile download QR panel from the top action', async () => {
    installElectronAPI();

    render(<AppShell />);

    fireEvent.click(await screen.findByRole('button', { name: '下载移动端' }));

    expect(screen.getByText('扫码下载移动端')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'App Store' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Android' })).toBeInTheDocument();
  });
});
