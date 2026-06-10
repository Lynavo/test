import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '@renderer/i18n';
import { ConnectionDevicesSection } from '../ConnectionDevicesSection';
import { useConnectionDevicesStore } from '@renderer/stores/connection-devices-store';

describe('ConnectionDevicesSection', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage('zh-Hant');
    useConnectionDevicesStore.setState({
      data: {
        authorizedDevices: [
          {
            clientId: 'phone-a',
            displayName: 'Nick iPhone',
            clientName: 'Nick iPhone',
            platform: 'ios',
            ip: '192.168.1.20',
            status: 'authorized',
            authorizedAt: '2026-06-10T01:00:00Z',
            lastSeenAt: '2026-06-10T01:10:00Z',
          },
        ],
        blockedClients: [
          {
            clientId: 'phone-b',
            displayName: 'Blocked Phone',
            platform: 'android',
            lastIp: '192.168.1.30',
            failedAttempts: 5,
            blockedAt: '2026-06-10T01:11:00Z',
            lastAttemptAt: '2026-06-10T01:11:00Z',
            reason: 'wrong_connection_code_limit',
          },
        ],
        recentAttempts: [
          {
            id: 1,
            clientId: 'phone-b',
            displayName: 'Blocked Phone',
            result: 'wrong_code',
            failureReason: 'PAIRING_CODE_INVALID',
            createdAt: '2026-06-10T01:10:00Z',
          },
        ],
      },
      loading: false,
      error: null,
      busyClientId: null,
      fetchConnectionDevices: vi.fn().mockResolvedValue(undefined),
      revokeDevice: vi.fn().mockResolvedValue(undefined),
      clearBlock: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('renders authorized devices, blocked clients, and read-only attempts', () => {
    render(<ConnectionDevicesSection />);

    expect(screen.getByText('Nick iPhone')).toBeInTheDocument();
    expect(screen.getAllByText('Blocked Phone')).toHaveLength(2);
    expect(screen.getByText('PAIRING_CODE_INVALID')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /delete|remove|skip|reorder|刪除|移除|略過|重新排序|删除|跳过|重排/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('confirms before revoking authorization', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ConnectionDevicesSection />);
    fireEvent.click(screen.getByRole('button', { name: /撤銷授權|撤销授权|Revoke/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      '撤銷後，這台手機下次必須重新輸入電腦端連接碼。確定要撤銷？',
    );
    expect(useConnectionDevicesStore.getState().revokeDevice).toHaveBeenCalledWith('phone-a');
  });

  it('confirms before clearing a block', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ConnectionDevicesSection />);
    fireEvent.click(screen.getByRole('button', { name: /解除封鎖|解除封锁|Clear/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      '解除封鎖不會自動授權手機，手機仍需輸入正確連接碼。確定要解除？',
    );
    expect(useConnectionDevicesStore.getState().clearBlock).toHaveBeenCalledWith('phone-b');
  });
});
