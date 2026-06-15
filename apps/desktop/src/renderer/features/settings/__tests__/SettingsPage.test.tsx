import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { useAuthStore } from '@renderer/stores/auth-store';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setElectronPlatform() {
  (window as Window & { electronAPI?: unknown }).electronAPI = {
    platform: {
      getLocalIPs: () => ['192.168.0.227'],
    },
    power: {
      getState: vi.fn().mockResolvedValue({ preventSleepDuringTransfer: false }),
      setPreventSleepDuringTransfer: vi
        .fn()
        .mockResolvedValue({ preventSleepDuringTransfer: true }),
    },
    support: {
      checkForUpdates: vi.fn().mockResolvedValue(null),
      uploadDiagnostics: vi.fn().mockResolvedValue(null),
    },
    files: {
      openExternal: vi.fn().mockResolvedValue(null),
    },
    events: {
      onSidecarEvent: vi.fn(() => vi.fn()),
      onSidecarRuntimeState: vi.fn(() => vi.fn()),
    },
  } as unknown as Window['electronAPI'];
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setElectronPlatform();
    useAuthStore.setState({
      session: {
        loggedIn: true,
        email: 'test@vividrop.app',
        phone: '',
      },
    });
  });

  it('renders the page title "我的"', () => {
    render(<SettingsPage />);
    expect(screen.getByText('我的')).toBeInTheDocument();
  });

  it('renders the "我的账户" section with membership status', () => {
    render(<SettingsPage />);
    expect(screen.getByText('我的账户')).toBeInTheDocument();
    expect(screen.getByText('test@vividrop.app')).toBeInTheDocument();
    expect(screen.getByText('会员状态')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders the prevent sleep standby option', async () => {
    render(<SettingsPage />);
    expect(screen.getByText('防止待机')).toBeInTheDocument();
    expect(screen.getByText('传输任务运行时保持电脑唤醒')).toBeInTheDocument();

    const switchBtn = screen.getByRole('button', { name: '防止待机' });
    expect(switchBtn).toBeInTheDocument();
  });

  it('opens a searchable language picker', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /界面语言/ }));

    const search = screen.getByRole('searchbox', { name: '搜索语言' });
    expect(search).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'English' } });
    expect(screen.getByRole('button', { name: /English/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /繁體中文/ })).not.toBeInTheDocument();
  });

  it('renders the local IP', () => {
    render(<SettingsPage />);
    expect(screen.getByText('本机 IP')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.227')).toBeInTheDocument();
  });

  it('renders check for updates and triggers check updates action', async () => {
    render(<SettingsPage />);
    const updateBtn = screen.getByRole('button', { name: '检查更新' });
    expect(updateBtn).toBeInTheDocument();

    fireEvent.click(updateBtn);
    expect(window.electronAPI?.support.checkForUpdates).toHaveBeenCalled();
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('已是最新版本');
    });
  });

  it('renders support section and handles log upload', async () => {
    render(<SettingsPage />);
    const uploadBtn = screen.getByRole('button', { name: '上传' });
    expect(uploadBtn).toBeInTheDocument();

    fireEvent.click(uploadBtn);
    expect(window.electronAPI?.support.uploadDiagnostics).toHaveBeenCalled();
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('诊断包上传成功！感谢您的反馈');
    });
  });

  it('opens feedback panel and sends a composed email link', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: /问题反馈/ }));
    fireEvent.change(screen.getByPlaceholderText('请描述问题、发生步骤或希望改进的地方'), {
      target: { value: '手机无法连接电脑' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(window.electronAPI?.files.openExternal).toHaveBeenCalledWith(
      expect.stringContaining('mailto:developer@vividrop.app'),
    );
    expect(window.electronAPI?.files.openExternal).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('手机无法连接电脑')),
    );
  });
});
