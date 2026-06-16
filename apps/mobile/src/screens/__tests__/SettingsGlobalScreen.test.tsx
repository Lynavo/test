import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SettingsGlobalScreen } from '../SettingsGlobalScreen';

const mockNavigate = jest.fn();
const mockClearAuth = jest.fn();
const mockSetSignedOutTransition = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../stores/auth-store', () => ({
  useAuth: () => ({
    clearAuth: mockClearAuth,
    setSignedOutTransition: mockSetSignedOutTransition,
  }),
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

describe('SettingsGlobalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the reference my-page sections and rows', () => {
    const { getByText } = render(<SettingsGlobalScreen />);

    expect(getByText('我的')).toBeTruthy();
    expect(getByText('账号、设备和应用偏好。')).toBeTruthy();

    expect(getByText('我的账户')).toBeTruthy();
    expect(getByText('+1 206 **** 1234')).toBeTruthy();
    expect(getByText('会员状态')).toBeTruthy();
    expect(getByText('crown-outline')).toBeTruthy();
    expect(getByText('Pro Annual · 剩余 28 天')).toBeTruthy();
    expect(getByText('恢复已购买订阅')).toBeTruthy();
    expect(getByText('设备名称')).toBeTruthy();

    expect(getByText('电脑设备')).toBeTruthy();
    expect(getByText('MacBook Pro')).toBeTruthy();
    expect(getByText('当前设备')).toBeTruthy();
    expect(getByText('切换设备')).toBeTruthy();

    expect(getByText('通用')).toBeTruthy();
    expect(getByText('语言')).toBeTruthy();
    expect(getByText('简体中文')).toBeTruthy();
    expect(getByText('常见问题')).toBeTruthy();
    expect(getByText('版本')).toBeTruthy();
    expect(getByText('message-square-outline')).toBeTruthy();
    expect(getByText('版本 2.1.0')).toBeTruthy();
    expect(getByText('上传诊断包')).toBeTruthy();
    expect(getByText('退出登录')).toBeTruthy();
    expect(getByText('注销账号')).toBeTruthy();
  });

  test('keeps content bottom spacing aligned with the reference page padding', () => {
    const { getByTestId } = render(<SettingsGlobalScreen />);

    const contentStyle = StyleSheet.flatten(
      getByTestId('global-settings-scroll').props.contentContainerStyle,
    );

    expect(contentStyle.paddingBottom).toBe(24);
  });

  test('navigates from reference action rows', () => {
    const { getByText } = render(<SettingsGlobalScreen />);

    fireEvent.press(getByText('会员状态'));
    expect(mockNavigate).toHaveBeenCalledWith('Subscription');

    fireEvent.press(getByText('切换设备'));
    expect(mockNavigate).toHaveBeenCalledWith('DeviceDiscovery', {
      mode: 'switch',
    });

    fireEvent.press(getByText('常见问题'));
    expect(mockNavigate).toHaveBeenCalledWith('Help');
  });

  test('opens the reference edit device name modal and saves the new name', () => {
    const { getByDisplayValue, getByTestId, getByText, queryByText } = render(
      <SettingsGlobalScreen />,
    );

    fireEvent.press(getByTestId('global-settings-edit-device-name'));

    expect(getByText('编辑设备名称')).toBeTruthy();
    expect(
      getByText('修改后会用于当前设备在同步记录中的显示名称。'),
    ).toBeTruthy();

    fireEvent.changeText(getByDisplayValue('iPhone 15 Pro'), 'Studio iPhone');
    fireEvent.press(getByText('保存'));

    expect(getByText('Studio iPhone')).toBeTruthy();
    expect(queryByText('编辑设备名称')).toBeNull();
  });

  test('opens the reference restore purchase modal', () => {
    const { getAllByText, getByText, getByTestId, queryByText } = render(
      <SettingsGlobalScreen />,
    );

    fireEvent.press(getByTestId('global-settings-restore-purchase'));

    expect(getAllByText('恢复已购买订阅')).toHaveLength(2);
    expect(
      getByText('正在从应用商店检查当前账号的历史购买记录。'),
    ).toBeTruthy();

    fireEvent.press(getByText('知道了'));
    expect(queryByText('正在从应用商店检查当前账号的历史购买记录。')).toBeNull();
  });

  test('opens the reference language view from the language row', () => {
    const { getByText, getByTestId, queryByText } = render(
      <SettingsGlobalScreen />,
    );

    fireEvent.press(getByTestId('global-settings-language'));

    expect(getByText('跟随系统语言')).toBeTruthy();
    expect(getByText('手动选择语言')).toBeTruthy();

    fireEvent.press(getByText('手动选择语言'));

    expect(getByText('English')).toBeTruthy();
    expect(getByText('日本語')).toBeTruthy();

    fireEvent.press(getByTestId('global-language-back'));
    expect(queryByText('跟随系统语言')).toBeNull();
    expect(getByText('我的')).toBeTruthy();
  });

  test('opens confirmation modals before logging out or deleting account', () => {
    const { getByText, getByTestId, queryByText } = render(
      <SettingsGlobalScreen />,
    );

    fireEvent.press(getByTestId('global-settings-logout'));
    expect(getByText('确定要退出当前账号吗？')).toBeTruthy();
    expect(mockClearAuth).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('global-settings-confirm-logout'));
    expect(mockSetSignedOutTransition).toHaveBeenCalledWith('logout');
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(queryByText('确定要退出当前账号吗？')).toBeNull();

    fireEvent.press(getByTestId('global-settings-delete-account'));
    expect(getByText('确定要注销当前账号吗？此操作不可撤销。')).toBeTruthy();

    fireEvent.press(getByTestId('global-settings-cancel-delete-account'));
    expect(queryByText('确定要注销当前账号吗？此操作不可撤销。')).toBeNull();
  });
});
