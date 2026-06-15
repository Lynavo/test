import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelpDialog } from '../HelpDialog';
import { useAppStore } from '@renderer/stores/app-store';
import { useDashboardStore } from '@renderer/stores/dashboard-store';
import { useSidecarRuntimeStore } from '@renderer/stores/sidecar-runtime-store';
import { toast } from 'sonner';

const supportAPIMock = {
  uploadDiagnostics: vi.fn(),
  exportDiagnostics: vi.fn(),
};

const filesAPIMock = {
  openExternal: vi.fn(),
};

vi.mock('@renderer/components/shared/GlassCard', () => ({
  GlassCard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="glass-card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@renderer/components/ui/accordion', () => ({
  Accordion: ({ children }: { children: React.ReactNode; type?: string }) => (
    <div data-testid="accordion">{children}</div>
  ),
  AccordionItem: ({ children }: { children: React.ReactNode; value?: string }) => (
    <div data-testid="accordion-item">{children}</div>
  ),
  AccordionTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <button data-testid="accordion-trigger" className={className}>
      {children}
    </button>
  ),
  AccordionContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="accordion-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('HelpDialog', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();

    // Reset stores
    useAppStore.setState({
      isHelpOpen: true,
      currentView: 'dashboard',
    });
    useDashboardStore.setState({
      summary: {
        todayUploadCount: 0,
        todayOccupiedBytes: 0,
        remainingBytes: 0,
        isDiskLow: false,
        lastSuccessfulSyncAt: '2026-06-15T12:00:00Z',
        lastSuccessfulDeviceName: 'iPhone 15 Pro',
      },
    });
    useSidecarRuntimeStore.setState({
      runtime: {
        status: 'healthy',
        message: null,
        messageCode: null,
        messageArgs: null,
        restartCount: 0,
        maxRestarts: 3,
        lastExitCode: null,
        bonjour: {
          status: 'native',
          source: 'system',
          message: null,
          messageCode: null,
          messageArgs: null,
          path: null,
          advertisedIP: '192.168.1.100',
        },
      },
    });

    // Mock electronAPI
    (window as any).electronAPI = {
      support: supportAPIMock,
      files: filesAPIMock,
    };
  });

  it('renders dialog header when open is true', () => {
    render(<HelpDialog />);

    expect(screen.getByText(/帮助中心|說明中心/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    useAppStore.setState({ isHelpOpen: false });
    render(<HelpDialog />);

    expect(screen.queryByText(/帮助中心|說明中心/i)).not.toBeInTheDocument();
  });

  it('renders active introduction tab content by default', () => {
    render(<HelpDialog />);

    expect(screen.getByRole('heading', { name: /基础功能介绍|基礎功能介紹/i })).toBeInTheDocument();
    expect(screen.getByText(/ViviDrop 是什么|ViviDrop 是什麼/i)).toBeInTheDocument();
    expect(screen.getByText(/ViviDrop 是一款专为创作者和团队打造|ViviDrop 是一款專為創作者和團隊打造/i)).toBeInTheDocument();
  });

  it('switches tabs to Quick Start and displays steps and permissions', async () => {
    render(<HelpDialog />);

    const quickStartTab = screen.getByRole('button', { name: /快速开始|快速開始/i });
    fireEvent.click(quickStartTab);

    // Verify quick start steps
    expect(screen.getByText(/选择同步目录|選擇同步目錄/i)).toBeInTheDocument();
    expect(screen.getByText(/获取连接码并连接|取得連線碼並連線/i)).toBeInTheDocument();

    // Verify permissions section
    expect(screen.getByText(/Windows 系统设置|Windows 系統設定/i)).toBeInTheDocument();
    expect(screen.getByText(/macOS 系统设置|macOS 系統設定/i)).toBeInTheDocument();
    expect(screen.getByText(/确保 Vivi Drop 被设为|確保 Vivi Drop 被設為/i)).toBeInTheDocument();
  });

  it('switches tabs to Directory & Share instructions', () => {
    render(<HelpDialog />);

    const directoryTab = screen.getByRole('button', { name: /目录说明|目錄說明/i });
    fireEvent.click(directoryTab);

    expect(screen.getByText(/接收目录 \(received\)|接收目錄 \(received\)/i)).toBeInTheDocument();
    expect(screen.getByText(/个人共享目录 \(personal\)|個人共享目錄 \(personal\)/i)).toBeInTheDocument();
    expect(screen.getByText(/团队共享目录 \(shared\)|團隊共享目錄 \(shared\)/i)).toBeInTheDocument();
    expect(screen.getByText(/received\/.*接收局域网|received\/.*接收局域網/i)).toBeInTheDocument();

    // Verify upload rules
    expect(screen.getByText(/上传规则说明|上傳規則說明/i)).toBeInTheDocument();
    expect(screen.getByText(/自动上传与手动上传可并行存在|自動上傳與手動上傳可併行存在/i)).toBeInTheDocument();
  });

  it('uses My Computer directory copy and hides team shared directory in global builds', () => {
    vi.stubEnv('SYNCFLOW_MARKET', 'global');
    render(<HelpDialog />);

    const directoryTab = screen.getByRole('button', { name: /目录说明|目錄說明/i });
    fireEvent.click(directoryTab);

    expect(screen.getByText(/我的电脑 \(personal\)|我的電腦 \(personal\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/团队共享目录 \(shared\)|團隊共享目錄 \(shared\)/i)).not.toBeInTheDocument();
  });

  it('switches tabs to FAQ and displays accordion & error cards', () => {
    render(<HelpDialog />);

    const faqTab = screen.getByRole('button', { name: /常见问题|常見問題/i });
    fireEvent.click(faqTab);

    expect(screen.getByText(/手机找不到电脑怎么办|手機找不到電腦怎麼辦/i, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/异常处理说明|異常處理說明/i)).toBeInTheDocument();
    expect(screen.getByText(/连接异常|連接異常/i)).toBeInTheDocument();
  });

  it('switches tabs to Contact Us and displays contact info and diagnostics form', () => {
    render(<HelpDialog />);

    const contactTab = screen.getByRole('button', { name: /支持与诊断|支援與診斷/i });
    fireEvent.click(contactTab);

    expect(screen.getByText(/发送邮件反馈|傳送郵件反饋/i)).toBeInTheDocument();
    expect(screen.getByText('developer@vividrop.app')).toBeInTheDocument();
    expect(screen.getByText(/当前网络与广播状态|當前網路與廣播狀態/i)).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
  });

  it('supports feedback email button click', () => {
    render(<HelpDialog />);

    const contactTab = screen.getByRole('button', { name: /支持与诊断|支援與診斷/i });
    fireEvent.click(contactTab);

    const emailButton = screen.getByRole('button', { name: /开启邮件客户端|開啟郵件用戶端/i });
    fireEvent.click(emailButton);

    expect(filesAPIMock.openExternal).toHaveBeenCalledWith('mailto:developer@vividrop.app');
  });

  it('uploads diagnostics packet successfully when form is filled and submitted', async () => {
    supportAPIMock.uploadDiagnostics.mockResolvedValue({ refId: 'DX-12345' });

    render(<HelpDialog />);

    const contactTab = screen.getByRole('button', { name: /支持与诊断|支援與診斷/i });
    fireEvent.click(contactTab);

    const textarea = screen.getByPlaceholderText(/请描述出现问题的步骤|請描述出現問題的步驟/i);
    fireEvent.change(textarea, { target: { value: 'App crashed when opening library' } });

    const submitBtn = screen.getByRole('button', { name: /上传|上傳/i });
    fireEvent.click(submitBtn);

    expect(supportAPIMock.uploadDiagnostics).toHaveBeenCalledWith({
      description: 'App crashed when opening library',
      locale: expect.any(String),
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/诊断包已上传|診斷包已上傳|诊断包上传成功|診斷包上傳成功/i),
        expect.any(Object),
      );
    });
  });

  it('falls back to local export when network upload is unreachable', async () => {
    const netError = new Error('NETWORK_UNREACHABLE');
    (netError as any).code = 'NETWORK_UNREACHABLE';
    supportAPIMock.uploadDiagnostics.mockRejectedValue(netError);
    supportAPIMock.exportDiagnostics.mockResolvedValue('/downloads/vivi-drop-diagnostics.zip');

    render(<HelpDialog />);

    const contactTab = screen.getByRole('button', { name: /支持与诊断|支援與診斷/i });
    fireEvent.click(contactTab);

    const textarea = screen.getByPlaceholderText(/请描述出现问题的步骤|請描述出現問題的步驟/i);
    fireEvent.change(textarea, { target: { value: 'Connection failed' } });

    const submitBtn = screen.getByRole('button', { name: /上传|上傳/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(supportAPIMock.exportDiagnostics).toHaveBeenCalledWith(
        expect.any(String),
        'Connection failed',
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/已导出诊断包至本地|已匯出診斷包至本機|无法上传，已改为本地导出诊断包|無法上傳，已改為本機匯出診斷包/i),
        expect.any(Object),
      );
    });
  });
});
