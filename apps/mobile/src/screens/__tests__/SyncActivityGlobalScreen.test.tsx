import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { SyncActivityGlobalScreen } from '../SyncActivityGlobalScreen';
import { listDownloadRecords } from '../../services/download-records-service';
import { getAutoUploadConfig } from '../../services/SyncEngineModule';

const mockRecentDownloadsSection = jest.fn();
let mockVisualQaEnabled = false;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactInner = require('react');
    ReactInner.useEffect(effect, [effect]);
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    edges,
  }: {
    children: React.ReactNode;
    edges?: string[];
  }) => (
    (() => {
      const ReactInner = require('react');
      const { View } = require('react-native');
      return ReactInner.createElement(
        View,
        { testID: 'sync-activity-global-safe-area', edges },
        children,
      );
    })()
  ),
}));

jest.mock('../../components/GlobalGradientBackground', () => ({
  GlobalGradientBackground: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../../components/GlobalBottomTabBar', () => ({
  GlobalBottomTabBar: () => {
    const ReactInner = require('react');
    const { View } = require('react-native');
    return ReactInner.createElement(View, {
      testID: 'global-bottom-tab-bar',
    });
  },
}));

jest.mock('../../components/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const ReactInner = require('react');
    const { Text } = require('react-native');
    return ReactInner.createElement(Text, null, name);
  },
}));

jest.mock('../components/GlobalSyncActivityHomeSections', () => ({
  RecentDownloadsSection: (props: {
    records: Array<{ filename: string }>;
  }) => {
    mockRecentDownloadsSection(props);
    const ReactInner = require('react');
    const { Text, View } = require('react-native');
    return ReactInner.createElement(
      View,
      { testID: 'recent-downloads-section' },
      props.records.map(record =>
        ReactInner.createElement(Text, { key: record.filename }, record.filename),
      ),
    );
  },
  GlobalSyncRecordTimelineSection: () => {
    const ReactInner = require('react');
    const { View } = require('react-native');
    return ReactInner.createElement(View, {
      testID: 'global-sync-record-timeline-section',
    });
  },
}));

jest.mock('../../services/download-records-service', () => ({
  listDownloadRecords: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/SyncEngineModule', () => ({
  getAutoUploadConfig: jest.fn().mockResolvedValue({
    enabled: false,
    state: 'disabled',
    timeRangeMode: 'all',
  }),
}));

jest.mock('../../dev/visualQa', () => ({
  isVisualQaEnabled: () => mockVisualQaEnabled,
  isVisualQaHomeEmptyStateEnabled: () => false,
}));

describe('SyncActivityGlobalScreen', () => {
  beforeEach(() => {
    mockVisualQaEnabled = false;
    mockRecentDownloadsSection.mockClear();
    (listDownloadRecords as jest.Mock).mockResolvedValue([]);
    (getAutoUploadConfig as jest.Mock).mockResolvedValue({
      enabled: false,
      state: 'disabled',
      timeRangeMode: 'all',
    });
  });

  test('does not reserve bottom safe-area inside the main tab content', async () => {
    const { getByTestId } = render(
      <SyncActivityGlobalScreen showBottomTabBar={false} />,
    );

    await waitFor(() => {
      expect(listDownloadRecords).toHaveBeenCalled();
    });

    expect(getByTestId('sync-activity-global-safe-area').props.edges).toEqual([
      'top',
      'left',
      'right',
    ]);
  });

  test('uses visual QA recent-download mocks when the stored download history is empty', async () => {
    mockVisualQaEnabled = true;

    const { getByText, queryByTestId } = render(
      <SyncActivityGlobalScreen showBottomTabBar={false} />,
    );

    await waitFor(() => {
      expect(getByText('Client-Handoff.mov')).toBeTruthy();
    });
    expect(queryByTestId('recent-download-empty-state')).toBeNull();
    expect(mockRecentDownloadsSection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        records: expect.arrayContaining([
          expect.objectContaining({ filename: 'Client-Handoff.mov' }),
        ]),
      }),
    );
  });

  test('shows upload progress only after auto upload is active', async () => {
    (getAutoUploadConfig as jest.Mock).mockResolvedValueOnce({
      enabled: true,
      state: 'active',
      timeRangeMode: 'all',
    });

    const { getByText, queryByText } = render(
      <SyncActivityGlobalScreen showBottomTabBar={false} />,
    );

    expect(queryByText('上传中 · 本次传输进度')).toBeNull();

    await waitFor(() => {
      expect(getByText('上传中 · 本次传输进度')).toBeTruthy();
    });

    expect(getByText('已上传96/128')).toBeTruthy();
    expect(getByText('75%')).toBeTruthy();
    expect(getByText('传输速度')).toBeTruthy();
    expect(getByText('68.5 MB/s')).toBeTruthy();
    expect(getByText('传输进度')).toBeTruthy();
    expect(getByText('文件大小')).toBeTruthy();
    expect(getByText('剩余时间')).toBeTruthy();
    expect(getByText('24 秒')).toBeTruthy();
    expect(queryByText('自动同步未开启')).toBeNull();
  });
});
