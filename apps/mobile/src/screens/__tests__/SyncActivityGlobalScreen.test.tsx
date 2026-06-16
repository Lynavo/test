import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { SyncActivityGlobalScreen } from '../SyncActivityGlobalScreen';
import { listDownloadRecords } from '../../services/download-records-service';

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

jest.mock('../../dev/visualQa', () => ({
  isVisualQaEnabled: () => mockVisualQaEnabled,
  isVisualQaHomeEmptyStateEnabled: () => false,
}));

describe('SyncActivityGlobalScreen', () => {
  beforeEach(() => {
    mockVisualQaEnabled = false;
    mockRecentDownloadsSection.mockClear();
    (listDownloadRecords as jest.Mock).mockResolvedValue([]);
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
});
