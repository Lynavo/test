import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSessionView } from '../../../../preload/api';
import { useAppStore } from '@renderer/stores/app-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { Sidebar } from '../Sidebar';

function setAuthSession(session: AuthSessionView | null) {
  const logout = vi.fn().mockResolvedValue({ ok: true });
  useAuthStore.setState({ session, loading: false });
  (window as Window & { electronAPI?: unknown }).electronAPI = {
    auth: {
      logout,
    },
  } as unknown as Window['electronAPI'];
  return { logout };
}

describe('Sidebar', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
    useAuthStore.setState({ session: null, loading: false });
    useAppStore.setState({
      currentView: 'dashboard',
      selectedDevice: null,
      isModalOpen: false,
    });
  });

  it('does not expose sign-in controls inside the desktop shell', () => {
    setAuthSession(null);

    render(<Sidebar />);

    expect(screen.queryByText('登录后可使用远端传输。')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '登录' })).not.toBeInTheDocument();
  });

  it('shows the authenticated account instead of the sign-in prompt', async () => {
    setAuthSession({ loggedIn: true, phone: '+8613800138000' });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('+8613800138000')).toBeInTheDocument();
    });
    expect(screen.queryByText('登录后可使用远端传输。')).not.toBeInTheDocument();
  });

  it('shows the authenticated email when it is available', async () => {
    setAuthSession({ loggedIn: true, email: 'ada@example.com' });

    render(<Sidebar />);

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByText('登录后可使用远端传输。')).not.toBeInTheDocument();
  });

  it('shows the authenticated account label when it is provided by the session view', async () => {
    setAuthSession({ loggedIn: true, accountLabel: 'ada@example.com' });

    render(<Sidebar />);

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByText('登录后可使用远端传输。')).not.toBeInTheDocument();
  });

  it('signs out from the authenticated account card', async () => {
    const { logout } = setAuthSession({ loggedIn: true, phone: '+8613800138000' });

    render(<Sidebar />);

    fireEvent.click(await screen.findByTitle('登出'));

    // Click confirm button in the confirmation dialog
    const confirmButton = await screen.findByRole('button', { name: '确认退出' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });

  it('exposes the desktop-local navigation entries and hides legacy folder management', async () => {
    setAuthSession(null);

    render(<Sidebar />);

    expect(screen.getByRole('button', { name: '共享管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '设备管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '同步记录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '访问记录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '目录管理' })).not.toBeInTheDocument();
  });

  it('uses the reference navigation icon mapping', async () => {
    setAuthSession(null);

    const { container } = render(<Sidebar />);

    expect(container.querySelector('button svg.lucide-hard-drive')).toBeInTheDocument();
    expect(container.querySelector('button svg.lucide-smartphone')).toBeInTheDocument();
    expect(container.querySelector('button svg.lucide-folder-open')).toBeInTheDocument();
    expect(container.querySelector('button svg.lucide-history')).toBeInTheDocument();
    expect(container.querySelector('button svg.lucide-settings')).toBeInTheDocument();
  });

  it('switches to each desktop-local view from the sidebar', async () => {
    setAuthSession(null);

    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: '设备管理' }));
    expect(useAppStore.getState().currentView).toBe('devices');

    fireEvent.click(screen.getByRole('button', { name: '同步记录' }));
    expect(useAppStore.getState().currentView).toBe('library');

    fireEvent.click(screen.getByRole('button', { name: '访问记录' }));
    expect(useAppStore.getState().currentView).toBe('records');

    fireEvent.click(screen.getByRole('button', { name: '我的' }));
    expect(useAppStore.getState().currentView).toBe('settings');
  });
});
