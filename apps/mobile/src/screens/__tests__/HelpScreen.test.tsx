import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      languageCode: 'zh',
      scriptCode: 'Hant',
      countryCode: 'TW',
      languageTag: 'zh-Hant-TW',
      isRTL: false,
    },
  ],
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
  useFocusEffect: (callback: () => void | (() => void)) => callback(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));

jest.mock('../../utils/shareDiagnosticsArchive', () => ({
  isDiagnosticsExportUnavailable: jest.fn().mockReturnValue(false),
  shareDiagnosticsArchive: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    loadSubscription: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../hooks/useExpiryReminder', () => ({
  markSubscriptionJustActivated: jest.fn(),
}));

jest.mock('../../services/gift-card-service', () => ({
  getGiftCardConfig: jest.fn().mockResolvedValue({ enabled: false }),
  redeemGiftCard: jest.fn().mockResolvedValue({
    plan: 'monthly',
    giftCardId: 1001,
    startAt: '2026-05-12T00:00:00.000Z',
    expireAt: '2026-06-12T00:00:00.000Z',
    redeemedAt: '2026-05-12T00:00:00.000Z',
    remainingUses: 0,
    status: 'success',
  }),
}));

import i18n from '../../i18n';
import {
  getGiftCardConfig,
  redeemGiftCard,
} from '../../services/gift-card-service';
import { HelpScreen } from '../HelpScreen';

describe('HelpScreen', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('zh-Hant');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getGiftCardConfig as jest.Mock).mockResolvedValue({ enabled: false });
  });

  it('renders the v0 help-center copy and FAQ guidance', async () => {
    const { getByText } = render(<HelpScreen />);

    expect(getByText('幫助中心')).toBeTruthy();
    expect(
      getByText('區域網路素材無線同步工具，手機照片和影片高速傳至電腦'),
    ).toBeTruthy();
    expect(getByText('電腦瀏覽器訪問 vividrop.cn 下載安裝')).toBeTruthy();
    expect(getByText('手機掃碼或輸入 6 位連接碼')).toBeTruthy();

    fireEvent.press(getByText('一直顯示尋找設備怎麼辦？'));

    expect(
      getByText(
        '請確認手機和電腦處於同一 Wi-Fi 網路，且 Vivi Drop PC 端正在執行。嘗試重新啟動 PC 端後，在手機端點擊重新掃描，或改用 6 位連接碼手動連接。',
      ),
    ).toBeTruthy();

    await waitFor(() => {
      expect(getGiftCardConfig).toHaveBeenCalled();
    });
  });

  it('hides gift card redemption when the server switch is off', async () => {
    const { queryByText } = render(<HelpScreen />);

    await waitFor(() => {
      expect(getGiftCardConfig).toHaveBeenCalled();
    });

    expect(queryByText('禮品卡兌換')).toBeNull();
  });

  it('renders gift card redemption at the bottom when the server switch is on', async () => {
    (getGiftCardConfig as jest.Mock).mockResolvedValue({ enabled: true });

    const { getByText } = render(<HelpScreen />);

    await waitFor(() => {
      expect(getByText('禮品卡兌換')).toBeTruthy();
    });

    expect(getByText('輸入禮品卡代碼以啟用或延長訂閱。')).toBeTruthy();
  });

  it('localizes gift card already-redeemed errors from Help', async () => {
    (getGiftCardConfig as jest.Mock).mockResolvedValue({ enabled: true });
    (redeemGiftCard as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('此账号已兑换过此礼品卡'), { code: 3004 }),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText, getByPlaceholderText } = render(<HelpScreen />);

    await waitFor(() => {
      expect(getByText('禮品卡兌換')).toBeTruthy();
    });

    fireEvent.press(getByText('禮品卡兌換'));
    fireEvent.changeText(
      getByPlaceholderText('輸入禮品卡代碼'),
      'vivi-abcd-efgh-ijkl',
    );
    fireEvent.press(getByText('兌換'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '兌換失敗',
        '此帳號已兌換過此禮品卡。',
      );
    });
    alertSpy.mockRestore();
  });
});
