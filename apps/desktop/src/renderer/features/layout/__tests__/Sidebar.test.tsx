import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSessionView } from '../../../../preload/api';
import { useAppStore } from '@renderer/stores/app-store';
import { useAuthStore } from '@renderer/stores/auth-store';
import { Sidebar } from '../Sidebar';

vi.mock('@renderer/components/shared/LoginDialog', () => ({
  LoginDialog: ({
    open,
    title,
    description,
  }: {
    open: boolean;
    title?: string;
    description?: string;
  }) =>
    open ? (
      <div data-testid="login-dialog">
        <p>{title}</p>
        <p>{description}</p>
      </div>
    ) : null,
}));

function setAuthSession(session: AuthSessionView | null) {
  const getAuthSession = vi.fn().mockResolvedValue(session);
  const logout = vi.fn().mockResolvedValue({ ok: true });
  (window as Window & { electronAPI?: unknown }).electronAPI = {
    auth: {
      getAuthSession,
      logout,
    },
  } as unknown as Window['electronAPI'];
  return { getAuthSession, logout };
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

  it('shows a sign-in entry when the desktop is not authenticated', async () => {
    const { getAuthSession } = setAuthSession(null);

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('远端同步与传输需要登录')).toBeInTheDocument();
    });
    expect(getAuthSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('opens the login dialog from the sign-in entry', async () => {
    setAuthSession(null);

    render(<Sidebar />);

    fireEvent.click(await screen.findByRole('button', { name: '登录' }));

    expect(screen.getByTestId('login-dialog')).toBeInTheDocument();
    expect(screen.getByText('登录后可使用远端同步与传输。')).toBeInTheDocument();
  });

  it('shows the authenticated account instead of the sign-in prompt', async () => {
    setAuthSession({ loggedIn: true, phone: '+8613800138000' });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText('已登录')).toBeInTheDocument();
    });
    expect(screen.getByText('+8613800138000')).toBeInTheDocument();
    expect(screen.queryByText('远端同步与传输需要登录')).not.toBeInTheDocument();
  });

  it('signs out from the authenticated account card', async () => {
    const { logout } = setAuthSession({ loggedIn: true, phone: '+8613800138000' });

    render(<Sidebar />);

    fireEvent.click(await screen.findByRole('button', { name: '登出' }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
